/**
 * Yozma javobni kalit bilan solişti riş — ma'nosi böyiça.
 *
 * Bazadagi tekşiruv javobni harfma-harf solişti radi: "-17/4" va
 * kalitdagi "$-\dfrac{17}4$" unga har xil matn. Bu fayl ikkalasini
 * ham son sifatida hisoblaydi:
 *
 *   -17/4, -4,25, \frac{-17}{4}, -4\frac14   → hammasi −4,25
 *   2\sqrt3, \sqrt{12}                        → bir xil
 *   \frac{\pi}{8}, π/8                        → bir xil
 *
 * Bir nechta javob ";" bilan ajratiladi ("2; 3" = "3; 2").
 * Hisoblab bölmaydigan javob (oraliq, toplam, ifoda) tozalangan
 * matn sifatida solişti riladi.
 *
 * Fayl heç narsa import qilmaydi — `tests/` dan töğridan-töğri
 * çaqiriladi.
 */

const EPS = 1e-9;

/* ------------------------------------------------------------------ */
/* Tozalaş                                                             */
/* ------------------------------------------------------------------ */

export function normalizeAnswer(raw: string): string {
  let s = String(raw ?? "").trim();

  // $...$, $$...$$, \( \), \[ \]
  s = s.replace(/^\$+|\$+$/g, "").replace(/^\\[([]|\\[)\]]$/g, "");

  s = s
    .replace(/\\(left|right|displaystyle|textstyle|bigl|bigr|Bigl|Bigr|big|Big)(?![A-Za-z])/g, "")
    .replace(/\\[dt]frac(?![A-Za-z])/g, "\\frac")
    .replace(/\\operatorname\{([a-z]+)\}/g, "\\$1")
    .replace(/\\mathrm\{([a-z]+)\}/g, "\\$1")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\(,|;|!|:| |quad|qquad)/g, " ")
    .replace(/\{,\}/g, ".")
    .replace(/(\d)\s*,\s*(?=\d)/g, "$1.")
    .replace(/\\cdot|\\times|·|×/g, "*")
    .replace(/÷|\\div/g, "/")
    .replace(/−|–/g, "-")
    .replace(/π/g, "\\pi ")
    .replace(/√/g, "\\sqrt")
    .replace(/∞/g, "\\infty ")
    .replace(/\^\s*\{?\s*\\circ\s*\}?|°|\\degree/g, "")
    .replace(/\\%|%/g, "");

  // "x = 5", "a=2" → "5"
  s = s.replace(/^\s*[a-zA-Z](_\{?\w+\}?)?\s*=\s*/, "");

  return s.trim();
}

