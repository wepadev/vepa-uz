/**
 * PDF'dan testni DASTURIY ajratish — sun'iy intellektsiz.
 *
 * Nega kerak: AI har safar pul yoki chegara talab qiladi, sekin
 * ishlaydi va bir xil PDF'ga har safar biroz boshqacha javob
 * berishi mumkin. Testlarning ko'pchiligi esa qat'iy tuzilishga
 * ega: "N-test" sarlavhasi, raqamlangan savollar, A) B) C) D)
 * variantlar. Buni oddiy qoidalar bilan ham ajratib olsa bo'ladi —
 * tekin, bir zumda va har safar bir xil natija bilan.
 *
 * Bu fayl ATAYLAB hech narsa import qilmaydi: `tests/` dagi
 * testlar uni to'g'ridan-to'g'ri chaqiradi. PDF'ni o'qish
 * `lib/pdf-text.ts` da, bu yerda faqat tayyor qatorlar bilan
 * ishlanadi.
 *
 * CHEKLOV — buni bilib turish muhim: kasr (ayniqsa ustma-ust
 * yozilgani), ildiz va matritsa PDF'ning chizma qatlamida turadi,
 * matn qatlamida emas. Bunday savollar "flags" bilan belgilanadi
 * va o'qituvchi ularni qo'lda to'g'rilaydi yoki AI'ga beradi.
 */

export type PdfLine = {
  page: number;
  y: number;
  text: string;
};

export type OfflineQuestion = {
  number: number;
  text: string;
  options: Partial<Record<"A" | "B" | "C" | "D", string>>;
  /** Shubhali joylar: bo'sh bo'lsa savol ishonchli ajratilgan */
  flags: string[];
  /*
   * Savol yig'ilgan XOM qatorlar.
   *
   * Qoida bilan ajratib bo'lmagan savolni modelga yuborishda
   * aynan shular kerak bo'ladi — PDF'ning o'zini emas, faqat shu
   * bir necha qatorni yuborsak token o'nlab marta kam ketadi.
   */
  source: string[];
};

export type OfflineTest = {
  title: string;
  questions: OfflineQuestion[];
};

export type OfflineResult = {
  tests: OfflineTest[];
  /** Jami savollar */
  total: number;
  /** Bironta ham belgisi yo'q savollar */
  clean: number;
};

/** "1-test", "2-variant", "1-TEST" */
const TEST_HEAD = /^\s*(\d{1,2})\s*-\s*(test|variant)\s*$/i;

/**
 * Kolontitul ichidagi test raqami: "Daraja (1-qism) 2-TEST" -> 2
 *
 * Ba'zi fayllarda "N-test" alohida qatorda yozilmaydi — test
 * raqami faqat betning yuqorisidagi kolontitulda turadi. O'shanda
 * testlar chegarasi kolontitul raqami o'zgarganda o'tadi.
 */
const HEADER_TEST = /(\d{1,2})\s*-\s*test\b/i;

/** "12. Savol matni" */
const QUESTION_START = /^(\d{1,2})\s*\.\s+(\S.*)$/;

/** Variant belgisi: "A)" yoki "A )" */
const OPTION_MARK = /\b([A-D])\s*\)/g;

/**
 * Har betda takrorlanadigan sarlavha (kolontitul).
 *
 * Masalan "Algebraik kasrlar (1-qism) 1-TEST" oltala betda turadi —
 * uni test sarlavhasi deb qabul qilsak, oltita bo'sh test paydo
 * bo'ladi. Shuning uchun faqat betning YUQORISIDA turgan va bir
 * necha betda takrorlangan qator kolontitul hisoblanadi: aks holda
 * tasodifan bir xil bo'lgan variant qatori ham o'chib ketardi.
 */
export function findRunningHeaders(lines: PdfLine[]): Set<string> {
  if (lines.length === 0) return new Set();

  const pages = new Set(lines.map((line) => line.page));
  if (pages.size < 2) return new Set();

  const topY = Math.max(...lines.map((line) => line.y));

  const nearTop = new Set(
    lines.filter((line) => line.y > topY - 30).map((line) => line.text.trim()),
  );

  const seenOn = new Map<string, Set<number>>();

  for (const line of lines) {
    const key = line.text.trim();
    const set = seenOn.get(key) ?? new Set<number>();
    set.add(line.page);
    seenOn.set(key, set);
  }

  const headers = new Set<string>();

  for (const [text, onPages] of seenOn) {
    if (onPages.size > 1 && nearTop.has(text)) headers.add(text);
  }

  return headers;
}

