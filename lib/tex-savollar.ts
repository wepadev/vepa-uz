/**
 * LaTeX manbadan testni o'qish.
 *
 * NEGA BU PDF'DAN KO'RA YAXSHI.
 * PDF'da formula "matn" emas — daraja boshqa joyda, kasr chizig'i
 * esa chizma qatlamida. Uni koordinatadan tiklash kerak va ba'zi
 * joyda tiklanmaydi. `.tex` da esa matematika allaqachon LaTeX
 * ko'rinishida yozilgan: `\frac{3}{5}`, `\overline{24a671}`.
 * Demak taxmin ham, model ham, token ham kerak emas.
 *
 * KUTILADIGAN TUZILISH:
 *
 *     \testboshi{Mavzu nomi}{1}
 *     \begin{testlar}
 *         \item Savol matni $x^2$
 *         \begin{variantlar}
 *             \item $8$
 *             \item $5$
 *             \item $7$
 *             \item $6$
 *         \end{variantlar}
 *     \end{testlar}
 *
 * Bu fayl ATAYLAB hech narsa import qilmaydi — `tests/` dagi
 * testlar uni to'g'ridan-to'g'ri chaqiradi.
 */

export type TexQuestion = {
  number: number;
  text: string;
  options: { a: string; b: string; c: string; d: string };
  /** Shubhali joylar: bo'sh bo'lsa savol ishonchli o'qilgan */
  flags: string[];
  /**
   * Savoldagi chizmalar — XOM LaTeX bo'laklari (`tikzpicture`,
   * `\sonoqi{2}` kabi chizma buyrug'i, A)-D) jadvali). Matndan
   * olib tashlangan, rasmga `figureDocument` orqali aylantiriladi.
   */
  figures: string[];
  /** Testdagi asl o'rni: variantsiz topshiriqlar ham sanaladi (1 dan) */
  position?: number;
};

/**
 * Variantsiz ochiq topshiriq ("grafigini yasang"). Kalitda javobi
 * yo'q — testga ballsiz "Mustaqil ishlang" bo'lib qo'shiladi.
 */
export type TexOpenTask = {
  /** Testdagi asl o'rni (savollar bilan birga sanaladi, 1 dan) */
  position: number;
  text: string;
  figures: string[];
};

export type TexTest = {
  /** `\testboshi{...}{N}` dagi N */
  number: number;
  title: string;
  questions: TexQuestion[];
  /** Variantsiz topshiriqlar; ular `questions` raqamlashiga kirmaydi */
  openTasks?: TexOpenTask[];
};

export type TexResult = {
  tests: TexTest[];
  errors: string[];
  /** Fayldagi ranglar, kutubxonalar va yordamchi buyruqlar */
  figures?: FigureContext;
};

/* ------------------------------------------------------------------ */
/* Tozalash                                                            */
/* ------------------------------------------------------------------ */

/**
 * `%` dan keyingi izohni olib tashlash.
 *
 * `\%` — bu izoh emas, foiz belgisi, unga tegilmaydi.
 */
function stripComments(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => {
      let out = "";

      for (let i = 0; i < line.length; i += 1) {
        if (line[i] === "%" && line[i - 1] !== "\\") break;
        out += line[i];
      }

      return out;
    })
    .join("\n");
}

/**
 * Matnga ta'sir qilmaydigan buyruqlar.
 *
 * Bular sahifa ko'rinishi uchun: bo'shliq, ustun, qator uzilishi.
 * Savol matnida ular keraksiz.
 */
const DROP = [
  /\\vspace\*?\{[^{}]*\}/g,
  /\\hspace\*?\{[^{}]*\}/g,
  /\\(columnbreak|newpage|clearpage|centering|noindent|smallskip|medskip|bigskip|par|nobreak|newline|linebreak)\b/g,
  /\\label\{[^{}]*\}/g,
  /\\\\(\[[^\]]*\])?/g,
  /* LaTeX bo'shliqlari: \\, \\; \\! va teskari chiziq + bo'shliq */
  /\\[,;!]|\\ /g,
];

/** `\textbf{x}` -> `x`: faqat matn qoladi */
function unwrap(text: string, name: string): string {
  const mark = `\\${name}{`;
  let out = text;
  let at = out.indexOf(mark);

  while (at !== -1) {
    let depth = 1;
    let i = at + mark.length;

    while (i < out.length && depth > 0) {
      if (out[i] === "{" && out[i - 1] !== "\\") depth += 1;
      if (out[i] === "}" && out[i - 1] !== "\\") depth -= 1;
      i += 1;
    }

    const inner = out.slice(at + mark.length, i - 1);
    out = out.slice(0, at) + inner + out.slice(i);
    at = out.indexOf(mark);
  }

  return out;
}