/** Matn sifatida solişti riş uçun: böşliq va qavslarsiz */
function plainKey(s: string): string {
  return s.replace(/\s+/g, "").replace(/[{}]/g, "").toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Hisoblaş                                                            */
/* ------------------------------------------------------------------ */

type Token =
  | { t: "num"; v: string }
  | { t: "cmd"; v: string }
  | { t: "sym"; v: string }
  | { t: "var"; v: string };

function tokenize(s: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      tokens.push({ t: "num", v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "\\") {
      let j = i + 1;
      while (j < s.length && /[A-Za-z]/.test(s[j])) j += 1;
      if (j === i + 1) return null;
      tokens.push({ t: "cmd", v: s.slice(i + 1, j) });
      i = j;
      continue;
    }
    if ("+-*/^()[]{}_".includes(ch)) {
      tokens.push({ t: "sym", v: ch });
      i += 1;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      // sin, cos, tg, ln, log, lg, pi — "\" siz yozilgan bölsa ham
      const word = /^(arcsin|arccos|arctg|sin|cos|tg|ctg|ln|lg|log|pi|sqrt)/.exec(s.slice(i));
      if (word) {
        tokens.push({ t: "cmd", v: word[1] });
        i += word[1].length;
        continue;
      }
      tokens.push({ t: "var", v: ch });
      i += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tg: Math.tan,
  tan: Math.tan,
  ctg: (x) => 1 / Math.tan(x),
  cot: (x) => 1 / Math.tan(x),
  arcsin: Math.asin,
  arccos: Math.acos,
  arctg: Math.atan,
  arctan: Math.atan,
  ln: Math.log,
  lg: Math.log10,
};

class Parser {
  private pos = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isSym(v: string) {
    const t = this.peek();
    return t?.t === "sym" && t.v === v;
  }

  private expect(v: string) {
    if (!this.isSym(v)) throw new Error(`"${v}" kutilgan`);
    this.pos += 1;
  }

  parseAll(): number {
    const value = this.expr();
    if (this.pos !== this.tokens.length) throw new Error("ortiqça belgi");
    return value;
  }

  private expr(): number {
    let value = this.term();
    while (this.isSym("+") || this.isSym("-")) {
      const op = (this.peek() as Token).v;
      this.pos += 1;
      const right = this.term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  private startsPrimary(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.t === "num" || t.t === "cmd") return true;
    return t.t === "sym" && (t.v === "(" || t.v === "{" || t.v === "[");
  }

  private term(): number {
    let value = this.unary();
    for (;;) {
      if (this.isSym("*") || this.isSym("/")) {
        const op = (this.peek() as Token).v;
        this.pos += 1;
        const right = this.unary();
        value = op === "*" ? value * right : value / right;
        continue;
      }
      if (this.startsPrimary()) {
        value *= this.power();
        continue;
      }
      return value;
    }
  }

  private unary(): number {
    if (this.isSym("-")) {
      this.pos += 1;
      return -this.unary();
    }
    if (this.isSym("+")) {
      this.pos += 1;
      return this.unary();
    }
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    if (this.isSym("^")) {
      this.pos += 1;
      const exponent = this.isSym("-") ? (this.pos++, -this.arg()) : this.arg();
      return Math.pow(base, exponent);
    }
    return base;
  }

  /**
   * TeX argumenti: `{...}` yoki bitta belgi. `\frac17` → 1 va 7,
   * `\sqrt3`, `x^23` → daraja 2.
   */
  private arg(): number {
    const t = this.peek();
    if (!t) throw new Error("argument yöq");
    if (t.t === "sym" && t.v === "{") {
      this.pos += 1;
      const value = this.expr();
      this.expect("}");
      return value;
    }
    if (t.t === "num") {
      if (t.v.length > 1) {
        // Bitta raqam olinadi, qolgani joyida qoladi
        this.tokens.splice(this.pos, 1, { t: "num", v: t.v[0] }, { t: "num", v: t.v.slice(1) });
      }
      this.pos += 1;
      return Number(this.tokens[this.pos - 1].v);
    }
    return this.primary();
  }

  /** Keyingi argument faqat butun sondan iboratmi (`7` yoki `{17}`) */
  private intArgAhead(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.t === "num") return /^\d/.test(t.v);
    if (t.t === "sym" && t.v === "{") {
      const inner = this.tokens[this.pos + 1];
      const end = this.tokens[this.pos + 2];
      return inner?.t === "num" && /^\d+$/.test(inner.v) && end?.t === "sym" && end.v === "}";
    }
    return false;
  }

  private primary(): number {
    const t = this.peek();
    if (!t) throw new Error("ifoda tugadi");

    if (t.t === "num") {
      this.pos += 1;
      const value = Number(t.v);
      if (!Number.isFinite(value)) throw new Error("son notöğri");

      // Aralaş son: 6\frac14 = 6 + 1/4 (faqat butun son va butun kasr)
      const next = this.peek();
      if (/^\d+$/.test(t.v) && next?.t === "cmd" && next.v === "frac") {
        const save = this.pos;
        this.pos += 1;
        if (this.intArgAhead()) {
          const n = this.arg();
          if (this.intArgAhead()) {
            const d = this.arg();
            return value + n / d;
          }
        }
        this.pos = save;
      }
      return value;
    }

    if (t.t === "sym") {
      if (t.v === "(" || t.v === "[") {
        this.pos += 1;
        const value = this.expr();
        this.expect(t.v === "(" ? ")" : "]");
        return value;
      }
      if (t.v === "{") {
        this.pos += 1;
        const value = this.expr();
        this.expect("}");
        return value;
      }
      throw new Error(`kutilmagan "${t.v}"`);
    }

    if (t.t === "var") throw new Error("özgaruvçi bor");

    // Buyruq
    this.pos += 1;
    switch (t.v) {
      case "pi":
        return Math.PI;
      case "frac": {
        const n = this.arg();
        const d = this.arg();
        return n / d;
      }
      case "sqrt": {
        let index = 2;
        if (this.isSym("[")) {
          this.pos += 1;
          index = this.expr();
          this.expect("]");
        }
        const x = this.arg();
        if (x < 0 && Math.round(index) % 2 === 1) return -Math.pow(-x, 1 / index);
        return Math.pow(x, 1 / index);
      }
      case "log": {
        let base = 10;
        if (this.isSym("_")) {
          this.pos += 1;
          base = this.arg();
        }
        const x = this.power();
        return Math.log(x) / Math.log(base);
      }
      default: {
        const fn = FUNCS[t.v];
        if (!fn) throw new Error(`nomalum buyruq ${t.v}`);
        // \sin^2 x
        if (this.isSym("^")) {
          this.pos += 1;
          const exponent = this.arg();
          return Math.pow(fn(this.power()), exponent);
        }
        return fn(this.power());
      }
    }
  }
}

/** Javobni son sifatida hisoblaş; bölmasa null */
export function evaluateAnswer(raw: string): number | null {
  const s = normalizeAnswer(raw);
  if (!s || /\\infty|[<>≤≥∪∩∈]|\\(cup|cap|in|le|ge|lt|gt|neq?)(?![A-Za-z])/.test(s)) return null;
  const tokens = tokenize(s);
  if (!tokens || tokens.length === 0) return null;
  try {
    const value = new Parser(tokens).parseAll();
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Yuqori darajadagi ";" böyiça bölaklar */
function splitList(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of s) {
    if ("({[".includes(ch)) depth += 1;
    if (")}]".includes(ch)) depth -= 1;
    if (ch === ";" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function close(a: number, b: number) {
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Öquvçi javobi kalitdagi javobga (yoki muqobillardan biriga) tengmi.
 */
export function answersEquivalent(given: string, key: string): boolean {
  const a = normalizeAnswer(given);
  const b = normalizeAnswer(key);
  if (!a || !b) return false;
  if (plainKey(a) === plainKey(b)) return true;

  const listA = splitList(a);
  const listB = splitList(b);
  if (listA.length !== listB.length) return false;

  const valuesA = listA.map(evaluateAnswer);
  const valuesB = listB.map(evaluateAnswer);

  if (valuesA.every((v) => v !== null) && valuesB.every((v) => v !== null)) {
    const rest = [...(valuesB as number[])];
    for (const value of valuesA as number[]) {
      const at = rest.findIndex((other) => close(value, other));
      if (at === -1) return false;
      rest.splice(at, 1);
    }
    return true;
  }

  return false;
}

export function matchesAnyKey(given: string, keys: Array<string | null | undefined>): boolean {
  return keys.some((key) => typeof key === "string" && answersEquivalent(given, key));
}