/**
 * Variantlarni bitta qatordan ajratib olish.
 *
 * "A) 8   B) 5   C) 7   D) 6" -> { A: "8", B: "5", C: "7", D: "6" }
 *
 * Variantlar ikki qatorga bo'lingan bo'lsa (A) B) birinchi qatorda,
 * C) D) ikkinchisida) ikkala qator ham shu funksiyadan o'tadi va
 * natijalar birlashtiriladi.
 */
export function splitOptions(
  text: string,
): Partial<Record<"A" | "B" | "C" | "D", string>> {
  const marks = [...text.matchAll(OPTION_MARK)];
  const out: Partial<Record<"A" | "B" | "C" | "D", string>> = {};

  marks.forEach((mark, index) => {
    const start = (mark.index ?? 0) + mark[0].length;
    const end =
      index + 1 < marks.length ? marks[index + 1].index ?? text.length : text.length;

    out[mark[1] as "A" | "B" | "C" | "D"] = text.slice(start, end).trim();
  });

  return out;
}

/** Savolga shubha belgilari qo'yish */
function flagQuestion(question: OfflineQuestion): void {
  const letters = (["A", "B", "C", "D"] as const).filter((key) =>
    question.options[key]?.trim(),
  );

  if (letters.length !== 4) {
    question.flags.push(`variantlar töliq emas (${letters.length}/4)`);
  }

  /*
   * Ustma-ust yozilgan kasrda surat va maxraj alohida qatorga
   * tushadi, variantning o'zida esa faqat minus yoki hech narsa
   * qoladi. Shu bo'yicha kasrni sezamiz.
   */
  for (const key of letters) {
    const value = (question.options[key] ?? "").trim();
    if (/^[−\-+]?$/.test(value)) {
      question.flags.push(`${key}) varianti böş — kasr bölişi mumkin`);
    }
  }

  /*
   * Yig'indi, ko'paytma va integralning chegaralari belgining
   * tepasida va tagida turadi — ularni koordinatadan tiklash
   * ishonchli emas. Shuning uchun bunday savol har doim
   * tekshirishga chiqariladi.
   */
  if (/\\(int|sum|prod|lim|iint)\b/.test(question.text)) {
    question.flags.push("integral/yiğindi — çegaralarini tekşiring");
  }

  if (/[∫∑∏√⏟⎷︷︸]/.test(question.text)) {
    question.flags.push("murakkab belgi tiklanmadi — qölda tekşiring");
  }

  if (/\^\{\s*\}|_\{\s*\}/.test(question.text)) {
    question.flags.push("böş daraja yoki indeks");
  }

  /*
   * Formula va matn `$` bilan ajratiladi. Toq `$` qolgan bo'lsa
   * KaTeX butun qatorni formula deb o'qiydi va savol buziladi.
   */
  for (const [key, value] of Object.entries({
    savol: question.text,
    ...question.options,
  })) {
    if (((value ?? "").match(/\$/g) ?? []).length % 2 !== 0) {
      question.flags.push(`${key}: formula belgisi (\u0024) toq qolgan`);
    }
  }

  /*
   * Formuladan keyin darhol yakka son turibdi — odatda aralash
   * son ("2½") yoki murakkab ifoda to'liq yig'ilmagani belgisi.
   */
  if (/\$\s+\d/.test(question.text)) {
    question.flags.push("formuladan keyin yakka son — tekşirib çiqing");
  }

  /*
   * Savol amal belgisi bilan tugayapti ("... \u2212.") — demak
   * ifodaning bir qismi joyiga tushmagan.
   */
  if (/[+\-\u2212\u00B7:\u00D7/]\s*\.?\s*$/.test(question.text)) {
    question.flags.push("savol amal belgisi bilan tugadi — töliq emas");
  }
}

