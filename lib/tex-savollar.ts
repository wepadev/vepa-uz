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
};

export type TexTest = {
  /** `\testboshi{...}{N}` dagi N */
  number: number;
  title: string;
  questions: TexQuestion[];
};

export type TexResult = {
  tests: TexTest[];
  errors: string[];
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
  /\\(columnbreak|newpage|clearpage|centering|noindent|smallskip|medskip|bigskip|par)\b/g,
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

const LETTERS = ["a", "b", "c", "d"] as const;

function readTest(body: string, number: number, title: string): TexTest {
  const questions: TexQuestion[] = [];

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

      const items = splitItems(head);
      const text = cleanTex(items[items.length - 1] ?? "");

      const close = tail.indexOf("\\end{variantlar}");
      const inside = close === -1 ? tail : tail.slice(0, close);
      const choices = splitItems(inside).map(cleanTex);

      const flags: string[] = [];

      if (!text) flags.push("savol matni bo'sh");
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
      });
    }
  }

  return { number, title, questions };
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
};

export type ReadyTest = {
  number: number;
  title: string;
  questions: ReadyQuestion[];
  /** Tashlab ketilgan savollar va sabablari */
  notes: string[];
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
 * bo'lmaydi. Chizmasi bor savol esa saqlanadi, lekin eslatma
 * bilan: rasmni qo'lda qo'shish kerak.
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
      errors.push(`${test.number}-test uchun javoblar kaliti topilmadi.`);
      continue;
    }

    for (const question of test.questions) {
      total += 1;

      const correct = answers.get(question.number);

      if (!correct) {
        notes.push(`${question.number}-savol: kalitda javobi yo'q.`);
        continue;
      }

      /* Variantlari to'liq bo'lmasa saqlash xavfli */
      const broken = question.flags.find((flag) =>
        flag.includes("variantlar soni") || flag.includes("bo'sh"),
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
function readOptions(text: string): { choices: string[]; textEnd: number } {
  const found = OPTS.exec(text);

  if (!found) return { choices: [], textEnd: text.length };

  const choices: string[] = [];
  let at = found.index + found[0].length - 1;

  for (let i = 0; i < 4; i += 1) {
    if (text[at] !== "{") break;

    const group = readGroup(text, at);
    choices.push(group.value);
    at = group.end;
  }

  return { choices, textEnd: found.index };
}

function readVariantTests(source: string): TexResult {
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

      const { choices, textEnd } = readOptions(chunk);
      const text = cleanTex(chunk.slice(0, textEnd));
      const flags: string[] = [];

      if (!text) flags.push("savol matni bo'sh");
      if (choices.length !== 4) {
        flags.push(`variantlar soni ${choices.length}, 4 emas`);
      }

      /*
       * Chizmali savol: grafik TikZ bilan chizilgan, uni matnga
       * aylantirib bo'lmaydi. Savol saqlanadi, lekin rasmni
       * qo'lda qo'shish kerakligi belgilanadi.
       */
      if (/\\begin\{tikzpicture\}|\\includegraphics/.test(chunk)) {
        flags.push("savolda chizma bor — rasmni qo'lda qo'shing");
      }

      questions.push({
        number: start.number,
        text,
        options: {
          a: cleanTex(choices[0] ?? ""),
          b: cleanTex(choices[1] ?? ""),
          c: cleanTex(choices[2] ?? ""),
          d: cleanTex(choices[3] ?? ""),
        },
        flags,
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

/** `.tex` manba -> testlar */
export function parseTex(source: string): TexResult {
  const text = stripComments(source);
  const errors: string[] = [];

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
    const other = readVariantTests(text);

    if (other.tests.length > 0) return other;

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
    const test = readTest(text.slice(head.at, to), head.number, head.title);

    if (test.questions.length === 0) {
      errors.push(`${head.number}-testda savol topilmadi.`);
      return;
    }

    tests.push(test);
  });

  return { tests, errors };
}
