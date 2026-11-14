/**
 * Milliy sertifikat variantlarini `.tex` dan öqiş.
 *
 * Manba: `content/milliy-sertifikat/` (yangi alifboda):
 *
 *   savollar/q_<sana>.tex   — bitta variant, 45 topşiriq va kalitlar
 *   yechimlar/s_<sana>.tex  — şu variantning yeçimlari
 *
 * Fayl tuzilişi (qcommon.tex makrolari):
 *
 *   \Variant{27.12.2025}
 *   \QQ{1}{matn ... \Opts{A}{B}{C}{D}}              1–32: test
 *   \QQ{33}{\Moslash{şart}{A)..F)}{33}{34}{35}}      33–35: moslaştiriş
 *   \QQ{36}{matn ... \AB{a) savol}{b) savol}}        36–45: yozma a/b
 *   \Javoblar{C A ... F}{\OK{36}{a}{b} ...}          kalitlar
 *
 *   \Savol{n} yeçim ... \Javob{...}                  yeçimlar fayli
 *
 * Bu fayl Next'ga ham, `scripts/` ga ham bog'liq emas — faqat
 * `tex-savollar.ts` dagi tayyor tozalaş funksiyasidan foydalanadi.
 */
import { cleanTex } from "./tex-savollar.ts";

export type MsChoice = {
  kind: "choice";
  number: number;
  text: string;
  figures: string[];
  options: { a: string; b: string; c: string; d: string };
  correct: "A" | "B" | "C" | "D";
  solution: MsSolution | null;
};

export type MsMatch = {
  kind: "match";
  /** 33 — blok 33, 34, 35-topşiriqlarni egallaydi */
  number: number;
  text: string;
  figures: string[];
  /** A–F javob variantlari */
  options: string[];
  parts: Array<{ number: number; text: string; correct: string }>;
  solution: MsSolution | null;
};

export type MsWritten = {
  kind: "written";
  number: number;
  text: string;
  figures: string[];
  parts: Array<{ label: "a" | "b"; text: string; answer: string }>;
  solution: MsSolution | null;
};

export type MsItem = MsChoice | MsMatch | MsWritten;

/**
 * Yeçim matni. Çizmalar matn içida `[[rasm:N]]` belgisi bilan turadi
 * (N — `figures` dagi tartib raqami). Import ularni rasmga aylantirib,
 * belgini `[[rasm:<bucket yöli>]]` ga almaştiradi.
 */
export type MsSolution = { text: string; figures: string[] };

export type MsVariant = {
  /** Fayl nomidagi kalit: `2025-12-27_1` */
  key: string;
  /** `27.12.2025` */
  date: string;
  /** Smena raqami (fayl nomidagi `_1`, `_2`), bölmasa null */
  shift: number | null;
  year: number;
  title: string;
  items: MsItem[];
  errors: string[];
};

/* ------------------------------------------------------------------ */
/* Qavslarni öqiş                                                      */
/* ------------------------------------------------------------------ */

/** `source[start]` — `{`. Mos `}` gaça bölgan içki matn va keyingi indeks */
export function readGroup(
  source: string,
  start: number,
): { inner: string; end: number } | null {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  if (source[i] !== "{") return null;

  let depth = 0;
  for (let j = i; j < source.length; j += 1) {
    const ch = source[j];
    if (ch === "\\") {
      j += 1; // `\{`, `\}`, `\\` — qavs emas
      continue;
    }
    if (ch === "%") {
      const nl = source.indexOf("\n", j);
      j = nl === -1 ? source.length : nl;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { inner: source.slice(i + 1, j), end: j + 1 };
    }
  }
  return null;
}

/** `\name{..}{..}` ning `count` ta argumenti */
function readArgs(source: string, from: number, count: number) {
  const args: string[] = [];
  let at = from;
  for (let k = 0; k < count; k += 1) {
    const group = readGroup(source, at);
    if (!group) return null;
    args.push(group.inner);
    at = group.end;
  }
  return { args, end: at };
}