/**
 * Savol yoki variant matnini saytga yaroqli holga keltirish.
 *
 * Matematika `$...$` ichida qoladi — sayt uni aynan shu belgiga
 * qarab chizadi (`components/math-text.tsx`). Qolgan LaTeX
 * bezaklari olib tashlanadi.
 */
export function cleanTex(text: string): string {
  let out = text;

  for (const name of ["textbf", "textit", "emph", "text", "mbox", "textrm"]) {
    out = unwrap(out, name);
  }

  /* `peri\-met\-rini` — bo'g'in ko'chirish ishorasi, so'z bo'linmaydi */
  out = out.replace(/(?<!\\)\\-/g, "");

  for (const pattern of DROP) out = out.replace(pattern, " ");

  return out
    /*
     * `\\( ... \\)` va `\\[ ... \\]` ni `$ ... $` ga keltiramiz.
     * Sayt ikkalasini ham tushunadi, lekin bitta ko'rinishda
     * bo'lgani keyin tekshirishni osonlashtiradi.
     */
    /*
     * `[\s\S]` ataylab: `s` (dotAll) bayrog'i ES2018 dan,
     * loyiha esa ES2017 ga tuziladi.
     */
    .replace(/\\\(([\s\S]+?)\\\)/g, "$$$1$$")
    .replace(/\\\[([\s\S]+?)\\\]/g, "$$$$$1$$$$")
    .replace(/~/g, " ")
    .replace(/\\ldots\b/g, "...")
    .replace(/\\dots\b/g, "...")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:?!])/g, "$1")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Chizmalar                                                           */
/* ------------------------------------------------------------------ */

/*
 * Savoldagi chizma matnga aylanmaydi — u RASM bo'ladi.
 *
 * Fayllarda chizma uch xil yoziladi:
 *
 *   1. To'g'ridan-to'g'ri `\begin{tikzpicture} ... \end{tikzpicture}`
 *   2. Fayl boshida e'lon qilingan buyruq: `\sonoqi{2}`,
 *      `\kvparabola{...}` — ichida tikzpicture bor
 *   3. Variantlar jadvali: `\begin{tabular} A) <chizma> & B) ...`
 *
 * Avval bu bo'laklar savol matnidan kesib olinadi (aks holda
 * saytda `\sonoqi{1}` degan xom yozuv turib qoladi), keyin
 * `figureDocument` ularni alohida LaTeX hujjatga yig'adi — uni
 * server rasmga aylantiradi (lib/tex-chizma.ts).
 */

export type FigureMacro = {
  argc: number;
  /** E'lonning o'zi: `\newcommand{\sonoqi}[1]{...}` */
  source: string;
  /** Ichida chizma bormi (o'zi yoki chaqirgan buyrug'i orqali) */
  figure: boolean;
};

export type FigureContext = {
  macros: Record<string, FigureMacro>;
  /** `\definecolor`, `\colorlet`, `\usetikzlibrary`, `\tikzset` */
  setup: string[];
};

/** Bular sahifa uchun — chizmaga aloqasi yo'q */
const SKIP_MACROS = new Set(["variant"]);

