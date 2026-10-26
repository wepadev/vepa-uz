/**
 * PDF ustiga qo'lda yozish — chizgilar modeli va PDF'ga eksport.
 *
 * Nebo kabi ishlaydi: o'qituvchi PDF ochadi, qalam bilan yozadi,
 * keyin natijani yangi PDF qilib kompyuterga saqlaydi. Hamma ish
 * brauzerda bo'ladi — fayl serverga yuborilmaydi va bazaga
 * yozilmaydi.
 *
 * Koordinatalar haqida. Har bir chizgi sahifaning "ko'rinish"
 * koordinatasida saqlanadi: chap yuqori burchak (0, 0), birlik —
 * PDF punkti (1/72 dyuym), ya'ni pdf.js `getViewport({ scale: 1 })`
 * bilan bir xil. Sahifa burilgan (/Rotate) yoki kesilgan (CropBox)
 * bo'lsa ham shu koordinata ekranda ko'ringanidek bo'ladi.
 *
 * Eksportda ko'rinish koordinatasidan PDF koordinatasiga o'tish
 * bitta `cm` buyrug'i bilan qilinadi (`toPdf` matritsasi). Shuning
 * uchun nuqtalarni bittalab qayta hisoblash shart emas.
 *
 * Bu fayl React'ga ham, brauzerga ham bog'liq emas — testlar
 * Node'da ishlatadi.
 */
import { getStroke, type StrokeOptions } from "perfect-freehand";
import {
  LineCapStyle,
  LineJoinStyle,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFPage,
  appendBezierCurve,
  closePath,
  concatTransformationMatrix,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  setFillingRgbColor,
  setGraphicsState,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  type PDFOperator,
} from "pdf-lib";

export type InkTool = "pen" | "marker" | "line";

/**
 * Qalam turi — Nebo'dagi kabi.
 *
 *   felt     — flomaster: qalinligi bir xil
 *   fountain — pero: bosim va tezlikka qarab ingichkalashadi,
 *              uchlari nozik — qo'l yozuvi eng chiroyli chiqadi
 *   brush    — mo'yqalam: bosimga juda sezgir, uchlari o'tkir
 */
export type PenKind = "felt" | "fountain" | "brush";

export type Stroke = {
  tool: InkTool;
  /** "#RRGGBB" */
  color: string;
  /** Chiziq qalinligi, PDF punktida */
  width: number;
  /** Nuqtalar ketma-ket: [x0, y0, x1, y1, ...] */
  points: number[];
  /** Faqat qalam uchun. Yo'q bo'lsa — eski oddiy chiziq */
  pen?: PenKind;
  /**
   * Har nuqtadagi qalam bosimi (0..1). Faqat haqiqiy stilusda
   * yoziladi; sichqoncha va barmoqda bosim yo'q — u holda bosim
   * tezlikdan taxmin qilinadi.
   */
  pressures?: number[];
  /**
   * Stabilizatsiya (0..1): qo'l titrashini qanchalik tekislash.
   * Ko'p bo'lsa chiziq silliqroq, lekin qalamdan ko'proq orqada qoladi.
   * Yo'q bo'lsa — `DEFAULT_SMOOTH`.
   */
  smooth?: number;
};

/** Qalamlarning boshlang'ich stabilizatsiyasi — yengil, chiziq qalamdan qolmasin */
export const DEFAULT_SMOOTH = 0.2;