/** Matndagi `\name{...}...` buyruqlarini topiş */
function findCommand(source: string, name: string, from = 0): number {
  const re = new RegExp(`\\\\${name}(?![A-Za-z])`, "g");
  re.lastIndex = from;
  const match = re.exec(source);
  return match ? match.index : -1;
}

/* ------------------------------------------------------------------ */
/* Çizmalar va matn                                                    */
/* ------------------------------------------------------------------ */

const FIGURE_ENVS = ["tikzpicture", "tabular"];

/**
 * Matndan çizmalarni kesib oliş: `\qfig{..}`, `\fig{..}` va
 * yalang'oç `tikzpicture` / `tabular`. `marker` berilsa, çizma
 * örniga `[[rasm:N]]` qöyiladi (yeçimlarda), aks holda öçiriladi.
 */
export function takeFigures(
  source: string,
  marker = false,
): { rest: string; figures: string[] } {
  const figures: string[] = [];
  let rest = source;

  const place = (raw: string) => {
    let figure = raw
      .trim()
      // Çizma TeX'ida qalin kursiv şrift (cmmib) yöq
      .replace(/\\(boldsymbol|bm)(?![A-Za-z])/g, "\\mathbf");
    // Jadval TikZ tugunida çiziladi — rasm TeX'i yalang'oç jadvalni çizmaydi
    if (figure.startsWith("\\begin{tabular}")) {
      figure = `\\begin{tikzpicture}\\node[inner sep=0pt]{${figure}};\\end{tikzpicture}`;
    }
    figures.push(figure);
    return marker ? `\n[[rasm:${figures.length - 1}]]\n` : " ";
  };

  for (const wrapper of ["qfig", "fig"]) {
    let at = findCommand(rest, wrapper);
    while (at !== -1) {
      const group = readGroup(rest, at + wrapper.length + 1);
      if (!group) break;
      const replacement = place(group.inner);
      rest = rest.slice(0, at) + replacement + rest.slice(group.end);
      at = findCommand(rest, wrapper, at + replacement.length);
    }
  }

  for (const env of FIGURE_ENVS) {
    const open = `\\begin{${env}}`;
    const close = `\\end{${env}}`;
    let at = rest.indexOf(open);
    while (at !== -1) {
      const endAt = rest.indexOf(close, at);
      if (endAt === -1) break;
      const figure = rest.slice(at, endAt + close.length);
      const replacement = place(figure);
      rest = rest.slice(0, at) + replacement + rest.slice(endAt + close.length);
      at = rest.indexOf(open, at + replacement.length);
    }
  }

  return { rest, figures };
}