const NEW_COMMAND =
  /\\(?:re|provide)?newcommand\*?\s*(?:\{\s*\\([A-Za-z]+)\s*\}|\\([A-Za-z]+))\s*(?:\[(\d)\])?\s*(?:\[[^\]]*\])?\s*\{/g;

const HAS_PICTURE = /\\begin\{tikzpicture\}|\\tikz(?![A-Za-z])/;

function mentions(source: string, name: string): boolean {
  return new RegExp(`\\\\${name}(?![A-Za-z])`).test(source);
}

/** Fayldan chizma uchun kerakli e'lonlarni yig'ish */
export function readFigureContext(source: string): FigureContext {
  const text = stripComments(source);
  const macros: Record<string, FigureMacro> = {};

  NEW_COMMAND.lastIndex = 0;
  let found = NEW_COMMAND.exec(text);

  while (found) {
    const name = found[1] ?? found[2];
    const open = found.index + found[0].length - 1;
    const body = readGroup(text, open);

    if (!SKIP_MACROS.has(name)) {
      macros[name] = {
        argc: Number(found[3] ?? 0),
        source: text.slice(found.index, body.end),
        figure: HAS_PICTURE.test(body.value),
      };
    }

    NEW_COMMAND.lastIndex = body.end;
    found = NEW_COMMAND.exec(text);
  }

  /* Chizma buyrug'ini chaqiradigan buyruq ham chizma */
  let changed = true;

  while (changed) {
    changed = false;

    for (const macro of Object.values(macros)) {
      if (macro.figure) continue;

      const calls = Object.entries(macros).some(
        ([other, item]) => item.figure && mentions(macro.source, other),
      );

      if (calls) {
        macro.figure = true;
        changed = true;
      }
    }
  }

  const setup: string[] = [];

  for (const pattern of [
    /\\definecolor\s*\{[^{}]*\}\s*\{[^{}]*\}\s*\{[^{}]*\}/g,
    /\\colorlet\s*\{[^{}]*\}\s*\{[^{}]*\}/g,
    /\\usetikzlibrary\s*\{[^{}]*\}/g,
  ]) {
    for (const item of text.match(pattern) ?? []) setup.push(item);
  }

  const TIKZSET = /\\tikzset\s*\{/g;
  let style = TIKZSET.exec(text);

  while (style) {
    const group = readGroup(text, style.index + style[0].length - 1);
    setup.push(text.slice(style.index, group.end));
    TIKZSET.lastIndex = group.end;
    style = TIKZSET.exec(text);
  }

  return { macros, setup };
}

/**
 * Bo'lakdan chizmalarni kesib olish.
 *
 * `rest` — chizmasiz matn (uni `cleanTex` tozalaydi),
 * `figures` — kesilgan bo'laklar, matndagi tartibida.
 */
export function takeFigures(
  chunk: string,
  context: FigureContext | undefined,
): { rest: string; figures: string[] } {
  const regions: Array<[number, number]> = [];
  const macros = context?.macros ?? {};
  const inside = (at: number) =>
    regions.some(([from, to]) => at >= from && at < to);

  /* 1. Chizma buyruqlari: `\sonoqi{2}` */
  const names = Object.keys(macros).filter((name) => macros[name].figure);

  if (names.length > 0) {
    const call = new RegExp(`\\\\(${names.join("|")})(?![A-Za-z])`, "g");
    let found = call.exec(chunk);

    while (found) {
      let end = found.index + found[0].length;

      for (let i = 0; i < macros[found[1]].argc; i += 1) {
        let next = end;
        while (/\s/.test(chunk[next] ?? "")) next += 1;
        if (chunk[next] !== "{") break;
        end = readGroup(chunk, next).end;
      }

      regions.push([found.index, end]);
      call.lastIndex = end;
      found = call.exec(chunk);
    }
  }

  /* 2. To'g'ridan-to'g'ri tikzpicture */
  const OPEN = "\\begin{tikzpicture}";
  const CLOSE = "\\end{tikzpicture}";
  let at = chunk.indexOf(OPEN);

  while (at !== -1) {
    const close = chunk.indexOf(CLOSE, at);
    if (close === -1) break;

    const end = close + CLOSE.length;
    if (!inside(at)) regions.push([at, end]);
    at = chunk.indexOf(OPEN, end);
  }

  /* 3. Chizma jadval ichida bo'lsa (A)-D) variantlar) — butun jadval */
  const TAB_OPEN = "\\begin{tabular}";
  const TAB_CLOSE = "\\end{tabular}";

  let found: Region[] = regions.map(([from, to]) => {
    const open = chunk.lastIndexOf(TAB_OPEN, from);

    if (open === -1 || chunk.lastIndexOf(TAB_CLOSE, from) > open) {
      return { from, to, content: chunk.slice(from, to) };
    }

    const close = chunk.indexOf(TAB_CLOSE, to);
    if (close === -1) return { from, to, content: chunk.slice(from, to) };

    const end = close + TAB_CLOSE.length;
    return { from: open, to: end, content: chunk.slice(open, end) };
  });

  /*
   * 4. Qobiq: `\chizma{<chizma> \hspace{2mm} <chizma>}`.
   *
   * Qobiq ichida chizmadan boshqa narsa (bo'shliqdan tashqari)
   * bo'lmasa, uning ichi BITTA rasm bo'ladi — chizmalar orasidagi
   * masofa saqlanadi, qobiqning o'zi esa matndan o'chadi.
   */
  const wrappers = Object.keys(macros).filter(
    (name) => !macros[name].figure && macros[name].argc === 1,
  );

  if (wrappers.length > 0 && found.length > 0) {
    const call = new RegExp(`\\\\(?:${wrappers.join("|")})\\s*\\{`, "g");
    let wrap = call.exec(chunk);

    while (wrap) {
      const open = wrap.index + wrap[0].length - 1;
      const group = readGroup(chunk, open);
      const within = found.filter((r) => r.from > open && r.to < group.end);

      if (within.length > 0) {
        let left = chunk.slice(open + 1, group.end - 1);

        for (const r of within) left = left.replace(r.content, " ");

        if (isBlank(left)) {
          found = found.filter((r) => !within.includes(r));
          found.push({
            from: wrap.index,
            to: group.end,
            content: chunk.slice(open + 1, group.end - 1),
          });
        }
      }

      call.lastIndex = group.end;
      wrap = call.exec(chunk);
    }
  }

  found.sort((a, b) => a.from - b.from);

  const merged: Region[] = [];

  for (const region of found) {
    const last = merged[merged.length - 1];

    if (last && region.from < last.to) {
      if (region.to > last.to) {
        last.to = region.to;
        last.content = chunk.slice(last.from, last.to);
      }
    } else {
      merged.push({ ...region });
    }
  }

  if (merged.length === 0) return { rest: chunk, figures: [] };

  const figures: string[] = [];
  let rest = "";
  let from = 0;

  for (const region of merged) {
    figures.push(region.content.trim());
    rest += chunk.slice(from, region.from) + " ";
    from = region.to;
  }

  rest += chunk.slice(from);

  /*
   * Chizma o'ralgan qobiqlar bo'sh qoladi: `\chizma{}`,
   * `{\centering \par}`, `\begin{center}\end{center}`.
   */
  const shells = Object.keys(macros).filter((name) => !macros[name].figure);

  for (let i = 0; i < 3; i += 1) {
    if (shells.length > 0) {
      rest = rest.replace(
        new RegExp(`\\\\(?:${shells.join("|")})\\s*\\{\\s*\\}`, "g"),
        " ",
      );
    }

    rest = rest
      .replace(/\\begin\{center\}\s*\\end\{center\}/g, " ")
      .replace(/\{(?:\s|\\centering\b|\\par\b|\\noindent\b)*\}/g, " ");
  }

  return { rest, figures };
}

type Region = { from: number; to: number; content: string };

/** Chizmalar orasidagi bo'shliqdan boshqa narsa yo'qmi */
function isBlank(text: string): boolean {
  return (
    text
      .replace(/\\[hv]space\*?\{[^{}]*\}/g, "")
      .replace(
        /\\(quad|qquad|hfill|centering|par|noindent|newline|nobreak|medskip|smallskip|bigskip)(?![A-Za-z])/g,
        "",
      )
      .replace(/\\\\|~|[{}\s]/g, "") === ""
  );
}

/** Kitoblardagi ranglar — 1-65 mavzu fayllarida e'lon qilinmagan */
const DEFAULT_SETUP = [
  "\\definecolor{kitobKok}{HTML}{1F5FAF}",
  "\\definecolor{kitobHavorang}{HTML}{EAF4FF}",
  "\\definecolor{tblue}{rgb}{0.0902,0.41176,0.66667}",
  "\\definecolor{tfill}{rgb}{0.91765,0.95686,0.98825}",
  "\\definecolor{blueA}{rgb}{0.11374,0.37256,0.62354}",
  "\\definecolor{blueB}{rgb}{0.09,0.412,0.667}",
  "\\definecolor{lightA}{rgb}{0.91765,0.95686,0.98825}",
  "\\colorlet{axisc}{black!75}",
  "\\usetikzlibrary{arrows.meta,calc}",
  /* Rasmda markazlash kerak emas, `center` esa satr ichida ishlamaydi */
  "\\renewenvironment{center}{}{}",
];

/**
 * Chizmalarni bitta LaTeX hujjatga yig'ish.
 *
 * Faqat kerakli buyruqlar qo'shiladi: chizmada (yoki u chaqirgan
 * buyruqda) uchraganlari. Sahifa bezaklari (`\trow`, `\badge`)
 * tushmaydi — ular chizmani chizadigan muhitda yo'q paketlarga
 * tayanadi.
 */
export function figureDocument(
  figures: string[],
  context: FigureContext | undefined,
): string {
  /* Bir nechta chizma — ustma-ust, har biri o'z qatorida */
  const body =
    figures.length === 1
      ? figures[0]
      : [
          "\\begin{tabular}{@{}c@{}}",
          figures.join("\n\\\\[8pt]\n"),
          "\\end{tabular}",
        ].join("\n");

  const macros = context?.macros ?? {};

  const used = new Set<string>();
  const queue = [body];

  while (queue.length > 0) {
    const source = queue.pop() as string;

    for (const [name, macro] of Object.entries(macros)) {
      if (used.has(name) || !mentions(source, name)) continue;
      used.add(name);
      queue.push(macro.source);
    }
  }

  const definitions = Object.entries(macros)
    .filter(([name]) => used.has(name))
    .map(([, macro]) => macro.source);

  return [
    ...DEFAULT_SETUP,
    ...(context?.setup ?? []),
    ...definitions,
    "\\begin{document}",
    shortLines(body),
    "\\end{document}",
  ].join("\n");
}

/**
 * Uzun qatorlarni bo'lish.
 *
 * Chizmadagi egri chiziq yuzlab nuqtadan iborat bo'lib, bitta
 * qatorga yozilgan bo'ladi. Rasm chizadigan TeX'ning qator
 * buferi kichik — bunday qatorda u qulaydi. TeX uchun qator
 * oxiri bo'shliq bilan bir xil, shuning uchun bo'shliq o'rniga
 * qator tashlash ma'noni o'zgartirmaydi.
 */
function shortLines(text: string, limit = 400): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.length <= limit) return line;

      const out: string[] = [];
      let rest = line;

      while (rest.length > limit) {
        const cut = rest.lastIndexOf(" ", limit);
        if (cut <= 0) break;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut + 1);
      }

      out.push(rest);
      return out.join("\n");
    })
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* O'qish                                                              */
/* ------------------------------------------------------------------ */