/**
 * Qatorlardan testlarni yig'ish.
 *
 * Mantiq sodda va shuning uchun bashorat qilinadigan:
 *   - "N-test" / "N-variant" -> yangi test boshlanadi
 *   - "N. ..." -> yangi savol
 *   - "A) ... B) ..." -> variantlar
 *   - qolgan hamma narsa -> joriy savol matnining davomi
 */
export function parseTests(lines: PdfLine[]): OfflineResult {
  const headers = findRunningHeaders(lines);
  const tests: OfflineTest[] = [];

  let test: OfflineTest | null = null;
  let question: OfflineQuestion | null = null;
  /** Oxirgi savol raqami — qaytadan 1 dan boshlansa yangi test */
  let lastNumber = 0;
  /** Kolontituldagi joriy test raqami */
  let headerNumber: number | null = null;

  /*
   * Kolontitul bo'yicha bo'lish faqat "N-test" qatori HECH QAYERDA
   * yo'q bo'lsa ishlatiladi. Aks holda bir xil chegara ikki marta
   * hisoblanib, bo'sh testlar paydo bo'ladi.
   */
  const hasOwnHeads = lines.some((line) => {
    const text = line.text.trim();
    return TEST_HEAD.test(text) && !headers.has(text);
  });

  /*
   * IKKI XIL FAYL BOR.
   *
   * Yangi ("zich") fayllarda savollar "1." deb raqamlanadi va
   * "1-test" alohida sarlavha bo'ladi. Eski ("2 tadan") fayllarda
   * esa aksincha: savolning o'zi "1-test" deb yoziladi, test
   * raqami faqat betning yuqorisidagi kolontitulda turadi.
   *
   * Farqini shundan bilamiz: "N." ko'rinishidagi savol umuman
   * yo'q, lekin kolontitulda test raqami bor.
   */
  const headerNumbers = new Set<number>();

  for (const head of headers) {
    const found = head.match(HEADER_TEST);
    if (found) headerNumbers.add(Number(found[1]));
  }

  const numbered = lines.filter((line) => {
    const text = line.text.trim();
    return !headers.has(text) && QUESTION_START.test(text);
  }).length;

  const headsAreQuestions = headerNumbers.size > 0 && numbered === 0;

  const closeQuestion = () => {
    if (question && test) test.questions.push(question);
    question = null;
  };

  const startTest = (title: string) => {
    closeQuestion();
    test = { title, questions: [] };
    tests.push(test);
    lastNumber = 0;
  };

  for (const line of lines) {
    const text = line.text.trim();

    if (!text) continue;

    if (headers.has(text)) {
      if (hasOwnHeads && !headsAreQuestions) continue;

      const found = text.match(HEADER_TEST);

      if (found) {
        const number = Number(found[1]);

        if (number !== headerNumber) {
          headerNumber = number;
          startTest(`${number}-test`);
        }
      }

      continue;
    }

    const head = text.match(TEST_HEAD);

    if (head && !headsAreQuestions) {
      startTest(text);
      continue;
    }

    if (!test) startTest("1-test");

    /* Eski faylda "1-test" — bu savol raqami */
    if (head) {
      closeQuestion();
      lastNumber = Number(head[1]);
      question = {
        number: lastNumber,
        text: "",
        options: {},
        flags: [],
        source: [text],
      };
      continue;
    }

    const start = text.match(QUESTION_START);

    if (start && !/^[A-D]\s*\)/.test(text)) {
      const number = Number(start[1]);

      /*
       * Raqamlash qaytadan boshlandi — demak yangi test boshlandi.
       * Buni sezmasak uchta test bitta bo'lib qo'shilib ketadi va
       * javoblar kaliti ham aralashib, SOXTA natija chiqadi.
       */
      if (number <= lastNumber) startTest(`${tests.length + 1}-test`);

      closeQuestion();
      lastNumber = number;
      question = {
        number,
        text: start[2],
        options: {},
        flags: [],
        source: [text],
      };
      continue;
    }

    if (!question) continue;

    question.source.push(text);

    if (OPTION_MARK.test(text)) {
      OPTION_MARK.lastIndex = 0;
      Object.assign(question.options, splitOptions(text));
      continue;
    }

    question.text = `${question.text} ${text}`.replace(/\s+/g, " ").trim();
  }

  closeQuestion();

  let total = 0;
  let clean = 0;

  for (const item of tests) {
    for (const q of item.questions) {
      flagQuestion(q);
      total += 1;
      if (q.flags.length === 0) clean += 1;
    }
  }

  return {
    tests: tests.filter((item) => item.questions.length > 0),
    total,
    clean,
  };
}

