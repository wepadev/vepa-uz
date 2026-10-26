"use client";

import { memo, useEffect, useRef, useState, type RefObject } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import {
  GRID_STEP,
  MARKER_OPACITY,
  outlinePath,
  penOutline,
  simplifyStroke,
  strokePath,
  type InkPage,
  type InkTool,
  type PathSegment,
  type PenKind,
  type Stroke,
} from "@/lib/pdf-ink";

export type EditorTool = InkTool | "eraser" | "hand";

/** O'chirg'ich radiusi, punktda */
export const ERASER_RADIUS = 7;

export type PageHandlers = {
  onStroke: (pageId: string, stroke: Stroke) => void;
  onEraseStart: () => void;
  onErase: (pageId: string, x: number, y: number, radius: number) => void;
  onEraseEnd: () => void;
  /** Qalam birinchi marta sezilganda */
  onPenDetected: () => void;
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
};

function pixelRatio() {
  /* Juda katta kanvas xotirani yeb qo'ymasin */
  return Math.min(window.devicePixelRatio || 1, 2);
}

function tracePath(ctx: CanvasRenderingContext2D, segments: PathSegment[]) {
  ctx.beginPath();
  for (const segment of segments) {
    if (segment.kind === "move") ctx.moveTo(segment.x, segment.y);
    else if (segment.kind === "line") ctx.lineTo(segment.x, segment.y);
    else ctx.quadraticCurveTo(segment.cx, segment.cy, segment.x, segment.y);
  }
}

