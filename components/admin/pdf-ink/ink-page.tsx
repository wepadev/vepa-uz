"use client";

import { memo, useEffect, useRef, useState, type RefObject } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import {
  GRID_STEP,
  MARKER_OPACITY,
  TEXT_FONT,
  TEXT_LINE_HEIGHT,
  InkTrace,
  StrokeInput,
  inkSamples,
  strokePath,
  type InkPage,
  type InkTool,
  type PathSegment,
  type PenKind,
  type Stroke,
  type TextNote,
} from "@/lib/pdf-ink";

export type EditorTool = InkTool | "eraser" | "hand" | "text";

/** Hozir yozilayotgan matn (faqat bitta sahifada bo'ladi) */
export type TextEdit = TextNote & {
  pageId: string;
  /** Mavjud matnni tahrirlash bo'lsa — uning id'si */
  noteId: string | null;
};

/** O'chirg'ich radiusi, punktda */
export const ERASER_RADIUS = 7;

export type PageHandlers = {
  onStroke: (pageId: string, stroke: Stroke) => void;
  onEraseStart: () => void;
  onErase: (pageId: string, x: number, y: number, radius: number) => void;
  onEraseEnd: () => void;
  /** Qalam birinchi marta sezilganda */
  onPenDetected: () => void;
  /** Ikki barmoq bilan kattalashtirilmoqda — chizilmaydi */
  isPinching: () => boolean;
  /** "T" asbobi: bo'sh joyga bosildi — yangi matn */
  onTextPlace: (pageId: string, x: number, y: number) => void;
  /** "T" asbobi: mavjud matn bosildi — tahrirlash */
  onTextEdit: (pageId: string, noteId: string) => void;
  onTextChange: (text: string) => void;
  onTextDone: () => void;
};

type InkPageViewProps = {
  page: InkPage;
  pdf: PDFDocumentProxy | null;
  zoom: number;
  tool: EditorTool;
  color: string;
  width: number;
  pen: PenKind;
  /** Barmoq chizmaydi, sahifani suradi */
  penOnly: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  handlers: RefObject<PageHandlers>;
  /** Shu sahifada yozilayotgan matn (boshqa sahifalarda null) */
  textEdit: TextEdit | null;
};

function pixelRatio() {
  /* Juda katta kanvas xotirani yeb qo'ymasin */
  return Math.min(window.devicePixelRatio || 1, 2);
}

/*
 * PDF sahifasi uchun piksel chegarasi. Skaner qilingan PDF'ni katta
 * masshtabda chizish asosiy oqimni soniyalab band qiladi — shu paytda
 * qalam "qotib" qoladi. Bu chegara A4 ni ~200% da tiniq chizishga
 * yetadi; undan kattasini brauzer cho'zib ko'rsatadi.
 */
const PDF_PIXEL_BUDGET = 8_000_000;

/*
 * Yozuv qatlami uchun ham chegara bor. Kattalashtirilgan sahifa
 * kanvasi o'nlab megabayt xotira oladi; iPad Safari'da hamma
 * kanvaslar uchun umumiy chegara bor — undan oshsa brauzer
 * sekinlashadi yoki kanvas bo'shab qoladi.
 */
function inkPixelBudget() {
  const apple =
    /iPad|iPhone/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return apple ? 8_000_000 : 16_000_000;
}

/** Yozuv kanvasida bir punkt necha piksel */
function inkScale(page: { width: number; height: number }, zoom: number) {
  const limit = Math.sqrt(inkPixelBudget() / (page.width * page.height));
  return Math.min(zoom * pixelRatio(), limit);
}

/*
 * Jonli qatlam (qalam uchi, marker, to'g'ri chiziq) faqat hozir
 * yozilayotgan bitta sahifada bo'ladi — qolgan sahifalarniki
 * xotira olmaydi.
 */
let activeLive: HTMLCanvasElement | null = null;