/** KaTeX bilmaydigan operatorlar */
function katexMath(text: string): string {
  /*
   * Formula içidagi `\text{..}` ni `cleanTex` oçib taşlaydi
   * (`\cdot\text{EKUB}` -> `\cdotEKUB`). KaTeX `\hbox` ni ham
   * matn deb çizadi, `cleanTex` esa unga tegmaydi.
   */
  const protectedText = text.replace(
    /\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\[[\s\S]*?\\\]/g,
    (math) => math.replace(/\\(text|textrm|mbox)\{/g, "\\hbox{"),
  );
  return protectedText
    .replace(/\\arcctg(?![A-Za-z])/g, "\\operatorname{arcctg}")
    .replace(/\\arctg(?![A-Za-z])/g, "\\operatorname{arctg}")
    .replace(/\\ctg(?![A-Za-z])/g, "\\operatorname{ctg}")
    .replace(/\\tg(?![A-Za-z])/g, "\\operatorname{tg}");
}

/** Formuladan taşqaridagi matnga `fn` ni qöllaş */
function outsideMath(text: string, fn: (plain: string) => string): string {
  return text
    .split(/(\$\$[\s\S]*?\$\$|\$[^$]*\$)/)
    .map((piece, index) => (index % 2 === 1 ? piece : fn(piece)))
    .join("");
}

/** Bir qator matnni saytga yaroqli holga keltiriş */
function cleanLine(text: string): string {
  const cleaned = cleanTex(
    katexMath(text)
      .replace(/\\renewcommand\\?[A-Za-z]+(\{[^{}]*\})?\{[^{}]*\}/g, " ")
      .replace(/\\(scriptsize|footnotesize|small|normalsize|large|Large)(?![A-Za-z])/g, " ")
      .replace(/\\textcolor\{[^{}]*\}/g, "")
      .replace(/\\color\{[^{}]*\}/g, " ")
      .replace(/\\Izoh\{/g, "Izoh: {"),
  )
    .replace(/(^|[^\\])\{\s*\}/g, "$1")
    .replace(/^[{}\s]+$/, "")
    .trim();

  return outsideMath(cleaned, (plain) =>
    plain
      .replace(/\\q?quad(?![A-Za-z])/g, " ")
      // Formuladan taşqaridagi guruh qavslari (`{\color{aux} ...}` qoldiği)
      .replace(/(^|[^\\])[{}]+/g, "$1")
      .replace(/ {2,}/g, " "),
  ).trim();
}

/**
 * Köp qatorli matn: `\\`, `\par` va böş qator — yangi qator.
 * Formula muhitlari içidagi `\\` saqlanadi (`cleanTex` qoidasi).
 */
export function cleanBlock(raw: string): string {
  const source = raw
    // `10\,\$` — dollar belgisi; saytda `$` formula boşlaydi
    .replace(/\\\$/g, "dollar")
    .replace(/\\ShowJavoblar(?![A-Za-z])/g, "")
    .replace(/\\phantom\{[^{}]*\}/g, "")
    // Röyxatlar: har band yangi qatordan "• " bilan
    .replace(/\\begin\{(itemize|enumerate)\}(\[[^\]]*\])?/g, "")
    .replace(/\\end\{(itemize|enumerate)\}/g, "\\par ")
    .replace(/\\setlength\{[^{}]*\}\{[^{}]*\}/g, "")
    .replace(/\\itemsep\s*-?[\d.]+[a-z]*/g, "")
    .replace(/\\item(?![A-Za-z])\s*/g, "\\par • ");
  const MATH = /\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\begin\{(cases|aligned|gathered|array|align\*?|gather\*?)\}[\s\S]*?\\end\{\1\}/g;
  const BREAK = "\u0000YQ\u0000";

  const parts: string[] = [];
  let last = 0;
  for (const match of source.matchAll(MATH)) {
    const before = source.slice(last, match.index);
    parts.push(
      before
        .replace(/\\\\(\[[^\]]*\])?/g, BREAK)
        .replace(/\\par(?![A-Za-z])/g, BREAK)
        .replace(/\n\s*\n/g, BREAK),
    );
    parts.push(match[0]);
    last = (match.index ?? 0) + match[0].length;
  }
  parts.push(
    source
      .slice(last)
      .replace(/\\\\(\[[^\]]*\])?/g, BREAK)
      .replace(/\\par(?![A-Za-z])/g, BREAK)
      .replace(/\n\s*\n/g, BREAK),
  );

  return parts
    .join("")
    .split(BREAK)
    .map((line) => {
      const marker = /^\s*\[\[rasm:\d+\]\]\s*$/.test(line);
      if (marker) return line.trim();
      // Rasm belgisi qator içida qolgan bölsa ham alohida qatorga
      return line
        .split(/(\[\[rasm:\d+\]\])/)
        .map((piece) => (/^\[\[rasm:\d+\]\]$/.test(piece) ? `\n${piece}\n` : cleanLine(piece)))
        .join("")
        .trim();
    })
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{2,}/g, "\n");
}

/* ------------------------------------------------------------------ */
/* Savollar fayli                                                      */
/* ------------------------------------------------------------------ */

function splitQQ(source: string): Map<number, string> {
  const result = new Map<number, string>();
  let at = findCommand(source, "QQ");
  while (at !== -1) {
    const parsed = readArgs(source, at + 3, 2);
    if (!parsed) break;
    result.set(Number(parsed.args[0]), parsed.args[1]);
    at = findCommand(source, "QQ", parsed.end);
  }
  return result;
}