/**
 * Bitta test ichida bir raqam ikki marta uchrashi.
 *
 * Bu "testlar chegarasi topilmadi" degani: ikkita test bitta
 * bo'lib qo'shilib ketgan. Bunday natijani saqlash xavfli —
 * javoblar kaliti noto'g'ri savolga tushadi.
 */
export function duplicateNumbers(test: OfflineTest): number[] {
  const seen = new Set<number>();
  const twice = new Set<number>();

  for (const question of test.questions) {
    if (seen.has(question.number)) twice.add(question.number);
    seen.add(question.number);
  }

  return [...twice].sort((a, b) => a - b);
}

export type AnswerKeyVariant = {
  label: string;
  answers: Map<number, "A" | "B" | "C" | "D">;
};

/**
 * Javoblar kalitini ajratish.
 *
 * Kalit fayllari juda bir xil tuzilgan:
 *
 *   2-variant (1-TEST)
 *   1. C   2. A   3. B   4. D ...
 *
 * Shuning uchun bu qism butunlay ishonchli ishlaydi — kasr ham,
 * daraja ham yo'q, faqat raqam va harf.
 */
export function parseAnswerKey(lines: PdfLine[]): AnswerKeyVariant[] {
  const variants: AnswerKeyVariant[] = [];
  let current: AnswerKeyVariant | null = null;

  for (const line of lines) {
    const text = line.text.trim();

    if (/^\s*\d{1,2}\s*-\s*(variant|test)\b/i.test(text)) {
      current = { label: text, answers: new Map() };
      variants.push(current);
    }

    if (!current) continue;

    /*
     * Raqamdan oldin yana raqam turmasin: "2026. C" dagi "26" ni
     * javob deb olib qo'ymasligimiz uchun. Sana yoki uzun son
     * kalit faylida uchrab turadi.
     */
    for (const match of text.matchAll(/(?<!\d)(\d{1,2})\s*[.)]\s*([A-D])\b/g)) {
      const number = Number(match[1]);

      if (number >= 1 && number <= 60) {
        current.answers.set(number, match[2] as "A" | "B" | "C" | "D");
      }
    }
  }

  return variants.filter((variant) => variant.answers.size > 0);
}

/**
 * Javoblar kalitini testlarga ulash.
 *
 * Kalit fayli testdan alohida bo'lgani uchun ularni tutashtirish
 * kerak. Kalitdagi yorliq odatda test raqamini o'z ichiga oladi:
 *
 *     "2-variant (1-TEST)"   ->   "1-test"
 *     "3-variant (2-TEST)"   ->   "2-test"
 *
 * Shuning uchun avval raqam bo'yicha qidiramiz. Raqam topilmasa,
 * savollar soni bir xil bo'lgan variantlardan tartib bo'yicha
 * olamiz — kalitda ko'pincha "nazariya" varianti ham turadi,
 * shuning uchun ko'r-ko'rona tartib bilan ulash xato beradi.
 */
export function matchAnswerKey(
  tests: OfflineTest[],
  variants: AnswerKeyVariant[],
): Map<number, AnswerKeyVariant> {
  const out = new Map<number, AnswerKeyVariant>();
  const used = new Set<AnswerKeyVariant>();

  const testNumber = (text: string) => {
    const match = text.match(/(\d{1,2})\s*-\s*test/i);
    return match ? Number(match[1]) : null;
  };

  tests.forEach((test, index) => {
    const number = testNumber(test.title);

    if (number !== null) {
      const found = variants.find(
        (variant) => !used.has(variant) && testNumber(variant.label) === number,
      );

      if (found) {
        out.set(index, found);
        used.add(found);
      }
    }
  });

  tests.forEach((test, index) => {
    if (out.has(index)) return;

    const found = variants.find(
      (variant) =>
        !used.has(variant) && variant.answers.size === test.questions.length,
    );

    if (found) {
      out.set(index, found);
      used.add(found);
    }
  });

  return out;
}