function claimLive(canvas: HTMLCanvasElement, width: number, height: number) {
  if (activeLive && activeLive !== canvas) releaseCanvas(activeLive);
  activeLive = canvas;
  sizeCanvas(canvas, width, height);
}

/*
 * Kaft himoyasi: qalam ekranda turganda yoki endigina ko'tarilganda
 * tekkan barmoq/kaft sahifani surmaydi.
 */
const pensDown = new Set<number>();
let lastPenTime = -Infinity;

function palmLikely() {
  return pensDown.size > 0 || performance.now() - lastPenTime < 350;
}

/** Chizgi egallagan to'rtburchak (sahifa koordinatasida) */
function strokeBounds(points: number[], pad: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    if (points[i] < minX) minX = points[i];
    if (points[i] > maxX) maxX = points[i];
    if (points[i + 1] < minY) minY = points[i + 1];
    if (points[i + 1] > maxY) maxY = points[i + 1];
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

type Box = ReturnType<typeof strokeBounds>;

/** Qalam izi namunalari ([x, y, r, ...]) egallagan to'rtburchak */
function inkBounds(samples: number[]): Box | null {
  if (samples.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 2 < samples.length; i += 3) {
    const r = samples[i + 2] + 1;
    if (samples[i] - r < minX) minX = samples[i] - r;
    if (samples[i] + r > maxX) maxX = samples[i] + r;
    if (samples[i + 1] - r < minY) minY = samples[i + 1] - r;
    if (samples[i + 1] + r > maxY) maxY = samples[i + 1] + r;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Kanvasning bir qismini tozalash; `box` yo'q bo'lsa — hammasini */
function clearArea(canvas: HTMLCanvasElement, box: Box | null, scale: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (!box) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.clearRect(
    Math.floor(box.x * scale) - 2,
    Math.floor(box.y * scale) - 2,
    Math.ceil(box.w * scale) + 4,
    Math.ceil(box.h * scale) + 4,
  );
}

function tracePath(ctx: CanvasRenderingContext2D, segments: PathSegment[]) {
  ctx.beginPath();
  for (const segment of segments) {
    if (segment.kind === "move") ctx.moveTo(segment.x, segment.y);
    else if (segment.kind === "line") ctx.lineTo(segment.x, segment.y);
    else ctx.quadraticCurveTo(segment.cx, segment.cy, segment.x, segment.y);
  }
}

/**
 * Qalam izining [from, to) namunalarini yo'lga qo'shish: har namunada
 * doira, qo'shnilar orasida trapetsiya. Hammasi bir yo'nalishda
 * aylanadi — ustma-ust tushgan joylar ham to'liq bo'yaladi.
 */
function addInk(path: Path2D, samples: number[], from: number, to: number) {
  for (let i = from; i < to; i += 1) {
    const x = samples[i * 3];
    const y = samples[i * 3 + 1];
    const r = samples[i * 3 + 2];
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);

    if (i + 1 >= to) continue;
    const x2 = samples[i * 3 + 3];
    const y2 = samples[i * 3 + 4];
    const r2 = samples[i * 3 + 5];
    const dx = x2 - x;
    const dy = y2 - y;
    const d = Math.hypot(dx, dy);
    if (d === 0) continue;
    const nx = -dy / d;
    const ny = dx / d;
    path.moveTo(x - nx * r, y - ny * r);
    path.lineTo(x2 - nx * r2, y2 - ny * r2);
    path.lineTo(x2 + nx * r2, y2 + ny * r2);
    path.lineTo(x + nx * r, y + ny * r);
    path.closePath();
  }
}

function fillInk(
  ctx: CanvasRenderingContext2D,
  samples: number[],
  from: number,
  to: number,
  color: string,
  scale: number,
) {
  if (to <= from) return;
  const path = new Path2D();
  addInk(path, samples, from, to);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.restore();
}

/*
 * Tugagan qalam chizgisining shakli bir marta hisoblanadi.
 * Chizgi obyektlari o'zgarmaydi (yangisi yaratiladi), shuning uchun
 * kalit sifatida obyektning o'zi yetarli; o'chirilgan chizgi
 * keshdan o'zi tushib ketadi.
 */
const inkCache = new WeakMap<Stroke, Path2D | null>();

function inkPath(stroke: Stroke, cache: boolean): Path2D | null {
  let path = cache ? inkCache.get(stroke) : undefined;
  if (path === undefined) {
    const samples = inkSamples(stroke);
    path = null;
    if (samples) {
      path = new Path2D();
      addInk(path, samples, 0, samples.length / 3);
    }
    if (cache) inkCache.set(stroke, path);
  }
  return path;
}

/** `cache: false` — chizgi hali yozilmoqda, har safar o'zgaradi */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  scale: number,
  cache = true,
) {
  ctx.save();
  ctx.scale(scale, scale);

  const path = inkPath(stroke, cache);
  if (path) {
    ctx.fillStyle = stroke.color;
    ctx.fill(path);
    ctx.restore();
    return;
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.globalAlpha = stroke.tool === "marker" ? MARKER_OPACITY : 1;
  tracePath(ctx, strokePath(stroke.points));
  ctx.stroke();
  ctx.restore();
}

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}

/** Ko'rinmay qolgan sahifa xotirani bo'shatsin */
function releaseCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

type Gesture =
  | {
      kind: "draw";
      pointerId: number;
      pointerType: string;
      /** Kanvas joyi — har nuqtada qayta o'lchash sekin */
      rect: DOMRect;
      tool: InkTool;
      input: StrokeInput;
      /** Faqat qalam asbobida: iz quruvchi va undan nechta namuna chizilgani */
      trace: InkTrace | null;
      drawn: number;
      /** Faqat to'g'ri chiziqda: ikkinchi uchi */
      lineEnd: number[] | null;
      color: string;
      width: number;
      pen: PenKind;
      scale: number;
    }
  | { kind: "erase"; pointerId: number; pointerType: string; rect: DOMRect }
  | {
      kind: "pan";
      pointerId: number;
      pointerType: string;
      x: number;
      y: number;
      left: number;
      top: number;
      /** Barmoq biroz qo'zg'almaguncha sahifa surilmaydi */
      moving: boolean;
      /** "T" asbobi: qo'zg'almay qo'yib yuborilsa — shu nuqtaga matn */
      tap?: { x: number; y: number };
    };

/**
 * Bitta sahifa: uch qatlamli kanvas.
 *
 *   1. PDF — pdf.js chizgan asl sahifa (faqat ko'rinib turganda).
 *   2. Yozuv — chizgilar. Qalam yozayotganda ham to'g'ridan-to'g'ri
 *      shu qatlamga chizadi: har nuqtada faqat yangi bo'lak qo'shiladi.
 *   3. Jonli — qalam uchidagi oxirgi bo'lak, marker va to'g'ri chiziq.
 *      Hodisalarni ham shu qatlam qabul qiladi.
 *
 * Marker butunicha jonli qatlamda chiziladi, chunki u shaffof: bo'lak-
 * bo'lak chizsak, bo'laklar ustma-ust tushib, chiziq yo'l-yo'l bo'lib
 * qolardi.
 */
function InkPageView({
  page,
  pdf,
  zoom,
  tool,
  color,
  width,
  pen,
  penOnly,
  scrollRef,
  handlers,
  textEdit,
}: InkPageViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const frameRef = useRef(0);
  /* Yozuv qatlamida nima chizilgani — yangi chizgi qo'shilsa, faqat uni chizamiz */
  const paintedRef = useRef<{ strokes: Stroke[]; scale: number } | null>(null);
  /* Jonli qatlamning oxirgi bo'yalgan joyi — butun kanvasni har kadrda tozalamaslik uchun */
  const liveBoxRef = useRef<Box | null>(null);
  const [visible, setVisible] = useState(false);

  const cssWidth = page.width * zoom;
  const cssHeight = page.height * zoom;

  /* Ekranga yaqinlashganda chizamiz, uzoqlashganda bo'shatamiz */
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: scrollRef.current, rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollRef]);

  /* 1. PDF qatlami */
  useEffect(() => {
    const canvas = pdfCanvasRef.current;
    if (!canvas) return;

    if (!visible || !pdf || page.source === null) {
      releaseCanvas(canvas);
      return;
    }

    let cancelled = false;
    let task: RenderTask | null = null;

    /* Kattalashtirish tugmasi ketma-ket bosilsa, har biriga chizmaymiz */
    const timer = window.setTimeout(async () => {
      try {
        const pdfPage = await pdf.getPage(page.source! + 1);
        if (cancelled) return;

        const base = pdfPage.getViewport({ scale: 1 });
        const wanted = zoom * pixelRatio();
        const limit = Math.sqrt(PDF_PIXEL_BUDGET / (base.width * base.height));
        const viewport = pdfPage.getViewport({ scale: Math.min(wanted, limit) });
        const offscreen = document.createElement("canvas");
        sizeCanvas(offscreen, viewport.width, viewport.height);
        const ctx = offscreen.getContext("2d");
        if (!ctx) return;

        task = pdfPage.render({ canvasContext: ctx, viewport });
        await task.promise;
        if (cancelled) return;

        /* Tayyor bo'lgach bir zumda almashtiramiz — oq miltillash bo'lmaydi */
        sizeCanvas(canvas, offscreen.width, offscreen.height);
        canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
        releaseCanvas(offscreen);
      } catch {
        /* Bekor qilingan chizish — bu xato emas */
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      task?.cancel();
    };
  }, [visible, pdf, page.source, zoom]);

  /* 2. Yozuv qatlami */
  useEffect(() => {
    const ink = inkCanvasRef.current;
    const live = liveCanvasRef.current;
    if (!ink || !live) return;

    if (!visible) {
      releaseCanvas(ink);
      releaseCanvas(live);
      if (activeLive === live) activeLive = null;
      paintedRef.current = null;
      liveBoxRef.current = null;
      return;
    }

    const scale = inkScale(page, zoom);
    sizeCanvas(ink, page.width * scale, page.height * scale);
    /* Jonli qatlam faqat yozilayotgan sahifada bor; kattalik o'zgarsa moslaymiz */
    if (live.width > 1) sizeCanvas(live, page.width * scale, page.height * scale);

    const ctx = ink.getContext("2d");
    if (!ctx) return;

    /*
     * Odatda yangi chizgi oxiriga qo'shiladi: oldingilari joyida,
     * faqat yangisini ustidan chizamiz (qalam chizgisi esa yozish
     * paytidayoq chizib bo'lingan). O'chirish, orqaga qaytarish
     * yoki kattalashtirishda hammasi qaytadan chiziladi.
     */
    const painted = paintedRef.current;
    const strokes = page.strokes;
    const appended =
      painted !== null &&
      painted.scale === scale &&
      ink.width > 1 &&
      strokes.length >= painted.strokes.length &&
      painted.strokes.every((stroke, i) => strokes[i] === stroke);

    if (appended) {
      for (let i = painted.strokes.length; i < strokes.length; i += 1) {
        paintStroke(ctx, strokes[i], scale);
      }
    } else {
      ctx.clearRect(0, 0, ink.width, ink.height);
      for (const stroke of strokes) {
        paintStroke(ctx, stroke, scale);
      }
    }
    paintedRef.current = { strokes, scale };

    /* Yangi chizgi endi yozuv qatlamida — jonli qatlamni tozalaymiz */
    if (!gestureRef.current) {
      clearArea(live, liveBoxRef.current, scale);
      liveBoxRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sahifaning faqat shu qismlari kerak
  }, [visible, page.strokes, zoom, page.width, page.height]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  /*
   * iPad: Apple Pencil tegishini Safari o'z ishlariga (surish, matn
   * belgilash, lupa) ishlatmasin — qalam faqat yozadi. Barmoqlarga
   * tegilmaydi.
   */
  useEffect(() => {
    const live = liveCanvasRef.current;
    if (!live) return;

    function block(event: TouchEvent) {
      for (const touch of Array.from(event.changedTouches)) {
        if ((touch as Touch & { touchType?: string }).touchType === "stylus") {
          event.preventDefault();
          return;
        }
      }
    }

    live.addEventListener("touchstart", block, { passive: false });
    live.addEventListener("touchmove", block, { passive: false });
    return () => {
      live.removeEventListener("touchstart", block);
      live.removeEventListener("touchmove", block);
    };
  }, []);

  function pointFrom(event: { clientX: number; clientY: number }, rect: DOMRect) {
    const x = ((event.clientX - rect.left) / rect.width) * page.width;
    const y = ((event.clientY - rect.top) / rect.height) * page.height;
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as const;
  }

  /** Jonli qatlamni tozalash — faqat oxirgi chizilgan joyni */
  function clearLive() {
    const live = liveCanvasRef.current;
    if (live) clearArea(live, liveBoxRef.current, inkScale(page, zoom));
    liveBoxRef.current = null;
  }

  type DrawGesture = Extract<Gesture, { kind: "draw" }>;

  /**
   * Qalam: yangi kelgan nuqtalarni darhol chizish. Tayyor bo'laklar
   * yozuv qatlamiga qo'shiladi (eskilari qayta chizilmaydi), qalam
   * uchidagi bitta bo'lak — jonli qatlamga. Kadrni kutmaymiz:
   * hodisa kelgan zahoti chizilsa, chiziq shu kadrning o'zida ko'rinadi.
   */
  function drawPen(gesture: DrawGesture, complete = false) {
    const trace = gesture.trace;
    const ink = inkCanvasRef.current?.getContext("2d");
    const live = liveCanvasRef.current;
    const liveCtx = live?.getContext("2d");
    if (!trace || !ink || !live || !liveCtx) return;

    const { scale, color: inkColor } = gesture;
    const total = trace.done.length / 3;
    if (total > gesture.drawn) {
      /* Oldingi oxirgi namunadan boshlaymiz — bo'laklar ulanib tursin */
      fillInk(ink, trace.done, Math.max(0, gesture.drawn - 1), total, inkColor, scale);
      gesture.drawn = total;
    }

    clearArea(live, liveBoxRef.current, scale);
    liveBoxRef.current = null;

    const tip = trace.tip(complete);
    const count = tip.length / 3;
    if (complete) {
      fillInk(ink, tip, 0, count, inkColor, scale);
      return;
    }
    fillInk(liveCtx, tip, 0, count, inkColor, scale);
    liveBoxRef.current = inkBounds(tip);
  }

  /** Marker va to'g'ri chiziq: jonli qatlamda butun chizgi qayta chiziladi */
  function drawLive() {
    frameRef.current = 0;
    const gesture = gestureRef.current;
    const live = liveCanvasRef.current;
    if (!live || !gesture || gesture.kind !== "draw" || gesture.trace) return;

    const ctx = live.getContext("2d");
    if (!ctx) return;

    /*
     * Har kadrda butun sahifa kanvasini (millionlab piksel) tozalash
     * sekin. Faqat chizgi turgan to'rtburchakni tozalaymiz.
     */
    const stroke = buildStroke(gesture);
    const box = strokeBounds(stroke.points, gesture.width * 2 + 2);
    const previous = liveBoxRef.current;
    liveBoxRef.current = previous
      ? {
          x: Math.min(previous.x, box.x),
          y: Math.min(previous.y, box.y),
          w: Math.max(previous.x + previous.w, box.x + box.w) - Math.min(previous.x, box.x),
          h: Math.max(previous.y + previous.h, box.y + box.h) - Math.min(previous.y, box.y),
        }
      : box;
    clearArea(live, liveBoxRef.current, gesture.scale);
    paintStroke(ctx, stroke, gesture.scale, false);
  }

  function buildStroke(gesture: DrawGesture): Stroke {
    const stroke: Stroke = {
      tool: gesture.tool,
      color: gesture.color,
      width: gesture.width,
      points:
        gesture.tool === "line"
          ? [gesture.input.points[0], gesture.input.points[1], ...(gesture.lineEnd ?? [])]
          : gesture.input.points,
    };
    if (gesture.tool === "pen") {
      stroke.pen = gesture.pen;
      stroke.pressures = gesture.input.pressures;
    }
    return stroke;
  }

  function scheduleLive() {
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(drawLive);
    }
  }

  /**
   * Boshlangan ishni izsiz to'xtatish: ikkinchi barmoq tekkanda
   * birinchisi chizayotgan chiziq qolmasin.
   */
  function abort() {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (gesture?.kind === "draw") {
      clearLive();
      /* Qalam yozuv qatlamiga chizib ulgurgan — qatlamni asl holiga qaytaramiz */
      const ink = inkCanvasRef.current;
      const ctx = gesture.trace ? ink?.getContext("2d") : null;
      if (ink && ctx) {
        ctx.clearRect(0, 0, ink.width, ink.height);
        for (const stroke of page.strokes) paintStroke(ctx, stroke, gesture.scale);
        paintedRef.current = { strokes: page.strokes, scale: gesture.scale };
      }
    }
    /* O'chirilgani qaytmaydi, lekin "orqaga" bilan qaytarish mumkin bo'lsin */
    if (gesture?.kind === "erase") handlers.current.onEraseEnd();
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const isPen = event.pointerType === "pen";
    if (handlers.current.isPinching() && !isPen) {
      abort();
      return;
    }
    if (isPen) pensDown.add(event.pointerId);
    /* Kaft ekranga qalamdan oldin tegsa ham qalam yozaversin */
    if (gestureRef.current && isPen && gestureRef.current.pointerType === "touch") abort();
    if (gestureRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    /* Qalam bilan yozayotgan qo'lning kafti — e'tiborsiz */
    if (event.pointerType === "touch" && penOnly && palmLikely()) return;

    if (isPen) handlers.current.onPenDetected();

    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();

    const touchPans = event.pointerType === "touch" && (penOnly || tool === "hand");

    /*
     * Matn asbobida bosish — sahifani surish ham bo'lishi mumkin.
     * Barmoq qo'zg'almay ko'tarilsa (finish), shu nuqtaga matn qo'yiladi.
     */
    if (tool === "hand" || tool === "text" || touchPans) {
      const scroller = scrollRef.current;
      gestureRef.current = {
        kind: "pan",
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        left: scroller?.scrollLeft ?? 0,
        top: scroller?.scrollTop ?? 0,
        moving: event.pointerType !== "touch",
        tap:
          tool === "text"
            ? (() => {
                const [x, y] = pointFrom(event, canvas.getBoundingClientRect());
                return { x, y };
              })()
            : undefined,
      };
      return;
    }

    /* Qalamning orqa uchi yoki o'chirg'ich tugmasi — o'chiradi */
    const penEraser = isPen && (event.buttons & 32) !== 0;
    const rect = canvas.getBoundingClientRect();
    const [x, y] = pointFrom(event, rect);

    if (tool === "eraser" || penEraser) {
      gestureRef.current = { kind: "erase", pointerId: event.pointerId, pointerType: event.pointerType, rect };
      handlers.current.onEraseStart();
      handlers.current.onErase(page.id, x, y, ERASER_RADIUS);
      return;
    }

    const scale = inkScale(page, zoom);
    if (canvas.width <= 1) liveBoxRef.current = null;
    claimLive(canvas, page.width * scale, page.height * scale);

    const input = new StrokeInput(rect.width / page.width, isPen);
    const pressure = input.add(x, y, event.pressure, event.timeStamp) ?? 0.5;
    const trace = tool === "pen" ? new InkTrace(pen, width) : null;
    trace?.add(x, y, pressure);

    const gesture: DrawGesture = {
      kind: "draw",
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      rect,
      tool,
      input,
      trace,
      drawn: 0,
      lineEnd: null,
      color,
      width,
      pen,
      scale,
    };
    gestureRef.current = gesture;
    if (trace) drawPen(gesture);
    else scheduleLive();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (handlers.current.isPinching() && gesture.pointerType !== "pen") {
      abort();
      return;
    }

    if (gesture.kind === "pan") {
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.moving) {
        /* Tekkan kaft yoki barmoqning mayda titrashi sahifani qimirlatmasin */
        if (Math.hypot(dx, dy) < 6) return;
        gesture.moving = true;
        gesture.left += dx;
        gesture.top += dy;
      }
      scrollRef.current?.scrollTo({ left: gesture.left - dx, top: gesture.top - dy });
      return;
    }

    /* Brauzer kadrlar orasidagi nuqtalarni ham beradi — yozuv silliqroq */
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const samples = events.length > 0 ? events : [event.nativeEvent];

    if (gesture.kind === "erase") {
      for (const sample of samples) {
        const [x, y] = pointFrom(sample, gesture.rect);
        handlers.current.onErase(page.id, x, y, ERASER_RADIUS);
      }
      return;
    }

    if (gesture.tool === "line") {
      gesture.lineEnd = [...pointFrom(event, gesture.rect)];
      scheduleLive();
      return;
    }

    for (const sample of samples) {
      const [x, y] = pointFrom(sample, gesture.rect);
      const pressure = gesture.input.add(x, y, sample.pressure, sample.timeStamp);
      if (pressure !== null) gesture.trace?.add(x, y, pressure);
    }

    if (gesture.trace) drawPen(gesture);
    else scheduleLive();
  }

  function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "pen") {
      pensDown.delete(event.pointerId);
      lastPenTime = performance.now();
    }

    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (handlers.current.isPinching() && gesture.pointerType !== "pen") {
      abort();
      return;
    }
    gestureRef.current = null;

    if (gesture.kind === "erase") {
      handlers.current.onEraseEnd();
      return;
    }

    if (gesture.kind === "pan") {
      const moved = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
      if (gesture.tap && moved < 8) {
        handlers.current.onTextPlace(page.id, gesture.tap.x, gesture.tap.y);
      }
      return;
    }

    if (gesture.kind !== "draw") return;

    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;

    if (gesture.tool === "line") {
      if (!gesture.lineEnd) {
        clearLive();
        return;
      }
    } else if (event.type === "pointerup") {
      /* Qalam ko'tarilgan aniq nuqta — oraliq saralashdan o'tmasa ham olinadi */
      const [x, y] = pointFrom(event, gesture.rect);
      const pressure = gesture.input.add(x, y, event.pressure, event.timeStamp, true);
      if (pressure !== null) gesture.trace?.add(x, y, pressure);
    }

    const stroke = buildStroke(gesture);

    if (gesture.trace) {
      /*
       * Chizgi yozuv qatlamida tayyor turibdi — faqat uchini qo'shamiz.
       * Qayta chizilmaydi, shuning uchun qalam ko'tarilganda yozuv
       * qimirlamaydi.
       */
      drawPen(gesture, true);
      const painted = paintedRef.current;
      if (painted && painted.scale === gesture.scale) {
        paintedRef.current = { strokes: [...painted.strokes, stroke], scale: painted.scale };
      } else {
        paintedRef.current = null;
      }
    }

    handlers.current.onStroke(page.id, stroke);
  }

  const cursor =
    tool === "hand"
      ? "grab"
      : tool === "eraser"
        ? "cell"
        : tool === "text"
          ? "text"
          : "crosshair";

  const texts = page.texts ?? [];

  return (
    <div
      ref={wrapperRef}
      data-page-id={page.id}
      className="relative mx-auto shadow-[0_1px_4px_rgba(15,23,42,0.18)]"
      style={{
        width: cssWidth,
        height: cssHeight,
        /* Sahifa tun rejimida ham oq — PDF qog'ozdagidek ko'rinsin */
        backgroundColor: "#ffffff",
        ...(page.source === null && page.background === "grid"
          ? {
              backgroundImage:
                "linear-gradient(to right, #d1deef 0.5px, transparent 0.5px), linear-gradient(to top, #d1deef 0.5px, transparent 0.5px)",
              backgroundSize: `${GRID_STEP * zoom}px ${GRID_STEP * zoom}px`,
              backgroundPosition: "left bottom",
            }
          : {}),
      }}
    >
      <canvas
        ref={pdfCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <canvas
        ref={inkCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <canvas
        ref={liveCanvasRef}
        className="absolute inset-0 h-full w-full select-none"
        style={{
          touchAction: "none",
          cursor,
          /* iPad: bosib turganda menyu/lupa chiqmasin */
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onContextMenu={(event) => event.preventDefault()}
      />

      {/* Matnlar — HTML qatlam: kattalikka qarab shrift ham o'sadi */}
      {texts.map((note) =>
        textEdit?.noteId === note.id ? null : (
          <div
            key={note.id}
            role={tool === "text" ? "button" : undefined}
            tabIndex={tool === "text" ? 0 : undefined}
            onPointerDown={(event) => {
              if (tool !== "text") return;
              event.stopPropagation();
            }}
            onClick={() => {
              if (tool === "text") handlers.current.onTextEdit(page.id, note.id);
            }}
            className={tool === "text" ? "absolute cursor-text rounded-sm hover:outline hover:outline-1 hover:outline-mb-brand/50" : "pointer-events-none absolute"}
            style={{
              left: note.x * zoom,
              top: note.y * zoom,
              color: note.color,
              fontFamily: TEXT_FONT,
              fontSize: note.size * zoom,
              lineHeight: TEXT_LINE_HEIGHT,
              whiteSpace: "pre",
            }}
          >
            {note.text}
          </div>
        ),
      )}

      {textEdit && (
        <TextEditor edit={textEdit} zoom={zoom} handlers={handlers} />
      )}
    </div>
  );
}

/** Matn yozish maydoni — yozilgan sari kengayadi */
function TextEditor({
  edit,
  zoom,
  handlers,
}: {
  edit: TextEdit;
  zoom: number;
  handlers: RefObject<PageHandlers>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    node.setSelectionRange(node.value.length, node.value.length);
  }, [edit.pageId, edit.noteId, edit.x, edit.y]);

  const lines = edit.text.split("\n");
  const columns = Math.max(4, ...lines.map((line) => line.length + 1));

  return (
    <textarea
      ref={ref}
      value={edit.text}
      rows={lines.length}
      cols={columns}
      wrap="off"
      spellCheck={false}
      aria-label="Matn"
      placeholder="Yozing..."
      onChange={(event) => handlers.current.onTextChange(event.target.value)}
      onBlur={() => handlers.current.onTextDone()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute z-10 resize-none overflow-hidden rounded-sm border-0 bg-white/80 p-0 outline outline-1 outline-mb-brand placeholder:text-slate-400"
      style={{
        left: edit.x * zoom,
        top: edit.y * zoom,
        color: edit.color,
        fontFamily: TEXT_FONT,
        fontSize: edit.size * zoom,
        lineHeight: TEXT_LINE_HEIGHT,
        /* cols ≈ belgi kengligi; Arial'da o'rtacha harf 0.55em */
        width: `${columns * 0.6}em`,
      }}
    />
  );
}

export default memo(InkPageView);