/** `A) x \par B) y ...` → [x, y, ...] */
function splitLetterOptions(source: string): string[] {
  const pieces = source.split(/(?:^|\\par)\s*([A-F])\)\s*/);
  const options: string[] = [];
  for (let i = 1; i < pieces.length; i += 2) {
    options.push(cleanBlock(pieces[i + 1] ?? ""));
  }
  return options;
}

function parseAnswers(source: string) {
  const at = findCommand(source, "Javoblar");
  if (at === -1) return null;
  const parsed = readArgs(source, at + "\\Javoblar".length, 2);
  if (!parsed) return null;

  const letters = parsed.args[0].trim().split(/\s+/);
  const open = new Map<number, { a: string; b: string }>();
  let okAt = findCommand(parsed.args[1], "OK");
  while (okAt !== -1) {
    const ok = readArgs(parsed.args[1], okAt + 3, 3);
    if (!ok) break;
    open.set(Number(ok.args[0]), {
      a: cleanLine(ok.args[1]),
      b: cleanLine(ok.args[2]),
    });
    okAt = findCommand(parsed.args[1], "OK", ok.end);
  }
  return { letters, open };
}

/* ------------------------------------------------------------------ */
/* Yeçimlar fayli                                                      */
/* ------------------------------------------------------------------ */

export function parseSolutions(source: string): Map<number, MsSolution> {
  const result = new Map<number, MsSolution>();
  const body = source.replace(/(^|[^\\])%.*$/gm, "$1");
  const starts: Array<{ n: number; at: number; end: number }> = [];

  for (const match of body.matchAll(/\\Savol\{(\d+)\}/g)) {
    starts.push({
      n: Number(match[1]),
      at: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    });
  }

  starts.forEach((start, index) => {
    const stop = index + 1 < starts.length ? starts[index + 1].at : body.length;
    let chunk = body
      .slice(start.end, stop)
      .replace(/\\(newpage|clearpage|end\{document\})/g, "");

    /* \Javob{...} → "Javob: ..." qatori */
    const javobAt = findCommand(chunk, "Javob");
    if (javobAt !== -1) {
      const group = readGroup(chunk, javobAt + "\\Javob".length);
      if (group) {
        chunk =
          chunk.slice(0, javobAt) +
          `\\par Javob: ${group.inner}` +
          chunk.slice(group.end);
      }
    }

    const { rest, figures } = takeFigures(chunk, true);
    result.set(start.n, { text: cleanBlock(rest), figures });
  });

  return result;
}

/* ------------------------------------------------------------------ */
/* Variant                                                             */
/* ------------------------------------------------------------------ */

function variantMeta(fileKey: string, dateArg: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:_(\d+))?$/.exec(fileKey);
  const year = match ? Number(match[1]) : 0;
  const date =
    dateArg?.trim() || (match ? `${match[3]}.${match[2]}.${match[1]}` : fileKey);
  const shift = match?.[4] ? Number(match[4]) : null;
  /* Ba'zi fayllarda smena sananing özida yozilgan */
  const title = shift && !/smena/i.test(date) ? `${date} (${shift}-smena)` : date;
  return { year, date, shift, title };
}

