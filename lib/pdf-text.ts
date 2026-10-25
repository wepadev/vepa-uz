/**
 * PDF'dan matnni KOORDINATASI bilan o'qib, matematikani tiklash.
 *
 * Nega oddiy matn o'qish yetmaydi: PDF'da formula "matn" emas,
 * joylashtirilgan bo'laklar yig'indisi. $5^3$ ni oddiy o'qisak
 * "53" bo'ladi, kasrning surat va maxraji esa ikki alohida qator
 * bo'lib ketadi. Haqiqiy tuzilish faqat KOORDINATADA va PDF'ning
 * CHIZMA qatlamida yashiringan:
 *
 *     y=600.6  h=8   "3"        <- daraja: kichik shrift, tepada
 *     y=596.2  h=12  "5"        <- asos
 *     chiziq   y=248.3 x=68..80 <- kasr chizig'i (chizma qatlami)
 *     y=252    "7"              <- surat
 *     y=240    "40"             <- maxraj
 *
 * Shuning uchun uch narsani o'qiymiz: har bo'lakning o'rni,
 * shrift balandligi va gorizontal chiziqlar. Natija KaTeX uchun
 * tayyor LaTeX bo'lib chiqadi: `$\frac{7}{40}$`, `$5^{3}$`.
 * Saytda uni `components/math-text.tsx` chizadi.
 *
 * pdfjs-dist "legacy" (CommonJS) qurilmasi ishlatiladi — sabab
 * shu faylning import qatorida yozilgan.
 */
import pdfjs from "pdfjs-dist/legacy/build/pdf.js";

import type { PdfLine } from "@/lib/pdf-offline";

const { getDocument, OPS } = pdfjs;

type Item = {
  text: string;
  /* chap cheti */
  x: number;
  /* kengligi */
  w: number;
  /* tayanch chizig'i */
  y: number;
  /* shrift balandligi */
  h: number;
  /* matni tayyor LaTeX bo'lsa (kasr, ildiz) */
  math?: boolean;
};

/** Chizma qatlamidagi gorizontal chiziq */
type Rule = {
  x0: number;
  x1: number;
  y: number;
};

type Line = {
  y: number;
  count: number;
  items: Item[];
};

export type ExtractResult = {
  lines: PdfLine[];
  pageCount: number;
};

/* ------------------------------------------------------------------ */
/* Matritsa                                                            */
/* ------------------------------------------------------------------ */

type Matrix = [number, number, number, number, number, number];

const UNIT: Matrix = [1, 0, 0, 1, 0, 0];