/** `complete: false` — chizgi hali yozilmoqda (jonli qatlam) */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  scale: number,
  complete = true,
) {
  ctx.save();
  ctx.scale(scale, scale);

  const outline = penOutline(stroke, complete);
  if (outline) {
    ctx.fillStyle = stroke.color;
    tracePath(ctx, outlinePath(outline));
    ctx.closePath();
    ctx.fill();
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

/** Stilus bosimi; ba'zi qurilmalar birinchi nuqtada 0 beradi */
function pressureOf(event: { pressure: number }) {
  const value = event.pressure > 0 ? event.pressure : 0.5;
  return Math.round(value * 100) / 100;
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
      tool: InkTool;
      points: number[];
      /** Faqat stilusda */
      pressures: number[] | null;
    }
  | { kind: "erase"; pointerId: number }
  | {
      kind: "pan";
      pointerId: number;
      x: number;
      y: number;
      left: number;
      top: number;
    };

/**
 * Bitta sahifa: uch qatlamli kanvas.
 *
 *   1. PDF — pdf.js chizgan asl sahifa (faqat ko'rinib turganda).
 *   2. Yozuv — saqlangan chizgilar.
 *   3. Jonli — hozir chizilayotgan chizgi; qalam shu qatlamni bosadi.
 *
 * Jonli chizgi alohida qatlamda, chunki marker shaffof: uni bo'lak-
 * bo'lak chizsak, bo'laklar ustma-ust tushib, chiziq yo'l-yo'l bo'lib
 * qolardi. Har kadrda butun chizgi qaytadan chiziladi.
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
}: InkPageViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const frameRef = useRef(0);
  const [visible, setVisible] = useState(false);

  const cssWidth = page.width * zoom;
  const cssHeight = page.height * zoom;

  /* Ekranga yaqinlashganda chizamiz, uzoqlashganda bo'shatamiz */
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: scrollRef.current, rootMargin: "1200px 0px" },
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

        const viewport = pdfPage.getViewport({ scale: zoom * pixelRatio() });
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
      return;
    }

    const ratio = pixelRatio();
    sizeCanvas(ink, cssWidth * ratio, cssHeight * ratio);
    sizeCanvas(live, cssWidth * ratio, cssHeight * ratio);

    const ctx = ink.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, ink.width, ink.height);
    for (const stroke of page.strokes) {
      paintStroke(ctx, stroke, zoom * ratio);
    }

    /* Yangi chizgi endi yozuv qatlamida — jonli qatlamni tozalaymiz */
    if (!gestureRef.current) {
      live.getContext("2d")?.clearRect(0, 0, live.width, live.height);
    }
  }, [visible, page.strokes, zoom, cssWidth, cssHeight]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  function pointFrom(event: { clientX: number; clientY: number }) {
    const rect = liveCanvasRef.current!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * page.width;
    const y = ((event.clientY - rect.top) / rect.height) * page.height;
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as const;
  }

  function drawLive() {
    frameRef.current = 0;
    const gesture = gestureRef.current;
    const live = liveCanvasRef.current;
    if (!live || !gesture || gesture.kind !== "draw") return;

    const ctx = live.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, live.width, live.height);
    paintStroke(ctx, buildStroke(gesture), zoom * pixelRatio(), false);
  }

  function buildStroke(gesture: Extract<Gesture, { kind: "draw" }>): Stroke {
    const stroke: Stroke = {
      tool: gesture.tool,
      color,
      width,
      points: gesture.points,
    };
    if (gesture.tool === "pen") {
      stroke.pen = pen;
      if (gesture.pressures) stroke.pressures = gesture.pressures;
    }
    return stroke;
  }

  function scheduleLive() {
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(drawLive);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (gestureRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const isPen = event.pointerType === "pen";
    if (isPen) handlers.current.onPenDetected();

    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();

    const touchPans = event.pointerType === "touch" && (penOnly || tool === "hand");

    if (tool === "hand" || touchPans) {
      const scroller = scrollRef.current;
      gestureRef.current = {
        kind: "pan",
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: scroller?.scrollLeft ?? 0,
        top: scroller?.scrollTop ?? 0,
      };
      return;
    }

    /* Qalamning orqa uchi yoki o'chirg'ich tugmasi — o'chiradi */
    const penEraser = isPen && (event.buttons & 32) !== 0;
    const [x, y] = pointFrom(event);

    if (tool === "eraser" || penEraser) {
      gestureRef.current = { kind: "erase", pointerId: event.pointerId };
      handlers.current.onEraseStart();
      handlers.current.onErase(page.id, x, y, ERASER_RADIUS);
      return;
    }

    gestureRef.current = {
      kind: "draw",
      pointerId: event.pointerId,
      tool,
      points: [x, y],
      pressures: isPen ? [pressureOf(event)] : null,
    };
    scheduleLive();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    if (gesture.kind === "pan") {
      scrollRef.current?.scrollTo({
        left: gesture.left - (event.clientX - gesture.x),
        top: gesture.top - (event.clientY - gesture.y),
      });
      return;
    }

    /* Brauzer kadrlar orasidagi nuqtalarni ham beradi — yozuv silliqroq */
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const samples = events.length > 0 ? events : [event.nativeEvent];

    if (gesture.kind === "erase") {
      for (const sample of samples) {
        const [x, y] = pointFrom(sample);
        handlers.current.onErase(page.id, x, y, ERASER_RADIUS);
      }
      return;
    }

    if (gesture.tool === "line") {
      const [x, y] = pointFrom(event);
      gesture.points = [gesture.points[0], gesture.points[1], x, y];
    } else {
      for (const sample of samples) {
        const [x, y] = pointFrom(sample);
        gesture.points.push(x, y);
        gesture.pressures?.push(pressureOf(sample));
      }
    }

    scheduleLive();
  }

  function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;

    if (gesture.kind === "erase") {
      handlers.current.onEraseEnd();
      return;
    }

    if (gesture.kind !== "draw") return;

    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;

    if (gesture.tool === "line" && gesture.points.length < 4) {
      liveCanvasRef.current
        ?.getContext("2d")
        ?.clearRect(0, 0, liveCanvasRef.current.width, liveCanvasRef.current.height);
      return;
    }

    if (gesture.tool !== "line") {
      const simple = simplifyStroke(gesture.points, gesture.pressures ?? undefined, 0.3);
      gesture.points = simple.points;
      gesture.pressures = simple.pressures ?? null;
    }

    handlers.current.onStroke(page.id, buildStroke(gesture));
  }

  const cursor =
    tool === "hand" ? "grab" : tool === "eraser" ? "cell" : "crosshair";

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
        style={{ touchAction: "none", cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
}

export default memo(InkPageView);
