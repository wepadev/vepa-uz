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
  drawObject,
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
   * Har nuqtadagi qalam bosimi (0..1). Stilusda — haqiqiy bosim;
   * sichqoncha va barmoqda yozish tezligidan hisoblanadi
   * (`StrokeInput`). Yo'q bo'lsa — 0.5.
   */
  pressures?: number[];
};

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
  /** Klaviatura bilan yozilgan matnlar (eski sahifalarda yo'q bo'lishi mumkin) */
  texts?: TextNote[];
};

/**
 * Matn yozuvi — "T" asbobi bilan sahifaga bosib, klaviaturada
 * yoziladi. `x`, `y` — birinchi qatorning chap yuqori burchagi,
 * ko'rinish koordinatasida (punkt). Bir necha qator bo'lishi mumkin.
 */
export type TextNote = {
  id: string;
  x: number;
  y: number;
  text: string;
  /** "#RRGGBB" */
  color: string;
  /** Shrift o'lchami, punktda */
  size: number;
};

/** Matn o'lchamlari, punktda: kichik, o'rtacha, katta, juda katta */
export const TEXT_SIZES = [12, 16, 22, 30];

/** Ekranda ham, eksportda ham bir xil shrift */
export const TEXT_FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

export const TEXT_LINE_HEIGHT = 1.25;

/**
 * Matnning taxminiy chegarasi (o'chirg'ich uchun). Arial'da harf
 * o'rtacha shrift o'lchamining ~0.55 qismiga teng.
 */
export function textNoteBox(note: TextNote) {
  const lines = note.text.split("\n");
  const longest = Math.max(1, ...lines.map((line) => line.length));

  return {
    x: note.x,
    y: note.y,
    width: longest * note.size * 0.55,
    height: lines.length * note.size * TEXT_LINE_HEIGHT,
  };
}

/** O'chirg'ich matnga tegdimi */
export function textHit(note: TextNote, x: number, y: number, radius: number) {
  const box = textNoteBox(note);

  return (
    x >= box.x - radius &&
    x <= box.x + box.width + radius &&
    y >= box.y - radius &&
    y <= box.y + box.height + radius
  );
}

/** Sahifada biror yozuv (chizgi yoki matn) bormi */
export function pageHasInk(page: InkPage) {
  return page.strokes.length > 0 || (page.texts?.length ?? 0) > 0;
}

/**
 * Matnning PNG ko'rinishi. Eksportda brauzer chizib beradi: PDF'ning
 * standart shriftlarida ğ va ş harflari yo'q, shrift faylini esa
 * har saqlashda yuklab o'tirmaymiz.
 */