const TEST_HEAD = /\\testboshi\s*\{([^{}]*)\}\s*\{(\d{1,2})\}/g;

/** `\begin{nom} ... \end{nom}` bo'laklari */
function blocks(source: string, name: string): string[] {
  const open = `\\begin{${name}}`;
  const close = `\\end{${name}}`;
  const out: string[] = [];

  let at = source.indexOf(open);

  while (at !== -1) {
    const end = source.indexOf(close, at);
    if (end === -1) break;

    out.push(source.slice(at + open.length, end));
    at = source.indexOf(open, end);
  }

  return out;
}

/**
 * `\item` lar bo'yicha bo'lish.
 *
 * Diqqat: `\begin{variantlar}` ichida ham `\item` bor. Shuning
 * uchun avval variantlar bo'lagi ajratib olinadi, qolgani savol
 * matni bo'ladi.
 */
function splitItems(block: string): string[] {
  const out: string[] = [];
  const mark = /\\item\b/g;
  const marks: number[] = [];

  let found = mark.exec(block);

  while (found) {
    marks.push(found.index);
    found = mark.exec(block);
  }

  for (let i = 0; i < marks.length; i += 1) {
    const from = marks[i] + "\\item".length;
    const to = i + 1 < marks.length ? marks[i + 1] : block.length;
    out.push(block.slice(from, to));
  }

  return out;
}