/** Ikki matritsani ketma-ket qo'llash */
function mul(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** Nuqtani matritsa bo'yicha ko'chirish */
function point(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/* ------------------------------------------------------------------ */
/* Belgilar                                                            */
/* ------------------------------------------------------------------ */

/**
 * PDF belgilarini LaTeX'ga o'girish.
 *
 * PDF ichida "minus" bu ASCII `-` emas, U+2212; ko'paytirish esa
 * `·` (U+00B7). KaTeX ularni tushunmaydi yoki noto'g'ri chizadi.
 */
const SYMBOL: Record<string, string> = {
  "−": "-",
  "­": "-",
  "–": "-",
  "—": "-",
  "·": "\\cdot ",
  "∙": "\\cdot ",
  "⋅": "\\cdot ",
  "×": "\\times ",
  "÷": "\\div ",
  "≤": "\\le ",
  "≥": "\\ge ",
  "≠": "\\ne ",
  "≈": "\\approx ",
  "≡": "\\equiv ",
  "∼": "\\sim ",
  "±": "\\pm ",
  "∓": "\\mp ",
  "∞": "\\infty ",
  "°": "^\\circ ",
  "′": "'",
  "″": "''",
  "…": "\\ldots ",
  "⋯": "\\cdots ",
  "⋮": "\\vdots ",
  "→": "\\to ",
  "←": "\\leftarrow ",
  "↔": "\\leftrightarrow ",
  "⇒": "\\Rightarrow ",
  "⇐": "\\Leftarrow ",
  "⇔": "\\Leftrightarrow ",
  "∈": "\\in ",
  "∉": "\\notin ",
  "∋": "\\ni ",
  "∪": "\\cup ",
  "∩": "\\cap ",
  "∅": "\\varnothing ",
  "⊂": "\\subset ",
  "⊃": "\\supset ",
  "⊆": "\\subseteq ",
  "⊇": "\\supseteq ",
  "∖": "\\setminus ",
  "∀": "\\forall ",
  "∃": "\\exists ",
  "¬": "\\lnot ",
  "∧": "\\land ",
  "∨": "\\lor ",
  "∠": "\\angle ",
  "△": "\\triangle ",
  "∥": "\\parallel ",
  "⊥": "\\perp ",
  "≅": "\\cong ",
  "□": "\\square ",
  "∑": "\\sum ",
  "∏": "\\prod ",
  "∫": "\\int ",
  "∬": "\\iint ",
  "∂": "\\partial ",
  "∇": "\\nabla ",
  "√": "\\sqrt ",
  "ℝ": "\\mathbb{R} ",
  "ℕ": "\\mathbb{N} ",
  "ℤ": "\\mathbb{Z} ",
  "ℚ": "\\mathbb{Q} ",
  "ℂ": "\\mathbb{C} ",
  "α": "\\alpha ",
  "β": "\\beta ",
  "γ": "\\gamma ",
  "δ": "\\delta ",
  "ε": "\\varepsilon ",
  "ζ": "\\zeta ",
  "η": "\\eta ",
  "θ": "\\theta ",
  "κ": "\\kappa ",
  "λ": "\\lambda ",
  "μ": "\\mu ",
  "ν": "\\nu ",
  "ξ": "\\xi ",
  "π": "\\pi ",
  "ρ": "\\rho ",
  "σ": "\\sigma ",
  "τ": "\\tau ",
  "φ": "\\varphi ",
  "χ": "\\chi ",
  "ψ": "\\psi ",
  "ω": "\\omega ",
  "Γ": "\\Gamma ",
  "Δ": "\\Delta ",
  "Θ": "\\Theta ",
  "Λ": "\\Lambda ",
  "Π": "\\Pi ",
  "Σ": "\\Sigma ",
  "Φ": "\\Phi ",
  "Ψ": "\\Psi ",
  "Ω": "\\Omega ",
};

/**
 * Funksiya nomlari.
 *
 * KaTeX'da oddiy yozilgan "log" uchta ko'paytuvchi deb qiyshaytirib
 * chiziladi. To'g'ri ko'rinishi uchun u alohida buyruq bo'lishi
 * kerak. `tg`, `ctg`, `lg` KaTeX'da tayyor emas — `\\operatorname`
 * bilan yoziladi.
 */
const FUNCTION: Record<string, string> = {
  arcsin: "\\arcsin",
  arccos: "\\arccos",
  arctg: "\\operatorname{arctg}",
  arcctg: "\\operatorname{arcctg}",
  arctan: "\\arctan",
  sinh: "\\sinh",
  cosh: "\\cosh",
  sin: "\\sin",
  cos: "\\cos",
  tg: "\\operatorname{tg}",
  ctg: "\\operatorname{ctg}",
  tan: "\\tan",
  cot: "\\cot",
  sec: "\\sec",
  log: "\\log",
  ln: "\\ln",
  lg: "\\lg",
  lim: "\\lim",
  max: "\\max",
  min: "\\min",
  deg: "\\deg",
};

function toMathText(text: string): string {
  let out = "";

  for (const ch of text) {
    out += SYMBOL[ch] ?? ch;
  }

  /* ". . ." -> \ldots */
  return out.replace(/\.\s*\.\s*\./g, "\\ldots ");
}

/* ------------------------------------------------------------------ */
/* O'lcham                                                             */
/* ------------------------------------------------------------------ */

/**
 * Eng ko'p ishlatilgan shrift balandligi — "asosiy matn" o'lchami.
 * Undan kichiklari daraja, indeks yoki izoh bo'ladi.
 *
 * Belgilar soni bo'yicha sanaymiz: sarlavha yirik bo'lsa ham
 * belgisi kam, shuning uchun u asosiy o'lcham bo'lib qolmaydi.
 */
function baseHeight(items: Item[]): number {
  const weight = new Map<number, number>();

  for (const item of items) {
    const key = Math.round(item.h * 2) / 2;
    weight.set(key, (weight.get(key) ?? 0) + item.text.length);
  }

  const sorted = [...weight.entries()].sort((a, b) => b[1] - a[1]);

  return sorted.length > 0 ? sorted[0][0] : 12;
}

const isSmall = (item: Item, base: number) => !item.math && item.h < base - 0.6;

/* ------------------------------------------------------------------ */
/* Bo'lakni LaTeX'ga                                                   */
/* ------------------------------------------------------------------ */

/**
 * Bir guruh bo'lakni LaTeX'ga aylantirish (kasr suratidek).
 *
 * Guruh ichida ham daraja va indeks bo'lishi mumkin, shuning
 * uchun bu yerda ham balandlik tekshiriladi.
 */
function toLatex(items: Item[], base: number): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const big = sorted.filter((item) => !isSmall(item, base));

  /* Guruhning "o'z" qatori — eng ko'p bo'lak qaysi balandlikda */
  const line = big.length > 0 ? big[0].y : sorted[0]?.y ?? 0;

  let out = "";
  let open: "sup" | "sub" | null = null;

  for (const item of sorted) {
    const small = isSmall(item, base);
    const dy = item.y - line;

    const kind: "sup" | "sub" | null = small
      ? dy > base * 0.12
        ? "sup"
        : dy < -base * 0.08
          ? "sub"
          : null
      : null;

    if (kind !== open) {
      if (open) out += "}";
      if (kind === "sup") out += "^{";
      if (kind === "sub") out += "_{";
      open = kind;
    }

    const piece = item.math ? item.text : toMathText(item.text);

    const needsSpace =
      !kind && out.length > 0 && !/[\s^_{]$/.test(out) && !/^[\s]/.test(piece);

    out += (needsSpace ? " " : "") + piece;
  }

  if (open) out += "}";

  return (
    out
      .replace(/\s+/g, " ")
      /* "^{- 2}" emas, "^{-2}": ishora sondan ajralmasin */
      .replace(/([{(^_]\s*)([+-])\s+/g, "$1$2")
      .trim()
  );
}

/* ------------------------------------------------------------------ */
/* Kasr, ildiz, qavs                                                   */
/* ------------------------------------------------------------------ */

/**
 * Chiziq tagidagi matn uni deyarli to'liq egallaydimi.
 *
 * Nega kerak: "ustiga chiziq" (`\overline`) ni jadval chizig'idan
 * yoki ajratuvchi chiziqdan farqlash. Haqiqiy ustki chiziq matn
 * ustiga tortiladi va aynan shuncha uzun bo'ladi; tagida bitta
 * kichik bo'lak qolgan uzun chiziq esa `\overline` emas.
 */
/**
 * Chiziq tagidagi narsa sarlavhami ("1-test").
 *
 * Ba'zi fayllarda savol sarlavhasi ramka ichida yoki tagi
 * chizilgan holda turadi. Uni `\overline` deb o'qisak, sarlavha
 * yo'qoladi va butun fayl ajratilmay qoladi.
 */
function isLabel(below: Item[]): boolean {
  const text = [...below]
    .sort((a, b) => a.x - b.x)
    .map((item) => item.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return /^\d{1,2}\s*-\s*(test|variant)$/i.test(text);
}

function isCovered(below: Item[], rule: Rule): boolean {
  if (below.length === 0) return false;

  const left = Math.min(...below.map((item) => item.x));
  const right = Math.max(...below.map((item) => item.x + item.w));
  const width = rule.x1 - rule.x0;

  return width > 0 && (right - left) / width > 0.55;
}

/**
 * Chizma qatlamidagi chiziqlar bo'yicha kasr va ildizni tiklash.
 *
 * Tartib muhim: chiziqlar ENIDAN kichikdan kattaga qarab ko'riladi,
 * shunda ichma-ich kasr ham to'g'ri yig'iladi — ichkisi avval
 * bitta bo'lakka aylanadi, tashqisi uni tayyor holda ko'radi.
 */
function buildFractions(
  items: Item[],
  rules: Rule[],
  base: number,
  pageWidth: number,
): Item[] {
  /*
   * Juda uzun chiziq — kasr emas, kolontitul tagidagi chiziq yoki
   * jadval cheti. Juda qisqasi — tire yoki nuqta.
   */
  const usable = rules
    .filter((rule) => {
      const width = rule.x1 - rule.x0;
      return width > 2.5 && width < pageWidth * 0.5;
    })
    .sort((a, b) => a.x1 - a.x0 - (b.x1 - b.x0));

  /*
   * RAMKA ichidagi chiziqlarni chiqarib tashlaymiz.
   *
   * Ba'zi fayllarda sarlavha ("1-test") to'rtburchak ramka ichiga
   * olinadi. Ramkaning ustki chizig'i matnning ustida turadi va
   * uni "son ustidagi chiziq" (`\overline`) deb o'qib yuborish
   * mumkin. Haqiqiy ustki chiziqning juftligi bo'lmaydi, ramkaники
   * esa aynan shu kenglikda ikkinchi chiziqqa ega.
   */
  const boxed = new Set<Rule>();

  for (const rule of usable) {
    for (const other of usable) {
      if (other === rule) continue;
      if (Math.abs(other.y - rule.y) < 1) continue;
      if (Math.abs(other.y - rule.y) > base * 3) continue;

      const overlap =
        Math.min(other.x1, rule.x1) - Math.max(other.x0, rule.x0);

      const narrower = Math.min(other.x1 - other.x0, rule.x1 - rule.x0);

      if (narrower > 0 && overlap / narrower > 0.7) boxed.add(rule);
    }
  }

  let pool = [...items];

  for (const rule of usable) {
    /*
     * Surat va maxraj chiziqning TAGIGA SIG'ADI.
     *
     * Markazini tekshirish yetarli emas: "Hisoblang:" so'zining
     * markazi ham tasodifan chiziq ustiga tushishi mumkin, holbuki
     * u chiziqdan ancha keng. Shuning uchun butun bo'lak chiziq
     * ichida turishini talab qilamiz.
     */
    const inside = (item: Item) =>
      item.x > rule.x0 - 2.5 && item.x + item.w < rule.x1 + 2.5;

    const above = pool.filter(
      (item) =>
        inside(item) && item.y > rule.y + 0.4 && item.y <= rule.y + base * 0.95,
    );

    const below = pool.filter(
      (item) =>
        inside(item) && item.y < rule.y - 0.4 && item.y >= rule.y - base * 1.35,
    );

    /* Ildiz belgisi chiziqning chap tomonida turadi */
    const radical = pool.find(
      (item) =>
        item.text.includes("\u221A") &&
        item.x < rule.x0 + 1 &&
        item.x > rule.x0 - base * 1.5 &&
        Math.abs(item.y - (rule.y - base * 0.8)) < base * 1.2,
    );

    let built: Item | null = null;
    let used: Item[] = [];

    if (radical && below.length > 0) {
      /*
       * Ildiz ko'rsatkichi — belgining chap-tepasidagi kichik son
       * (kubik ildizdagi "3" kabi).
       */
      const degree = pool.filter(
        (item) =>
          isSmall(item, base) &&
          item.x < radical.x + base * 0.4 &&
          item.x > radical.x - base * 1.2 &&
          item.y > radical.y + base * 0.2 &&
          item.y < radical.y + base * 1.4,
      );

      const index = degree.length > 0 ? `[${toLatex(degree, base)}]` : "";

      built = {
        text: `\\sqrt${index}{${toLatex(below, base)}}`,
        x: degree.length > 0 ? Math.min(...degree.map((d) => d.x)) : radical.x,
        w: rule.x1 - radical.x,
        y: rule.y - base * 0.8,
        h: base,
        math: true,
      };
      used = [radical, ...degree, ...below];
    } else if (
      above.length === 0 &&
      !boxed.has(rule) &&
      !isLabel(below) &&
      isCovered(below, rule)
    ) {
      /*
       * USTIGA CHIZIQ — ikki ma'noda ishlatiladi:
       *   - "abcde" ustida: besh xonali son (raqamlari a, b, c, d, e)
       *   - "0,1(6)" dagi davriy kasr
       * Ikkalasi ham LaTeX'da `\overline{...}`.
       *
       * Kasrdan farqi: chiziqning TEPASIDA hech narsa yo'q.
       * Shuning uchun bu shart kasrdan KEYIN tekshiriladi.
       */
      built = {
        text: `\\overline{${toLatex(below, base)}}`,
        x: rule.x0,
        w: rule.x1 - rule.x0,
        y: Math.max(...below.map((item) => item.y)),
        h: base,
        math: true,
      };
      used = [...below];
    } else if (above.length > 0 && below.length > 0) {
      built = {
        text: `\\frac{${toLatex(above, base)}}{${toLatex(below, base)}}`,
        x: rule.x0,
        w: rule.x1 - rule.x0,
        /* Kasr qatorda chiziqdan biroz pastroqda turadi */
        y: rule.y - base * 0.3,
        h: base,
        math: true,
      };
      used = [...above, ...below];
    }

    if (!built) continue;

    /*
     * Kasrni o'rab turgan cho'zilgan qavs.
     *
     * LaTeX uni alohida belgi qilib chizadi va u suratdan ham
     * tepada turadi — shuning uchun oddiy qatorlashda "()" degan
     * ma'nosiz qator bo'lib ajralib qolardi. Topib, kasrga
     * qo'shib yuboramiz, qavsdan keyingi kichik bo'lak esa daraja.
     */
    const top = Math.max(...[...above, ...below].map((item) => item.y));
    const bottom = Math.min(...[...above, ...below].map((item) => item.y));

    const brackets = (text: string, open: boolean) =>
      open ? /^[([|]$/.test(text.trim()) : /^[)\]|]$/.test(text.trim());

    const near = (item: Item) =>
      item.y >= bottom - base * 0.6 && item.y <= top + base * 1.3;

    const left = pool.find(
      (item) =>
        !item.math &&
        brackets(item.text, true) &&
        near(item) &&
        item.x < rule.x0 &&
        item.x > rule.x0 - base * 2,
    );

    const right = pool.find(
      (item) =>
        !item.math &&
        brackets(item.text, false) &&
        near(item) &&
        item.x > rule.x1 - 2.5 &&
        item.x < rule.x1 + base * 2,
    );

    if (left && right) {
      built.text = `\\left(${built.text}\\right)`;
      built.x = left.x;
      built.w = right.x + right.w - left.x;
      used = [...used, left, right];

      const power = pool.filter(
        (item) =>
          isSmall(item, base) &&
          item.x >= right.x + right.w - 1.5 &&
          item.x < right.x + right.w + base * 1.6 &&
          item.y > right.y - base &&
          item.y < right.y + base * 1.6,
      );

      if (power.length > 0) {
        built.text += `^{${toLatex(power, base)}}`;
        built.w = Math.max(...power.map((item) => item.x + item.w)) - built.x;
        used = [...used, ...power];
      }
    }

    pool = pool.filter((item) => !used.includes(item));
    pool.push(built);
  }

  return pool;
}

/**
 * Pastdagi katta qavs: "y · y · ... · y" ustida, "14 ta" tagida.
 *
 * LaTeX uni `\underbrace{...}_{14 ta}` deb chizadi. Qavsning
 * o'zi matn qatlamida `⏟` va `⎷` belgilari bilan turadi.
 */
function buildBraces(
  items: Item[],
  rules: Rule[],
  base: number,
): { items: Item[]; rules: Rule[] } {
  /*
   * LaTeX bu qavslarni "presentation form" kodlari bilan chizadi
   * (U+FE37/U+FE38), oddiy U+23DE bilan emas — ikkalasini ham
   * qidiramiz, aks holda qavs umuman topilmaydi.
   */
  const marks = items.filter((item) =>
    /[\u23DE\u23DF\u23B4\u23B5\uFE37\uFE38]/.test(item.text),
  );

  if (marks.length === 0) return { items, rules };

  const y = marks[0].y;
  const row = marks.filter((item) => Math.abs(item.y - y) < base * 0.5);
  const x0 = Math.min(...row.map((item) => item.x));
  const x1 = Math.max(...row.map((item) => item.x + item.w));

  const inside = (item: Item) => item.x > x0 - 2 && item.x + item.w < x1 + 2;

  const above = items.filter(
    (item) => inside(item) && item.y > y + 0.4 && item.y <= y + base * 1.2,
  );

  /*
   * Faqat qavsning o'z yozuvi ("14 ta"). Oyna kengroq bo'lsa
   * pastdagi javob variantining darajasi ham ichkariga tushadi.
   */
  const below = items.filter(
    (item) => inside(item) && item.y < y - 0.4 && item.y >= y - base * 1.1,
  );

  if (above.length === 0) return { items, rules };

  /*
   * Qavsning o'z chiziqlari kasr chizig'i deb hisoblanmasin —
   * aks holda "y · y" ustidan soxta kasr yasaladi.
   */
  const kept = rules.filter(
    (rule) =>
      Math.abs(rule.y - y) > base * 0.7 ||
      rule.x1 < x0 - 2 ||
      rule.x0 > x1 + 2,
  );

  const label = below
    .sort((a, b) => a.x - b.x)
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const built: Item = {
    text: label
      ? `\\underbrace{${toLatex(above, base)}}_{\\text{${label}}}`
      : `\\underbrace{${toLatex(above, base)}}`,
    x: x0,
    w: x1 - x0,
    y: above[0].y,
    h: base,
    math: true,
  };

  const used = new Set<Item>([...row, ...above, ...below]);

  return {
    items: [...items.filter((item) => !used.has(item)), built],
    rules: kept,
  };
}

/* ------------------------------------------------------------------ */
/* Qatorlash                                                           */
/* ------------------------------------------------------------------ */

/**
 * Bo'laklarni qatorlarga yig'ish — IKKI BOSQICHDA.
 *
 * 1) Avval faqat asosiy o'lchamdagilar qator yasaydi.
 * 2) Keyin kichiklari (daraja, indeks) eng yaqin qatorga qo'shiladi.
 *
 * Tartib muhim: bir bosqichda qilsak, daraja o'zidan o'zi alohida
 * qator yasab oladi va "15 13 28 14" degan ma'nosiz qator chiqadi.
 */
function groupLines(items: Item[], base: number): Line[] {
  const big = items
    .filter((item) => !isSmall(item, base))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const small = items.filter((item) => isSmall(item, base));
  const lines: Line[] = [];

  for (const item of big) {
    const line = lines.find((row) => Math.abs(row.y - item.y) <= base * 0.35);

    if (line) {
      line.y = (line.y * line.count + item.y) / (line.count + 1);
      line.count += 1;
      line.items.push(item);
    } else {
      lines.push({ y: item.y, count: 1, items: [item] });
    }
  }

  for (const item of small) {
    let best: Line | null = null;
    let bestDistance = Infinity;

    for (const line of lines) {
      const dy = item.y - line.y;

      /* Daraja tepada, indeks pastda — lekin juda uzoqda emas */
      if (dy > base * 0.9 || dy < -base * 0.5) continue;

      if (Math.abs(dy) < bestDistance) {
        bestDistance = Math.abs(dy);
        best = line;
      }
    }

    if (best) best.items.push(item);
    else lines.push({ y: item.y, count: 0, items: [item] });
  }

  for (const line of lines) line.items.sort((a, b) => a.x - b.x);

  return lines.sort((a, b) => b.y - a.y);
}

/* ------------------------------------------------------------------ */
/* Qator -> matn                                                       */
/* ------------------------------------------------------------------ */

type Token = { text: string; math: boolean };

/**
 * Formulani oxirgi marta tozalash.
 *
 * Ishora sondan ajralib qolmasin ("^{- 2}" emas, "^{-2}") va
 * ortiqcha bo'shliq bo'lmasin.
 */
function tidyMath(text: string): string {
  const names = Object.keys(FUNCTION).join("|");

  return text
    .replace(/\s+/g, " ")
    /*
     * "log" -> "\\log". Oldidan teskari chiziq yoki harf bo'lsa
     * tegilmaydi: "\\left" ichidagi yoki "xlog" kabi nomlar
     * buzilmasin.
     */
    .replace(
      /*
       * `\\b` yaramaydi: "log_{2}" da `_` ham "so'z belgisi"
       * hisoblanadi va chegara topilmaydi.
       */
      new RegExp(`(^|[^\\\\A-Za-z])(${names})(?![A-Za-z])`, "g"),
      (_match, head: string, name: string) => `${head}${FUNCTION[name]} `,
    )
    .replace(/([{(^_]\s*)([+-])\s+/g, "$1$2")
    .replace(/^\s*([+-])\s+/, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    /* "\\log _{2}" emas, "\\log_{2}" */
    .replace(/\s+([_^])/g, "$1")
    .trim();
}

/** Faqat amal belgisi — ikki formula orasida bo'lsa ichiga olinadi */
const OPERATOR = /^[+\-−·×÷=<>≤≥:/]$/;

/**
 * Qatorni matnga aylantirish.
 *
 * Matematika `$...$` ichiga olinadi — saytdagi `MathText` aynan
 * shu belgini qidiradi. Oddiy matn tegilmaydi: "Hisoblang:" ni
 * formula ichiga solib qo'ysak KaTeX uni qiyshaytirib chizadi.
 */
function lineToText(line: Line, base: number): string {
  const tokens: Token[] = [];

  for (const item of line.items) {
    const small = isSmall(item, base);
    const dy = item.y - line.y;

    const kind: "sup" | "sub" | null = small
      ? dy > base * 0.12
        ? "sup"
        : dy < -base * 0.08
          ? "sub"
          : null
      : null;

    if (kind && tokens.length > 0) {
      /*
       * Daraja qavsdan keyin kelsa — "(−1)^12" — butun qavs
       * ichidagisi bitta formulaga aylanadi. Aks holda daraja
       * faqat "1)" ga yopishib, "(− $1)^{12}$" degan buzuq
       * natija chiqadi.
       */
      if (!tokens[tokens.length - 1].math && /\)\s*$/.test(tokens[tokens.length - 1].text)) {
        let start = -1;

        /*
         * Tayyor formulalar ham guruhga kiradi: "(x^2 y^5)^3" da
         * qavs ichida allaqachon formulaga aylangan bo'laklar bor.
         */
        for (let i = tokens.length - 1; i >= 0; i -= 1) {
          if (tokens[i].text.includes("(")) {
            start = i;
            break;
          }
        }

        if (start !== -1) {
          const head = tokens[start].text;
          const cut = head.lastIndexOf("(");
          const before = head.slice(0, cut);

          const group = [
            head.slice(cut),
            ...tokens.slice(start + 1).map((token) => token.text),
          ].join(" ");

          tokens.length = start;

          if (before.trim()) tokens.push({ text: before, math: false });

          tokens.push({ text: toMathText(group), math: true });
        }
      }

      /*
       * Daraja o'zidan oldingi bo'lakka yopishadi — lekin butun
       * bo'lakka emas, uning OXIRGI SO'ZIGA. Aks holda "Hisoblang:
       * log" bitta bo'lak bo'lib kelsa, "Hisoblang:" ham formula
       * ichiga tushib, KaTeX uni qiyshaytirib chizadi.
       */
      const head = tokens[tokens.length - 1];

      if (!head.math) {
        const cut = head.text.trimEnd().lastIndexOf(" ");

        if (cut > 0) {
          const tail = head.text.trimEnd().slice(cut + 1);
          head.text = head.text.trimEnd().slice(0, cut);
          tokens.push({ text: toMathText(tail), math: true });
        } else {
          head.text = toMathText(head.text);
          head.math = true;
        }
      }

      const prev = tokens[tokens.length - 1];

      const mark = kind === "sup" ? "^" : "_";
      const inner = toMathText(item.text);

      /* Ketma-ket kelgan darajalar bitta qavs ichida qolsin */
      const tail = new RegExp(`\\${mark}\\{([^{}]*)\\}$`);
      const match = prev.text.match(tail);

      prev.text = match
        ? prev.text.replace(tail, `${mark}{${match[1]}${inner}}`)
        : `${prev.text}${mark}{${inner}}`;

      continue;
    }

    tokens.push(
      item.math
        ? { text: item.text, math: true }
        : { text: item.text, math: false },
    );
  }

  /* Ikki formula orasidagi amal belgisi formulaga qo'shiladi */
  for (let i = 1; i < tokens.length - 1; i += 1) {
    const prev = tokens[i - 1];
    const next = tokens[i + 1];

    if (
      !tokens[i].math &&
      prev.math &&
      next.math &&
      OPERATOR.test(tokens[i].text.trim())
    ) {
      tokens[i] = { text: toMathText(tokens[i].text.trim()), math: true };
    }
  }

  /*
   * Formuladan oldingi yolg'iz ishora ham ichkariga kiradi:
   * "A) \u2212 7/40" -> "A) $-\\frac{7}{40}$".
   */
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const prev = i > 0 ? tokens[i - 1] : null;

    if (
      !tokens[i].math &&
      tokens[i + 1].math &&
      (!prev || !prev.math) &&
      /^[+\-\u2212]$/.test(tokens[i].text.trim())
    ) {
      tokens[i] = { text: toMathText(tokens[i].text.trim()), math: true };
    }
  }

  /* Yonma-yon formulalar bitta `$...$` ichiga birlashadi */
  const merged: Token[] = [];

  for (const token of tokens) {
    const last = merged[merged.length - 1];

    if (last && last.math && token.math) {
      last.text = `${last.text} ${token.text}`;
    } else {
      merged.push({ ...token });
    }
  }

  /*
   * Yopiluvchi qavs formuladan tashqarida qolib ketgan bo'lsa
   * ichkariga qaytaramiz: "$(a + b$)." emas, "$(a + b)$.".
   */
  for (let i = 0; i < merged.length - 1; i += 1) {
    const token = merged[i];
    const next = merged[i + 1];

    if (!token.math || next.math) continue;

    const open = (token.text.match(/\(/g) ?? []).length;
    const close = (token.text.match(/\)/g) ?? []).length;

    if (open > close && next.text.startsWith(")")) {
      token.text += ")";
      next.text = next.text.slice(1);
    }
  }

  let out = "";

  for (const token of merged) {
    const piece = token.math ? `$${tidyMath(token.text)}$` : token.text;

    const needsSpace =
      out.length > 0 && !/\s$/.test(out) && !/^[).,;:]/.test(piece);

    out += (needsSpace ? " " : "") + piece;
  }

  return out
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

/* ------------------------------------------------------------------ */
/* PDF o'qish                                                          */
/* ------------------------------------------------------------------ */

type PdfPage = {
  getTextContent: () => Promise<{ items: unknown[] }>;
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  view: number[];
};

/** Chizma qatlamidagi gorizontal chiziqlarni yig'ish */
async function pageRules(page: PdfPage): Promise<Rule[]> {
  const list = await page.getOperatorList();
  const rules: Rule[] = [];

  let ctm: Matrix = [...UNIT] as Matrix;
  const stack: Matrix[] = [];

  for (let i = 0; i < list.fnArray.length; i += 1) {
    const fn = list.fnArray[i];
    const args = list.argsArray[i];

    if (fn === OPS.save) {
      stack.push([...ctm] as Matrix);
      continue;
    }

    if (fn === OPS.restore) {
      ctm = stack.pop() ?? ([...UNIT] as Matrix);
      continue;
    }

    if (fn === OPS.transform) {
      ctm = mul(ctm, args as Matrix);
      continue;
    }

    if (fn === OPS.paintFormXObjectBegin) {
      stack.push([...ctm] as Matrix);
      ctm = mul(ctm, (args as Matrix[])[0]);
      continue;
    }

    if (fn === OPS.paintFormXObjectEnd) {
      ctm = stack.pop() ?? ([...UNIT] as Matrix);
      continue;
    }

    if (fn !== OPS.constructPath) continue;

    const [subOps, numbers] = args as [number[], number[]];
    let at = 0;
    let from: [number, number] | null = null;

    for (const op of subOps) {
      if (op === OPS.moveTo) {
        from = point(ctm, numbers[at], numbers[at + 1]);
        at += 2;
        continue;
      }

      if (op === OPS.lineTo) {
        const to = point(ctm, numbers[at], numbers[at + 1]);
        at += 2;

        if (from && Math.abs(to[1] - from[1]) < 0.7) {
          rules.push({
            x0: Math.min(from[0], to[0]),
            x1: Math.max(from[0], to[0]),
            y: (from[1] + to[1]) / 2,
          });
        }

        from = to;
        continue;
      }

      if (op === OPS.rectangle) {
        const [x, y, w, h] = numbers.slice(at, at + 4);
        at += 4;

        /* Yupqa to'rtburchak ham chiziq: ko'p dastur shunday chizadi */
        if (Math.abs(h) < 1.6) {
          const left = point(ctm, x, y);
          const right = point(ctm, x + w, y);

          rules.push({
            x0: Math.min(left[0], right[0]),
            x1: Math.max(left[0], right[0]),
            y: left[1],
          });
        }

        continue;
      }

      /* Boshqa amallar (egri chiziq) bizga kerak emas */
      at += 2;
    }
  }

  /*
   * Bir chiziq ikki marta chizilgan bo'lishi mumkin (ramkaning
   * cheti ham chiziladi, ham bo'yaladi). Takrorini olib
   * tashlamasak, ustki chiziq ikki qavat bo'lib qo'yiladi:
   * `\overline{\overline{...}}`.
   */
  const unique: Rule[] = [];

  for (const rule of rules) {
    const same = unique.find(
      (other) =>
        Math.abs(other.y - rule.y) < 0.6 &&
        Math.abs(other.x0 - rule.x0) < 0.6 &&
        Math.abs(other.x1 - rule.x1) < 0.6,
    );

    if (!same) unique.push(rule);
  }

  return unique;
}

/** PDF (bayt) -> qatorlar ro'yxati */
export async function extractLines(buffer: Buffer): Promise<ExtractResult> {
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    /*
     * Shriftlarni tizimdan yuklash kerak emas — bizga faqat matn
     * va uning o'rni kerak. Serverda shrift yuklash xato beradi.
     */
    useSystemFonts: false,
    disableFontFace: true,
    /* Serverda xavfsizroq va tezroq */
    isEvalSupported: false,
  }).promise;

  const lines: PdfLine[] = [];

  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = (await doc.getPage(number)) as unknown as PdfPage;
    const content = await page.getTextContent();

    const raw = content.items as Array<{
      str?: unknown;
      width?: number;
      height?: number;
      transform?: number[];
    }>;

    const items: Item[] = raw
      .filter(
        (item) =>
          typeof item.str === "string" &&
          item.str.trim().length > 0 &&
          Array.isArray(item.transform),
      )
      .map((item) => {
        const transform = item.transform as number[];

        return {
          text: item.str as string,
          x: transform[4],
          w: item.width ?? 0,
          y: transform[5],
          h: item.height ?? 0,
        };
      });

    if (items.length === 0) continue;

    const base = baseHeight(items);
    const width = page.view[2] - page.view[0];

    /*
     * Tartib muhim: avval katta qavs, keyin kasr. Qavsning o'z
     * chiziqlari bor, ular kasr chizig'i bilan adashtirilmasin.
     */
    const found = await pageRules(page);
    const braced = buildBraces(items, found, base);
    const withMath = buildFractions(braced.items, braced.rules, base, width);

    for (const line of groupLines(withMath, base)) {
      const text = lineToText(line, base);

      /*
       * Cho'zilgan qavslardan qolgan qoldiq ("() \u2212 1" kabi):
       * mazmuni allaqachon formulaga qo'shilgan, bu qator esa
       * savol matniga qo'shilib uni buzadi.
       */
      if (!text || (/\(\s*\)/.test(text) && text.length < 12)) continue;

      lines.push({ page: number, y: line.y, text });
    }
  }

  return { lines, pageCount: doc.numPages };
}