export type RenderedText = {
  png: Uint8Array;
  /** Punktda */
  width: number;
  height: number;
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
    throw new Error("Matritsani teskarisi yöq");
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
/* Qalam izi                                                           */
/* ------------------------------------------------------------------ */

/*
 * Qalam chizgisi — o'rta chiziq bo'ylab zich qo'yilgan namunalar:
 * har birida joy (x, y) va shu joydagi yarim qalinlik (r). Ekranda
 * har ikki qo'shni namuna orasi doira + trapetsiya bilan to'ldiriladi,
 * PDF'da — dumaloq uchli kesmalar bilan.
 *
 * Nega shunday:
 *
 *   • Tez. Yangi nuqta kelganda faqat yangi bo'lak hisoblanadi va
 *     chiziladi — chizgi qancha uzun bo'lmasin, har kadrdagi ish
 *     bir xil. (Oldin butun chizgi konturi har kadrda qayta
 *     hisoblanardi.)
 *   • Silliq. Nuqtalar orasidan Catmull–Rom egri chizig'i o'tadi:
 *     tez yozganda nuqtalar siyrak kelsa ham chiziq siniq bo'lmaydi.
 *     Egri aynan qalam yurgan nuqtalardan o'tadi — stabilizatsiya
 *     yo'q, chiziq qalamdan orqada qolmaydi va joyidan siljimaydi.
 *   • Bir xil. Yozish paytidagi va tugagandagi shakl aynan bitta
 *     hisobdan chiqadi — qalam ko'tarilganda yozuv "sakramaydi".
 *
 * Qalinlik (bosim) faqat o'tgan nuqtalarga qarab tekislanadi — bu
 * chiziq joyiga ta'sir qilmaydi, faqat eni titramasligi uchun.
 */
const PEN_SHAPE: Record<
  PenKind,
  { thinning: number; easing: (t: number) => number; taper: number }
> = {
  felt: { thinning: 0, easing: (t) => t, taper: 0 },
  /* Yumshoq egri: yengil bosimda ham chiziq uzilmasin */
  fountain: { thinning: 0.6, easing: (t) => Math.sin((t * Math.PI) / 2), taper: 2.5 },
  brush: { thinning: 0.85, easing: (t) => t * t * (3 - 2 * t), taper: 6 },
};

/** Berilgan bosimdagi yarim qalinlik, punktda */
export function penRadius(pen: PenKind, width: number, pressure: number) {
  const shape = PEN_SHAPE[pen];
  if (!shape.thinning) return width / 2;
  const p = Math.max(0, Math.min(1, pressure));
  return Math.max(0.05, width * shape.easing(0.5 - shape.thinning * (0.5 - p)));
}

/**
 * Qalam izini nuqtama-nuqta quruvchi. `add` har yangi nuqtada
 * chaqiriladi; `done` — endi o'zgarmaydigan namunalar ([x, y, r, ...]),
 * `tip()` — qalam uchigacha bo'lgan oxirgi bo'lak (keyingi nuqta
 * kelganda biroz aniqlashadi, shuning uchun alohida).
 */
export class InkTrace {
  /** Tayyor namunalar: [x0, y0, r0, x1, y1, r1, ...] */
  readonly done: number[] = [];

  private readonly xs: number[] = [];
  private readonly ys: number[] = [];
  private readonly rs: number[] = [];
  private pressure = 0.5;
  private length = 0;
  private readonly pen: PenKind;
  private readonly width: number;

  constructor(pen: PenKind, width: number) {
    this.pen = pen;
    this.width = width;
  }

  get count() {
    return this.xs.length;
  }

  add(x: number, y: number, pressure = 0.5) {
    const n = this.xs.length;

    if (n === 0) {
      this.pressure = pressure;
    } else {
      const d = Math.hypot(x - this.xs[n - 1], y - this.ys[n - 1]);
      if (d === 0) return;
      this.length += d;
      /* Bosim sakramasin: masofaga qarab asta ergashadi */
      const follow = 1 - Math.exp(-d / Math.max(1.2, this.width * 1.2));
      this.pressure += (pressure - this.pressure) * follow;
    }

    let r = penRadius(this.pen, this.width, this.pressure);
    /* Chizgi boshi ingichka kirib keladi (pero va mo'yqalamda) */
    const taper = PEN_SHAPE[this.pen].taper * this.width;
    if (taper > 0 && this.length < taper) {
      const t = this.length / taper;
      r *= 0.3 + 0.7 * t * (2 - t);
    }

    this.xs.push(x);
    this.ys.push(y);
    this.rs.push(r);

    /* Yangi nuqta bilan undan oldingi bo'lakning egriligi aniq bo'ldi */
    if (n >= 2) this.segment(n - 2, this.done);
  }

  /**
   * Qalam uchidagi bo'lak. Birinchi namuna — `done` dagi oxirgisi
   * bilan bir xil nuqta (ulanish uchun).
   */
  tip(complete = false): number[] {
    const n = this.xs.length;
    if (n === 0) return [];
    if (n === 1) {
      /* Bitta nuqta bilan tugagan chizgi — to'liq qalinlikdagi dog' */
      const r = complete ? penRadius(this.pen, this.width, this.pressure) : this.rs[0];
      return [this.xs[0], this.ys[0], r];
    }
    const out: number[] = [];
    this.segment(n - 2, out, true);
    return out;
  }

  /** i → i+1 bo'lagi (markazga intiluvchi Catmull–Rom) */
  private segment(i: number, out: number[], withStart = false) {
    const { xs, ys, rs } = this;
    const last = xs.length - 1;
    const x1 = xs[i];
    const y1 = ys[i];
    const x2 = xs[i + 1];
    const y2 = ys[i + 1];
    /* Chekkada qo'shni yo'q — aks ettirilgan nuqta olinadi */
    const x0 = i > 0 ? xs[i - 1] : 2 * x1 - x2;
    const y0 = i > 0 ? ys[i - 1] : 2 * y1 - y2;
    const x3 = i + 2 <= last ? xs[i + 2] : 2 * x2 - x1;
    const y3 = i + 2 <= last ? ys[i + 2] : 2 * y2 - y1;
    const r1 = rs[i];
    const r2 = rs[i + 1];

    if (withStart || (i === 0 && out.length === 0)) out.push(x1, y1, r1);

    const chord = Math.hypot(x2 - x1, y2 - y1);
    const step = Math.max(0.3, Math.min(1, Math.min(r1, r2) * 0.6));
    const steps = Math.max(1, Math.ceil(chord / step));

    if (steps > 1) {
      const t1 = Math.sqrt(Math.hypot(x1 - x0, y1 - y0)) || 1e-3;
      const t2 = t1 + (Math.sqrt(chord) || 1e-3);
      const t3 = t2 + (Math.sqrt(Math.hypot(x3 - x2, y3 - y2)) || 1e-3);

      for (let k = 1; k < steps; k += 1) {
        const u = k / steps;
        const t = t1 + (t2 - t1) * u;
        const a1 = t / t1;
        const a2 = (t - t1) / (t2 - t1);
        const a3 = (t - t2) / (t3 - t2);
        const ax = x0 + (x1 - x0) * a1;
        const ay = y0 + (y1 - y0) * a1;
        const bx = x1 + (x2 - x1) * a2;
        const by = y1 + (y2 - y1) * a2;
        const cx = x2 + (x3 - x2) * a3;
        const cy = y2 + (y3 - y2) * a3;
        const b1 = t / t2;
        const b2 = (t - t1) / (t3 - t1);
        const dx = ax + (bx - ax) * b1;
        const dy = ay + (by - ay) * b1;
        const ex = bx + (cx - bx) * b2;
        const ey = by + (cy - by) * b2;
        out.push(dx + (ex - dx) * a2, dy + (ey - dy) * a2, r1 + (r2 - r1) * u);
      }
    }

    out.push(x2, y2, r2);
  }
}

/**
 * Qalam chizgisining namunalari: [x, y, r, ...]. Oddiy chiziq bilan
 * chiziladigan chizgi (marker, to'g'ri chiziq) uchun `null`.
 */
export function inkSamples(stroke: Stroke): number[] | null {
  if (stroke.tool !== "pen" || !stroke.pen) return null;

  const { points, pressures } = stroke;
  const trace = new InkTrace(stroke.pen, stroke.width);
  for (let i = 0; i + 1 < points.length; i += 2) {
    trace.add(points[i], points[i + 1], pressures?.[i / 2] ?? 0.5);
  }

  const tip = trace.tip(true);
  if (trace.done.length === 0) return tip;
  /* `tip` ning birinchi namunasi `done` ning oxirgisi bilan bir xil */
  return trace.done.concat(tip.slice(3));
}

/**
 * Yozish paytida nuqtalarni qabul qiluvchi.
 *
 * Qalam sekundiga 240 tagacha nuqta beradi; bir-biriga juda yaqinlari
 * (ekranda yarim pikseldan kam) tashlab yuboriladi — ko'rinishga
 * ta'sir qilmaydi, PDF esa yengil chiqadi. Saralash yozish paytida
 * qilinadi, shuning uchun tugagan chizgi ekrandagidan farq qilmaydi.
 *
 * Sichqoncha va barmoqda bosim yo'q — yozish tezligidan olinadi:
 * sekin yozilsa qalinroq, tez yozilsa ingichkaroq.
 */
export class StrokeInput {
  readonly points: number[] = [];
  readonly pressures: number[] = [];

  private time = 0;
  private readonly minSq: number;
  private readonly realPressure: boolean;
  private readonly pxPerUnit: number;

  /**
   * `pxPerUnit` — bir punkt ekranda necha piksel (kattalik);
   * `realPressure` — qurilma bosimni o'zi beradi (stilus).
   */
  constructor(pxPerUnit: number, realPressure: boolean) {
    this.pxPerUnit = pxPerUnit;
    this.realPressure = realPressure;
    const min = 0.35 / pxPerUnit;
    this.minSq = min * min;
  }

  /** Nuqta qabul qilingan bo'lsa — uning bosimi, aks holda `null` */
  add(x: number, y: number, pressure: number, time: number, force = false): number | null {
    const n = this.points.length;
    const last = this.pressures[this.pressures.length - 1] ?? 0.5;

    if (n === 0) {
      const p = this.realPressure && pressure > 0 ? pressure : 0.5;
      this.points.push(x, y);
      this.pressures.push(p);
      this.time = time;
      return p;
    }

    const dx = x - this.points[n - 2];
    const dy = y - this.points[n - 1];
    const dSq = dx * dx + dy * dy;
    if (dSq === 0 || (!force && dSq < this.minSq)) return null;

    let p = last;
    if (this.realPressure) {
      /* Qalam ko'tarilayotganda ba'zi qurilmalar 0 beradi */
      if (pressure > 0) p = pressure;
    } else {
      const dt = time - this.time;
      if (dt > 0) {
        const speed = (Math.sqrt(dSq) * this.pxPerUnit) / dt; /* piksel/ms */
        p = 0.78 - 0.5 * Math.min(1, speed / 1.8);
      }
    }
    p = Math.round(p * 100) / 100;

    this.points.push(x, y);
    this.pressures.push(p);
    this.time = time;
    return p;
  }
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

/**
 * Qalam izi PDF'da: dumaloq uchli kesmalar. Qalinligi (0.04 pt
 * aniqlikda) bir xil bo'lgan ketma-ket bo'laklar bitta yo'lga
 * birlashadi — flomaster chizgisi bitta yo'l bo'lib chiqadi.
 */
function inkOperators(samples: number[]): PDFOperator[] {
  const ops: PDFOperator[] = [];
  const count = samples.length / 3;

  if (count === 1) {
    ops.push(
      setLineWidth(round(samples[2] * 2)),
      moveTo(round(samples[0]), round(samples[1])),
      lineTo(round(samples[0] + 0.01), round(samples[1])),
      stroke(),
    );
    return ops;
  }

  let current = -1;
  for (let i = 0; i + 1 < count; i += 1) {
    const width = Math.max(0.04, Math.round((samples[i * 3 + 2] + samples[i * 3 + 5]) * 25) / 25);
    if (width !== current) {
      if (current >= 0) ops.push(stroke());
      current = width;
      ops.push(setLineWidth(round(width)), moveTo(round(samples[i * 3]), round(samples[i * 3 + 1])));
    }
    ops.push(lineTo(round(samples[i * 3 + 3]), round(samples[i * 3 + 4])));
  }
  ops.push(stroke());

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

    const samples = inkSamples(s);
    if (samples) {
      ops.push(setStrokingRgbColor(r, g, b), ...inkOperators(samples), popGraphicsState());
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

async function drawTexts(
  doc: PDFDocument,
  page: PDFPage,
  item: InkPage,
  renderText: (note: TextNote) => Promise<RenderedText | null>,
) {
  const texts = (item.texts ?? []).filter((note) => note.text.trim());
  if (texts.length === 0) return;

  const ops: PDFOperator[] = [pushGraphicsState(), concatTransformationMatrix(...item.toPdf)];

  for (const note of texts) {
    const rendered = await renderText(note);
    if (!rendered) continue;

    const image = await doc.embedPng(rendered.png);
    const name = page.node.newXObject("Matn", image.ref);

    /*
     * Ko'rinish koordinatasida y pastga o'sadi, rasmniki esa tepaga.
     * Shuning uchun rasm pastki chap burchagidan (x, y + h) va
     * vertikal o'q teskari: [w, 0, 0, -h, x, y + h].
     */
    ops.push(
      pushGraphicsState(),
      concatTransformationMatrix(
        round(rendered.width),
        0,
        0,
        round(-rendered.height),
        round(note.x),
        round(note.y + rendered.height),
      ),
      drawObject(name),
      popGraphicsState(),
    );
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
  /** Matnlarni PNG qilib beradi (brauzerda). Berilmasa matnlar tushmaydi */
  renderText?: (note: TextNote) => Promise<RenderedText | null>,
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
    if (renderText) await drawTexts(out, page, item, renderText);
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