/** Stabilizatsiya 0..1 oralig'ida, yuzdan bir aniqlikda */
export function clampSmooth(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SMOOTH;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

/** [a, b, c, d, e, f] — PDF'dagi kabi affin matritsa */
export type Matrix = [number, number, number, number, number, number];

export type PageBackground = "blank" | "grid";

export type InkPage = {
  id: string;
  /** Asl PDF'dagi sahifa raqami (0 dan). `null` — qo'shilgan bo'sh sahifa */
  source: number | null;
  /** Ko'rinish o'lchami, PDF punktida */
  width: number;
  height: number;
  /** Ko'rinish koordinatasidan PDF koordinatasiga */
  toPdf: Matrix;
  /** Faqat qo'shilgan sahifalar uchun */
  background: PageBackground;
  strokes: Stroke[];
};

/** Marker shaffofligi — ostidagi matn ko'rinib tursin */
export const MARKER_OPACITY = 0.35;

/** Katak sahifadagi katak o'lchami, punktda (5 mm ga yaqin) */
export const GRID_STEP = 14.17;

/* ------------------------------------------------------------------ */
/* Matritsa                                                            */
/* ------------------------------------------------------------------ */

export function invertMatrix(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;

  if (det === 0) {
    throw new Error("Matritsani teskarisi yo'q");
  }

  return [
    d / det,
    -b / det,
    -c / det,
    a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det,
  ];
}

export function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Bo'sh sahifa uchun: y o'qini aylantirish (yuqoridan pastga → pastdan yuqoriga) */
export function blankPageMatrix(height: number): Matrix {
  return [1, 0, 0, -1, 0, height];
}

/* ------------------------------------------------------------------ */
/* Geometriya                                                          */
/* ------------------------------------------------------------------ */

/** Nuqtadan kesmagacha masofaning kvadrati */
function distanceToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/**
 * O'chirg'ich chizgiga tegdimi.
 *
 * `radius` — o'chirg'ich kattaligi. Chizgining o'z qalinligi ham
 * qo'shiladi: qalin marker chetidan tegsa ham o'chadi.
 */
export function strokeHit(stroke: Stroke, x: number, y: number, radius: number) {
  const reach = radius + stroke.width / 2;
  const reachSq = reach * reach;
  const p = stroke.points;

  if (p.length === 2) {
    const dx = p[0] - x;
    const dy = p[1] - y;
    return dx * dx + dy * dy <= reachSq;
  }

  for (let i = 0; i + 3 < p.length; i += 2) {
    if (distanceToSegmentSq(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reachSq) {
      return true;
    }
  }

  return false;
}

/**
 * Silliq chiziq bo'laklari.
 *
 * Qo'l yozuvi nuqtalari siniq chiziq bo'lib ko'rinmasligi uchun
 * har ikki nuqta o'rtasidan o'tuvchi kvadrat egri chiziqlar
 * ishlatiladi (nuqtalarning o'zi — boshqaruv nuqtasi). Ekranda
 * ham, PDF'da ham bir xil shakl chiqishi uchun ikkalasi shu
 * funksiyadan foydalanadi.
 */
export type PathSegment =
  | { kind: "move"; x: number; y: number }
  | { kind: "line"; x: number; y: number }
  | { kind: "quad"; cx: number; cy: number; x: number; y: number };

export function strokePath(points: number[]): PathSegment[] {
  const count = points.length / 2;

  if (count === 0) return [];

  const segments: PathSegment[] = [{ kind: "move", x: points[0], y: points[1] }];

  if (count === 1) {
    /* Bitta nuqta — kichik dumaloq dog' bo'lib chiqsin */
    segments.push({ kind: "line", x: points[0] + 0.01, y: points[1] });
    return segments;
  }

  if (count === 2) {
    segments.push({ kind: "line", x: points[2], y: points[3] });
    return segments;
  }

  for (let i = 1; i < count - 1; i += 1) {
    const cx = points[i * 2];
    const cy = points[i * 2 + 1];
    const mx = (cx + points[i * 2 + 2]) / 2;
    const my = (cy + points[i * 2 + 3]) / 2;
    segments.push({ kind: "quad", cx, cy, x: mx, y: my });
  }

  segments.push({
    kind: "line",
    x: points[points.length - 2],
    y: points[points.length - 1],
  });

  return segments;
}

/**
 * Juda yaqin nuqtalarni tashlab yuborish.
 *
 * Sichqoncha va qalam sekundiga yuzlab nuqta beradi. Ularning
 * ko'pi bir-biridan yarim punkt ham uzoq emas — PDF hajmini
 * shishiradi, ko'rinishga esa ta'sir qilmaydi.
 */
export function simplifyPoints(points: number[], minDistance = 0.4) {
  return simplifyStroke(points, undefined, minDistance).points;
}

/** `simplifyPoints` — bosim qiymatlari ham nuqtalari bilan birga qoladi */
export function simplifyStroke(
  points: number[],
  pressures: number[] | undefined,
  minDistance = 0.4,
) {
  if (points.length <= 4) {
    return { points: points.slice(), pressures: pressures?.slice() };
  }

  const kept = [0];
  const minSq = minDistance * minDistance;
  let lastX = points[0];
  let lastY = points[1];

  for (let i = 1; i < points.length / 2 - 1; i += 1) {
    const dx = points[i * 2] - lastX;
    const dy = points[i * 2 + 1] - lastY;
    if (dx * dx + dy * dy >= minSq) {
      kept.push(i);
      lastX = points[i * 2];
      lastY = points[i * 2 + 1];
    }
  }

  kept.push(points.length / 2 - 1);

  return {
    points: kept.flatMap((i) => [points[i * 2], points[i * 2 + 1]]),
    pressures: pressures && kept.map((i) => pressures[i] ?? 0.5),
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!value) return [0, 0, 0];
  const n = parseInt(value[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* ------------------------------------------------------------------ */
/* Qalam konturi                                                       */
/* ------------------------------------------------------------------ */

/*
 * Qalam chizgisi chiziq (stroke) emas, to'ldirilgan shakl (fill):
 * har nuqtada qalinlik boshqacha bo'lishi uchun chizgining ikki
 * cheti hisoblanib, ichi bo'yaladi. Hisobni `perfect-freehand`
 * qiladi — tldraw va Excalidraw ham shuni ishlatadi.
 *
 * Shakl ekranda ham, PDF'da ham aynan bir xil nuqtalardan quriladi,
 * shuning uchun saqlangan PDF ekrandagidek chiqadi va vektor
 * bo'lgani uchun har qancha kattalashtirilsa ham tiniq qoladi.
 */
const PEN_OPTIONS: Record<PenKind, (size: number) => StrokeOptions> = {
  felt: () => ({
    thinning: 0,
    simulatePressure: false,
  }),
  fountain: (size) => ({
    thinning: 0.6,
    /* Yumshoq egri: yengil bosimda ham chiziq uzilmasin */
    easing: (t) => Math.sin((t * Math.PI) / 2),
    start: { taper: size * 2.5, cap: true },
    end: { taper: size * 3, cap: true },
  }),
  brush: (size) => ({
    thinning: 0.85,
    easing: (t) => t * t * (3 - 2 * t),
    start: { taper: size * 6, cap: true },
    end: { taper: size * 8, cap: true },
  }),
};

/**
 * Qalam chizgisining konturi: [[x, y], ...]. Oddiy chiziq bilan
 * chiziladigan chizgi (marker, to'g'ri chiziq, eski chizgilar)
 * uchun `null`.
 *
 * `complete` — chizgi tugaganmi. Yozish paytida uchi ingichkalashmaydi
 * (aks holda har kadrda "sakrab" turardi), lekin aynan qalam turgan
 * nuqtaga yetadi — chiziq qalamdan orqada qolmaydi.
 */
export function penOutline(stroke: Stroke, complete = true): number[][] | null {
  if (stroke.tool !== "pen" || !stroke.pen) return null;

  const { points, pressures } = stroke;
  const input: number[][] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    input.push(
      pressures ? [points[i], points[i + 1], pressures[i / 2] ?? 0.5] : [points[i], points[i + 1]],
    );
  }
  if (input.length === 0) return [];

  const base = PEN_OPTIONS[stroke.pen](stroke.width);
  /*
   * Stabilizatsiya ikki narsani boshqaradi: `streamline` — chiziq
   * uchi qo'lning titrashiga qanchalik sekin ergashadi (kechikish),
   * `smoothing` — kontur chetlarining yumshoqligi.
   */
  const smooth = clampSmooth(stroke.smooth ?? DEFAULT_SMOOTH);
  return getStroke(input, {
    size: stroke.width,
    ...base,
    streamline: smooth * 0.8,
    smoothing: 0.35 + smooth * 0.5,
    simulatePressure: base.simulatePressure ?? !pressures,
    ...(complete ? {} : { end: { taper: 0, cap: true } }),
    last: true,
  });
}

/** Yopiq silliq kontur: har ikki nuqta o'rtasidan o'tuvchi kvadrat egrilar */
export function outlinePath(outline: number[][]): PathSegment[] {
  const n = outline.length;
  if (n < 3) return [];

  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const [sx, sy] = mid(outline[0], outline[1]);
  const segments: PathSegment[] = [{ kind: "move", x: sx, y: sy }];

  for (let i = 1; i <= n; i += 1) {
    const p = outline[i % n];
    const [x, y] = mid(p, outline[(i + 1) % n]);
    segments.push({ kind: "quad", cx: p[0], cy: p[1], x, y });
  }

  return segments;
}

/* ------------------------------------------------------------------ */
/* PDF'ga eksport                                                      */
/* ------------------------------------------------------------------ */

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function pathOperators(segments: PathSegment[]): PDFOperator[] {
  const ops: PDFOperator[] = [];
  let lastX = 0;
  let lastY = 0;

  for (const segment of segments) {
    if (segment.kind === "move") {
      ops.push(moveTo(round(segment.x), round(segment.y)));
    } else if (segment.kind === "line") {
      ops.push(lineTo(round(segment.x), round(segment.y)));
    } else {
      /* PDF'da kvadrat egri yo'q — uni kubik egri ko'rinishida yozamiz */
      const c1x = lastX + (2 / 3) * (segment.cx - lastX);
      const c1y = lastY + (2 / 3) * (segment.cy - lastY);
      const c2x = segment.x + (2 / 3) * (segment.cx - segment.x);
      const c2y = segment.y + (2 / 3) * (segment.cy - segment.y);
      ops.push(
        appendBezierCurve(
          round(c1x),
          round(c1y),
          round(c2x),
          round(c2y),
          round(segment.x),
          round(segment.y),
        ),
      );
    }

    lastX = segment.x;
    lastY = segment.y;
  }

  return ops;
}

/** Marker uchun shaffoflik holati (ExtGState) */
function markerState(doc: PDFDocument, page: PDFPage): PDFName {
  const state = doc.context.obj({
    Type: "ExtGState",
    CA: PDFNumber.of(MARKER_OPACITY),
    ca: PDFNumber.of(MARKER_OPACITY),
  });

  return page.node.newExtGState("GS", doc.context.register(state));
}

function drawGrid(page: PDFPage, width: number, height: number) {
  const ops: PDFOperator[] = [
    pushGraphicsState(),
    setStrokingRgbColor(0.82, 0.87, 0.94),
    setLineWidth(0.4),
  ];

  for (let x = GRID_STEP; x < width; x += GRID_STEP) {
    ops.push(moveTo(round(x), 0), lineTo(round(x), round(height)));
  }
  for (let y = GRID_STEP; y < height; y += GRID_STEP) {
    ops.push(moveTo(0, round(y)), lineTo(round(width), round(y)));
  }

  ops.push(stroke(), popGraphicsState());
  page.pushOperators(...ops);
}

function drawStrokes(doc: PDFDocument, page: PDFPage, item: InkPage) {
  if (item.strokes.length === 0) return;

  const ops: PDFOperator[] = [
    pushGraphicsState(),
    concatTransformationMatrix(...item.toPdf),
    setLineCap(LineCapStyle.Round),
    setLineJoin(LineJoinStyle.Round),
  ];

  let marker: PDFName | null = null;

  for (const s of item.strokes) {
    const [r, g, b] = hexToRgb(s.color);
    ops.push(pushGraphicsState());

    const outline = penOutline(s);
    if (outline) {
      ops.push(
        setFillingRgbColor(r, g, b),
        ...pathOperators(outlinePath(outline)),
        closePath(),
        fill(),
        popGraphicsState(),
      );
      continue;
    }

    if (s.tool === "marker") {
      marker ??= markerState(doc, page);
      ops.push(setGraphicsState(marker));
    }

    ops.push(setStrokingRgbColor(r, g, b), setLineWidth(round(s.width)));
    ops.push(...pathOperators(strokePath(s.points)), stroke(), popGraphicsState());
  }

  ops.push(popGraphicsState());
  page.pushOperators(...ops);
}

/**
 * Yozuvlar tushirilgan yangi PDF.
 *
 * Asl sahifalar `copyPages` bilan ko'chiriladi — matn, rasm va
 * havolalar o'zgarmay qoladi, chizgilar ularning ustiga alohida
 * qatlam bo'lib yoziladi. Qo'shilgan bo'sh sahifalar shu joyda
 * yaratiladi.
 */
export async function exportInkPdf(
  original: Uint8Array | ArrayBuffer,
  pages: InkPage[],
): Promise<Uint8Array> {
  const source = await PDFDocument.load(original, { ignoreEncryption: true });
  const out = await PDFDocument.create();

  const used = pages
    .map((page) => page.source)
    .filter((index): index is number => index !== null);
  const copied = await out.copyPages(source, used);

  let next = 0;

  for (const item of pages) {
    let page: PDFPage;

    if (item.source === null) {
      page = out.addPage([item.width, item.height]);
      /* Oq fon — ba'zi ko'ruvchilar bo'sh sahifani kulrang ko'rsatadi */
      page.pushOperators(
        pushGraphicsState(),
        setFillingRgbColor(1, 1, 1),
        moveTo(0, 0),
        lineTo(item.width, 0),
        lineTo(item.width, item.height),
        lineTo(0, item.height),
        closePath(),
        fill(),
        popGraphicsState(),
      );
      if (item.background === "grid") {
        drawGrid(page, item.width, item.height);
      }
    } else {
      page = out.addPage(copied[next]);
      next += 1;
    }

    drawStrokes(out, page, item);
  }

  const title = source.getTitle();
  if (title) out.setTitle(title);
  out.setProducer("vepa.uz");

  return out.save();
}

/** "dars.pdf" → "dars-yozuv.pdf" */
export function exportFileName(name: string) {
  const base = name.replace(/\.pdf$/i, "").trim() || "hujjat";
  return `${base}-yozuv.pdf`;
}

/** Fayl chindan PDF'mi — kengaytma emas, ichidagi "%PDF" belgisi bo'yicha */
export function looksLikePdf(bytes: Uint8Array) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

/**
 * "1-3, 5, 8-" kabi bet ro'yxatini o'qish (1 dan boshlab).
 * Natija — 0 dan boshlangan, tartiblangan raqamlar. Noto'g'ri yoki
 * chegaradan tashqaridagi qismlar tashlab yuboriladi.
 */
export function parsePageRange(text: string, total: number): number[] {
  const result = new Set<number>();

  for (const part of text.split(/[,;\s]+/)) {
    const match = /^(\d*)\s*[-–]\s*(\d*)$/.exec(part) ?? /^(\d+)$/.exec(part);
    if (!match) continue;

    const single = match.length === 2;
    const from = match[1] ? Number(match[1]) : 1;
    const to = single ? from : match[2] ? Number(match[2]) : total;

    for (let page = Math.max(1, Math.min(from, to)); page <= Math.min(total, Math.max(from, to)); page += 1) {
      result.add(page - 1);
    }
  }

  return [...result].sort((a, b) => a - b);
}

/** [0, 1, 2, 4] → "1-3, 5" */
export function formatPageRange(indexes: number[]): string {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  const parts: string[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i += 1;
    parts.push(start === sorted[i] ? `${start + 1}` : `${start + 1}-${sorted[i] + 1}`);
  }

  return parts.join(", ");
}