export function parseVariant(
  fileKey: string,
  questionSource: string,
  solutionSource: string | null,
): MsVariant {
  const errors: string[] = [];
  const source = questionSource.replace(/(^|[^\\])%.*$/gm, "$1");

  const variantAt = findCommand(source, "Variant");
  const dateArg =
    variantAt === -1 ? null : readGroup(source, variantAt + "\\Variant".length)?.inner ?? null;
  const meta = variantMeta(fileKey, dateArg);

  const bodies = splitQQ(source);
  const answers = parseAnswers(source);
  const solutions = solutionSource ? parseSolutions(solutionSource) : new Map();

  if (!answers) errors.push("\\Javoblar topilmadi");

  const items: MsItem[] = [];

  for (const [number, body] of [...bodies.entries()].sort((a, b) => a[0] - b[0])) {
    const solution = solutions.get(number) ?? null;

    if (number === 33) {
      const at = findCommand(body, "Moslash");
      const parsed = at === -1 ? null : readArgs(body, at + "\\Moslash".length, 5);
      if (!parsed) {
        errors.push("33: \\Moslash öqilmadi");
        continue;
      }
      const stem = takeFigures(parsed.args[0]);
      const options = splitLetterOptions(parsed.args[1]);
      if (options.length !== 6) errors.push(`33: ${options.length} ta variant (6 kerak)`);

      items.push({
        kind: "match",
        number,
        text: cleanBlock(stem.rest),
        figures: stem.figures,
        options,
        parts: [33, 34, 35].map((n, k) => ({
          number: n,
          text: cleanBlock(parsed.args[2 + k]),
          correct: answers?.letters[n - 1] ?? "",
        })),
        solution,
      });
      continue;
    }

    const abAt = findCommand(body, "AB");
    if (abAt !== -1) {
      const parsed = readArgs(body, abAt + 3, 2);
      if (!parsed) {
        errors.push(`${number}: \\AB öqilmadi`);
        continue;
      }
      const stem = takeFigures(body.slice(0, abAt) + body.slice(parsed.end));
      const key = answers?.open.get(number);
      if (!key) errors.push(`${number}: a/b kaliti yöq`);

      items.push({
        kind: "written",
        number,
        text: cleanBlock(stem.rest),
        figures: stem.figures,
        parts: [
          { label: "a", text: cleanBlock(parsed.args[0]), answer: key?.a ?? "" },
          { label: "b", text: cleanBlock(parsed.args[1]), answer: key?.b ?? "" },
        ],
        solution,
      });
      continue;
    }

    const optsAt = findCommand(body, "Opts");
    const parsed = optsAt === -1 ? null : readArgs(body, optsAt + "\\Opts".length, 4);
    if (!parsed) {
      errors.push(`${number}: \\Opts öqilmadi`);
      continue;
    }
    const stem = takeFigures(body.slice(0, optsAt) + body.slice(parsed.end));
    const correct = (answers?.letters[number - 1] ?? "") as MsChoice["correct"];
    if (!/^[ABCD]$/.test(correct)) errors.push(`${number}: kalit "${correct}"`);

    const [a, b, c, d] = parsed.args.map((option) => cleanBlock(option));
    items.push({
      kind: "choice",
      number,
      text: cleanBlock(stem.rest),
      figures: stem.figures,
      options: { a, b, c, d },
      correct,
      solution,
    });
  }

  const choiceCount = items.filter((item) => item.kind === "choice").length;
  const writtenCount = items.filter((item) => item.kind === "written").length;
  if (choiceCount !== 32) errors.push(`${choiceCount} ta test savoli (32 kerak)`);
  if (writtenCount !== 10) errors.push(`${writtenCount} ta a/b savol (10 kerak)`);
  if (!items.some((item) => item.kind === "match")) errors.push("33–35 yöq");

  return { key: fileKey, ...meta, items, errors };
}

/** Çizma hujjatining sozlamalari: ranglar, uslublar, kutubxonalar */
export const MS_FIGURE_SETUP = [
  "\\usetikzlibrary{calc,arrows.meta,positioning,decorations.pathreplacing,angles,quotes,patterns}",
  "\\definecolor{qfill}{HTML}{A9C8F2}",
  "\\definecolor{qfill2}{HTML}{6FA3E8}",
  "\\definecolor{msblue}{HTML}{1F3A7A}",
  "\\definecolor{aux}{HTML}{D1232A}",
  "\\definecolor{okgreen}{HTML}{1B7F3B}",
  "\\definecolor{hdrblue}{HTML}{BCD3F2}",
  "\\tikzset{ax/.style={draw=aux,thick,dashed},axs/.style={draw=aux,thick},pt/.style={circle,fill,inner sep=1.1pt},lbl/.style={font=\\small,fill=white,inner sep=1pt}}",
  "\\DeclareMathOperator{\\tg}{tg}",
  "\\DeclareMathOperator{\\ctg}{ctg}",
  "\\DeclareMathOperator{\\arctg}{arctg}",
  "\\DeclareMathOperator{\\arcctg}{arcctg}",
];