/** Variantlari rasmda (A, B, C, D chizmalar) bo'lgan savol uchun variant matnlari */
const PICTURE_OPTIONS = {
  a: "A grafik",
  b: "B grafik",
  c: "C grafik",
  d: "D grafik",
};

/** `A)~\begin{tikzpicture}` ... `D)~\begin{tikzpicture}` — variantlar chizmada */
function hasPictureOptions(item: string): boolean {
  return ["A", "B", "C", "D"].every((letter) =>
    new RegExp(`${letter}\\)\\s*~?\\s*\\\\begin\\{tikzpicture\\}`).test(item),
  );
}

/**
 * `A)~\begin{tikzpicture}...` dagi "A)" belgisini chizma ichiga,
 * uning chap yuqori burchagiga ko'chirish.
 *
 * Chizma tashqarisida turgan eng birinchi "A)" ni rasmga aylantirgich
 * (node-tikzjax) chizmay qo'yadi — B), C), D) chiqadi, A) yo'qoladi.
 * Chizma ichidagi yozuv esa doim chiqadi.
 */
function labelsInsidePictures(figure: string): string {
  return figure.replace(
    /([A-D])\)\s*~?\s*(\\begin\{tikzpicture\}(?:\[[^\]]*\])?)([\s\S]*?)\\end\{tikzpicture\}/g,
    (_all, letter: string, open: string, inner: string) =>
      `${open}${inner}\\node[anchor=north east,inner sep=1pt,font=\\small] at (current bounding box.north west) {${letter})};\\end{tikzpicture}`,
  );
}

function readTest(
  body: string,
  number: number,
  title: string,
  context: FigureContext,
): TexTest {
  const questions: TexQuestion[] = [];
  const openTasks: TexOpenTask[] = [];
  let position = 0;

  /* Variantsiz `\item` — grafikli savol yoki ochiq topshiriq */
  const takeLoose = (item: string) => {
    if (isBlank(cleanTex(item)) && !/\\begin\{tikzpicture\}/.test(item)) return;

    position += 1;

    if (hasPictureOptions(item)) {
      const picture = takeFigures(item, context);

      questions.push({
        number: questions.length + 1,
        text: cleanTex(picture.rest),
        options: PICTURE_OPTIONS,
        flags: [],
        figures: picture.figures.map(labelsInsidePictures),
        position,
      });

      return;
    }

    const task = takeFigures(item, context);
    openTasks.push({ position, text: cleanTex(task.rest), figures: task.figures });
  };

  for (const list of blocks(body, "testlar")) {
    /*
     * Savol matni `\begin{variantlar}` gacha, variantlar esa
     * uning ichida. Shuning uchun har bir savolni variantlar
     * bo'lagidan oldingi qismga qarab ajratamiz.
     */
    const parts = list.split(/\\begin\{variantlar\}/);

    for (let i = 0; i + 1 < parts.length; i += 1) {
      const head = parts[i];
      const tail = parts[i + 1];

      /*
       * `head` da oldingi savolning variantlari ham bor — ular
       * `\end{variantlar}` gacha. Undan keyingisi shu savolga tegishli.
       */
      const ended = head.lastIndexOf("\\end{variantlar}");
      const own =
        ended === -1 ? head : head.slice(ended + "\\end{variantlar}".length);

      const items = splitItems(own);

      /*
       * Oxirgisidan oldingi `\item` lar — `variantlar` siz.
       * Ko'pi ochiq topshiriq ("grafigini yasang") — kalitda javobi
       * yo'q, ballsiz "Mustaqil ishlang" bo'ladi. Variantlari A)-D)
       * chizmalar jadvali bo'lgani esa oddiy test savoli, kalitda
       * javobi bor. Uni tashlab ketsak, keyingi savollarning javobi
       * bittaga surilib ketadi (63-mavzuda shunday bo'lgan edi).
       */
      for (const item of items.slice(0, -1)) takeLoose(item);

      position += 1;

      const asked = takeFigures(items[items.length - 1] ?? "", context);
      const text = cleanTex(asked.rest);

      const close = tail.indexOf("\\end{variantlar}");
      const inside = close === -1 ? tail : tail.slice(0, close);
      const options = optionFigures(splitItems(inside), context);
      const choices = options.choices;

      const flags: string[] = [...options.flags];

      if (!text) flags.push("savol matni böş");
      if (choices.length !== 4) {
        flags.push(`variantlar soni ${choices.length}, 4 emas`);
      }

      questions.push({
        number: questions.length + 1,
        text,
        options: {
          a: choices[0] ?? "",
          b: choices[1] ?? "",
          c: choices[2] ?? "",
          d: choices[3] ?? "",
        },
        flags,
        figures: [...asked.figures, ...options.figures],
        position,
      });
    }

    /* Oxirgi variantlardan keyin qolgan variantsiz topshiriqlar */
    const last = parts[parts.length - 1];
    const ended = last.lastIndexOf("\\end{variantlar}");

    if (parts.length === 1 || ended !== -1) {
      const rest =
        parts.length === 1 ? last : last.slice(ended + "\\end{variantlar}".length);

      for (const item of splitItems(rest)) takeLoose(item);
    }
  }

  return { number, title, questions, openTasks };
}



/* ------------------------------------------------------------------ */
/* Javoblar kaliti                                                     */
/* ------------------------------------------------------------------ */

/*
 * Kalit fayli oddiy matn:
 *
 *     Mavzu nomi — javoblar
 *
 *     1-TEST: 1-C, 2-A, 3-B, 4-D, ...
 *     2-TEST: 1-B, 2-D, ...
 *
 * Shuning uchun uni o'qish ham oddiy: qator test raqamini
 * beradi, qolgani "savol-javob" juftligi.
 */
const ANSWER_HEAD = /^\s*(\d{1,2})\s*-\s*TEST\s*:(.*)$/i;
const ANSWER_PAIR = /(?<!\d)(\d{1,3})\s*-\s*([A-D])\b/g;

export type TexAnswerKey = {
  /** test raqami -> (savol raqami -> javob) */
  tests: Map<number, Map<number, "A" | "B" | "C" | "D">>;
  errors: string[];
};

export function parseTexAnswers(source: string): TexAnswerKey {
  const tests = new Map<number, Map<number, "A" | "B" | "C" | "D">>();
  const errors: string[] = [];

  for (const line of stripComments(source).split(/\r?\n/)) {
    const head = line.match(ANSWER_HEAD);

    if (!head) continue;

    const number = Number(head[1]);
    const answers = new Map<number, "A" | "B" | "C" | "D">();

    ANSWER_PAIR.lastIndex = 0;
    let pair = ANSWER_PAIR.exec(head[2]);

    while (pair) {
      answers.set(Number(pair[1]), pair[2] as "A" | "B" | "C" | "D");
      pair = ANSWER_PAIR.exec(head[2]);
    }

    if (answers.size === 0) {
      errors.push(`${number}-testda javob topilmadi.`);
      continue;
    }

    tests.set(number, answers);
  }

  if (tests.size === 0) {
    errors.push("Kalit faylida `N-TEST: 1-A, 2-B, ...` qatori topilmadi.");
  }

  return { tests, errors };
}

/* ------------------------------------------------------------------ */
/* Savol + javob                                                       */
/* ------------------------------------------------------------------ */

export type ReadyQuestion = {
  number: number;
  text: string;
  options: { a: string; b: string; c: string; d: string };
  correct: "A" | "B" | "C" | "D";
  /**
   * Chizma bo'lsa — uni chizadigan to'liq LaTeX hujjat
   * (`figureDocument`). Rasmga server aylantiradi.
   */
  figure: string | null;
  /** Testdagi asl o'rni (mustaqil ishlar bilan birga sanaladi) */
  position: number;
};

/** Ballsiz "Mustaqil ishlang" topshirig'i */
export type ReadyOpenTask = {
  position: number;
  text: string;
  /** Chizma bo'lsa — LaTeX hujjat, aks holda null */
  figure: string | null;
};

export type ReadyTest = {
  number: number;
  title: string;
  questions: ReadyQuestion[];
  /** Tashlab ketilgan savollar va sabablari */
  notes: string[];
  /** Variantsiz topshiriqlar — testga ballsiz qo'shiladi */
  openTasks: ReadyOpenTask[];
};

export type ReadyResult = {
  tests: ReadyTest[];
  errors: string[];
  /** Jami savol va ulardan nechtasi tayyor */
  total: number;
  ready: number;
};

/**
 * Savollarni javoblar bilan birlashtirish.
 *
 * To'g'ri javobi yo'q savol saqlanmaydi — baribir ishlatib
 * bo'lmaydi. Chizmasi bor savolga esa chizmani chizadigan
 * LaTeX hujjat qo'shiladi — server uni rasmga aylantiradi.
 */
export function buildTests(
  questions: TexResult,
  key: TexAnswerKey,
): ReadyResult {
  const tests: ReadyTest[] = [];
  const errors = [...questions.errors, ...key.errors];

  let total = 0;
  let ready = 0;

  for (const test of questions.tests) {
    const answers = key.tests.get(test.number);
    const notes: string[] = [];
    const kept: ReadyQuestion[] = [];

    if (!answers) {
      errors.push(`${test.number}-test uçun javoblar kaliti topilmadi.`);
      continue;
    }

    for (const question of test.questions) {
      total += 1;

      const correct = answers.get(question.number);

      if (!correct) {
        notes.push(`${question.number}-savol: kalitda javobi yöq.`);
        continue;
      }

      /* Variantlari to'liq bo'lmasa saqlash xavfli */
      const broken = question.flags.find((flag) =>
        flag.includes("variantlar soni") || flag.includes("böş"),
      );

      if (broken) {
        notes.push(`${question.number}-savol: ${broken}`);
        continue;
      }

      for (const flag of question.flags) {
        notes.push(`${question.number}-savol: ${flag}`);
      }

      kept.push({
        number: question.number,
        text: question.text,
        options: question.options,
        correct,
        figure:
          question.figures.length > 0
            ? figureDocument(question.figures, questions.figures)
            : null,
        position: question.position ?? question.number,
      });

      ready += 1;
    }

    if (kept.length === 0) {
      errors.push(`${test.number}-testda saqlanadigan savol qolmadi.`);
      continue;
    }

    tests.push({
      number: test.number,
      title: test.title,
      questions: kept,
      notes,
      openTasks: (test.openTasks ?? []).map((task) => ({
        position: task.position,
        text: task.text,
        figure:
          task.figures.length > 0
            ? figureDocument(task.figures, questions.figures)
            : null,
      })),
    });
  }

  return { tests, errors, total, ready };
}

/* ------------------------------------------------------------------ */
/* Ikkinchi ko'rinish: \renewcommand{\variant} + \optsauto            */
/* ------------------------------------------------------------------ */

/*
 * 66-89 mavzular boshqacha yozilgan (ular alohida hujjat):
 *
 *     \renewcommand{\variant}{1-TEST}
 *     \textbf{1-test.} Savol matni
 *     \optsauto{A}{B}{C}{D}
 *
 * Variantlar `\optsauto`, `\optsfour`, `\optstwo`, `\optsone`,
 * `\optsautotwo` buyruqlarining birida bo'ladi — ular faqat
 * joylashuvi bilan farq qiladi, to'rttala argumenti bir xil.
 */
const VARIANT_HEAD = /\\renewcommand\s*\{\\variant\}\s*\{(\d{1,2})\s*-\s*TEST\}/gi;
const QUESTION_HEAD = /\\textbf\s*\{\s*(\d{1,3})\s*-\s*test\.?\s*\}/gi;
const OPTS = /\\opts(auto|autotwo|four|three|two|one)\s*\{/;

/** `{...}` guruhini qavslar sonini hisoblab o'qish */
function readGroup(text: string, open: number): { value: string; end: number } {
  let depth = 1;
  let i = open + 1;

  while (i < text.length && depth > 0) {
    if (text[i] === "{" && text[i - 1] !== "\\") depth += 1;
    else if (text[i] === "}" && text[i - 1] !== "\\") depth -= 1;
    i += 1;
  }

  return { value: text.slice(open + 1, i - 1), end: i };
}

/** `\optsauto{A}{B}{C}{D}` -> to'rtta variant */
function readOptions(text: string): {
  choices: string[];
  textEnd: number;
  /** Variantlardan keyingi joy — chizma ba'zan shu yerda turadi */
  optionsEnd: number;
} {
  const found = OPTS.exec(text);

  if (!found) {
    return { choices: [], textEnd: text.length, optionsEnd: text.length };
  }

  const choices: string[] = [];
  let at = found.index + found[0].length - 1;

  for (let i = 0; i < 4; i += 1) {
    if (text[at] !== "{") break;

    const group = readGroup(text, at);
    choices.push(group.value);
    at = group.end;
  }

  return { choices, textEnd: found.index, optionsEnd: at };
}

function readVariantTests(source: string, context: FigureContext): TexResult {
  const heads: Array<{ at: number; number: number }> = [];

  VARIANT_HEAD.lastIndex = 0;
  let found = VARIANT_HEAD.exec(source);

  while (found) {
    heads.push({ at: found.index, number: Number(found[1]) });
    found = VARIANT_HEAD.exec(source);
  }

  if (heads.length === 0) return { tests: [], errors: [] };

  const tests: TexTest[] = [];
  const errors: string[] = [];

  heads.forEach((head, index) => {
    const to = index + 1 < heads.length ? heads[index + 1].at : source.length;
    const body = source.slice(head.at, to);

    const marks: Array<{ at: number; number: number }> = [];

    QUESTION_HEAD.lastIndex = 0;
    let mark = QUESTION_HEAD.exec(body);

    while (mark) {
      marks.push({ at: mark.index + mark[0].length, number: Number(mark[1]) });
      mark = QUESTION_HEAD.exec(body);
    }

    const questions: TexQuestion[] = [];

    marks.forEach((start, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].at : body.length;
      const chunk = body.slice(start.at, end);

      const { choices: raw, textEnd, optionsEnd } = readOptions(chunk);
      const asked = takeFigures(chunk.slice(0, textEnd), context);

      /*
       * Chizma variantlardan KEYIN ham kelishi mumkin: savol chap
       * ustunda, chizma o'ng ustunda (`minipage` yonma-yon).
       */
      const after = takeFigures(chunk.slice(optionsEnd), context);
      const text = cleanTex(asked.rest);
      const options = optionFigures(raw, context);
      const choices = options.choices;
      const flags: string[] = [...options.flags];

      if (!text) flags.push("savol matni böş");
      if (choices.length !== 4) {
        flags.push(`variantlar soni ${choices.length}, 4 emas`);
      }

      /* `\includegraphics` — tashqi fayl, uni bu yerda chizib bo'lmaydi */
      if (/\\includegraphics/.test(chunk)) {
        flags.push("savolda tashqi rasm bor — uni qölda qöşing");
      }

      questions.push({
        number: start.number,
        text,
        options: {
          a: choices[0] ?? "",
          b: choices[1] ?? "",
          c: choices[2] ?? "",
          d: choices[3] ?? "",
        },
        flags,
        figures: [...asked.figures, ...after.figures, ...options.figures],
      });
    });

    if (questions.length === 0) {
      errors.push(`${head.number}-testda savol topilmadi.`);
      return;
    }

    tests.push({ number: head.number, title: "", questions });
  });

  return { tests, errors };
}


/**
 * Variant ichidagi chizma.
 *
 * Variant matn bo'lib saqlanadi, rasm esa faqat savolda turadi.
 * Shuning uchun variantdagi chizma savol rasmiga "A)" belgisi
 * bilan qo'shiladi, variantning o'zida esa unga havola qoladi.
 */
function optionFigures(
  raw: string[],
  context: FigureContext,
): { choices: string[]; figures: string[]; flags: string[] } {
  const figures: string[] = [];
  const flags: string[] = [];
  const letters = ["A", "B", "C", "D"];

  const choices = raw.map((item, index) => {
    const taken = takeFigures(item, context);
    const text = cleanTex(taken.rest);

    if (taken.figures.length === 0) return text;

    const letter = letters[index] ?? String(index + 1);
    figures.push(`\\textbf{${letter})}~${taken.figures.join("~")}`);
    flags.push(`${letter} variant çizma edi — rasmga qöşildi`);

    return text || `Rasmdagi ${letter})`;
  });

  return { choices, figures, flags };
}

/** `.tex` manba -> testlar */
export function parseTex(source: string): TexResult {
  const text = stripComments(source);
  const errors: string[] = [];
  const figures = readFigureContext(text);

  const heads: Array<{ at: number; title: string; number: number }> = [];

  TEST_HEAD.lastIndex = 0;
  let found = TEST_HEAD.exec(text);

  while (found) {
    heads.push({
      at: found.index,
      title: cleanTex(found[1]),
      number: Number(found[2]),
    });

    found = TEST_HEAD.exec(text);
  }

  if (heads.length === 0) {
    /* Ikkinchi ko'rinishni sinab ko'ramiz */
    const other = readVariantTests(text, figures);

    if (other.tests.length > 0) return { ...other, figures };

    return {
      tests: [],
      errors: [
        "Faylda na `\\testboshi{...}{N}`, na `\\renewcommand{\\variant}` topilmadi.",
      ],
    };
  }

  const tests: TexTest[] = [];

  heads.forEach((head, index) => {
    const to = index + 1 < heads.length ? heads[index + 1].at : text.length;
    const test = readTest(
      text.slice(head.at, to),
      head.number,
      head.title,
      figures,
    );

    if (test.questions.length === 0) {
      errors.push(`${head.number}-testda savol topilmadi.`);
      return;
    }

    tests.push(test);
  });

  return { tests, errors, figures };
}
