/**
 * PDF'dan testni AI'siz ajratish — yuqori qavat.
 *
 * `pdf-text.ts` PDF'ni koordinatali qatorlarga aylantiradi,
 * `pdf-offline.ts` o'sha qatorlardan test va javob kalitini
 * ajratadi. Bu fayl ikkalasini birlashtiradi va natijani saytning
 * odatiy `ParsedTest` ko'rinishiga keltiradi.
 *
 * NIMA UCHUN JAVOBLAR FAYLI SHART:
 * test PDF'ining ichida javob kaliti yo'q (u alohida faylda
 * turadi), savol esa to'g'ri javobsiz saqlanmaydi. Shuning uchun
 * AI'siz ajratish ikkita fayl bilan ishlaydi: test + javoblar.
 */
import {
  duplicateNumbers,
  parseAnswerKey as parsePdfAnswerKey,
  matchAnswerKey,
  parseAnswerKey,
  parseTests,
} from "@/lib/pdf-offline";
import { extractLines } from "@/lib/pdf-text";
import type { TexAnswerKey } from "@/lib/tex-savollar";

import type { ParsedTest } from "@/lib/pdf-import";

/** Qoida bilan ajratib bo'lmagan savol — modelga yuboriladi */
export type PendingQuestion = {
  /** Qaysi testda (OfflineImport.tests ichidagi tartib) */
  test: number;
  number: number;
  /** Xom qatorlar — modelga aynan shular yuboriladi */
  source: string[];
  correct: "A" | "B" | "C" | "D";
  /** Nega ajratilmagani */
  why: string;
};

export type OfflineImport = {
  tests: ParsedTest[];
  /** Har testdagi savollarning raqamlari — tiklangan savolni o'z joyiga qo'yish uchun */
  numbers: number[][];
  /** Modelga yuborish mumkin bo'lgan savollar */
  pending: PendingQuestion[];
  errors: string[];
  /** Jami savollar va ulardan nechtasi shubhasiz ajratilgani */
  total: number;
  clean: number;
};

/**
 * Ajratish qanchalik ishonchli bo'lsa AI'ga murojaat qilinmaydi.
 *
 * 0.8 — tajriba asosida: oddiy matnli testlarda 100%, darajali
 * LaTeX testlarda 80% ga yaqin chiqadi. Undan pasti odatda kasr
 * yoki ildizga to'la fayl degani, uni model yaxshiroq o'qiydi.
 */
const MIN_CLEAN_RATIO = Number(process.env.OFFLINE_MIN_CLEAN) || 0.8;

export async function parsePdfOffline(
  testPdf: Buffer,
  answersPdf: Buffer | null,
): Promise<OfflineImport> {
  const errors: string[] = [];

  const { lines } = await extractLines(testPdf);

  if (lines.length === 0) {
    return {
      tests: [],
      numbers: [],
      pending: [],
      errors: ["PDF ichida matn qatlami yo'q (skanerdan olingan bo'lishi mumkin)."],
      total: 0,
      clean: 0,
    };
  }

  const parsed = parseTests(lines);

  if (parsed.total === 0) {
    return {
      tests: [],
      numbers: [],
      pending: [],
      errors: ["Savollar topilmadi."],
      total: 0,
      clean: 0,
    };
  }

  /*
   * Bir test ichida takrorlangan savol raqami bo'lsa to'xtaymiz.
   * Bu testlar chegarasi topilmaganini bildiradi va javoblar
   * kaliti noto'g'ri savolga tushib qolishi mumkin — bunday
   * natijani saqlashdan ko'ra modelga berish xavfsizroq.
   */
  for (const test of parsed.tests) {
    const twice = duplicateNumbers(test);

    if (twice.length > 0) {
      return {
        tests: [],
        numbers: [],
        pending: [],
        errors: [
          `Testlar chegarasi aniqlanmadi: "${test.title}" ichida ` +
            `${twice.join(", ")} raqamli savol ikki marta uchraydi.`,
        ],
        total: parsed.total,
        clean: parsed.clean,
      };
    }
  }

  const variants = answersPdf
    ? parseAnswerKey((await extractLines(answersPdf)).lines)
    : [];

  if (variants.length === 0) {
    errors.push(
      "Javoblar fayli berilmadi yoki undan kalit o‘qilmadi — " +
        "to‘g‘ri javoblarsiz test saqlanmaydi.",
    );
  }

  const matched = matchAnswerKey(parsed.tests, variants);
  const tests: ParsedTest[] = [];
  const numbers: number[][] = [];
  const pending: PendingQuestion[] = [];

  parsed.tests.forEach((test, index) => {
    const key = matched.get(index);
    const notes: string[] = [];

    if (!key) {
      notes.push(`"${test.title}" uchun javoblar kaliti topilmadi.`);
    }

    /*
     * `pending` dagi `test` maydoni CHIQISHDAGI tartib raqami
     * bo'lishi kerak, kirishdagi emas: savoli yo'q test ro'yxatga
     * qo'shilmaydi va raqamlar siljib ketadi.
     */
    const waiting: PendingQuestion[] = [];
    const kept: number[] = [];

    const questions = test.questions
      .filter((question) => {
        const answer = key?.answers.get(question.number);

        if (question.flags.length > 0) {
          notes.push(`${question.number}-savol: ${question.flags.join("; ")}`);

          /*
           * Javobi bor bo'lsa, savolni modelga yuborib tiklash
           * mumkin. Javobi yo'q bo'lsa yuborishning ma'nosi yo'q —
           * to'g'ri javobsiz savol baribir saqlanmaydi.
           */
          if (answer) {
            waiting.push({
              test: -1,
              number: question.number,
              source: question.source,
              correct: answer,
              why: question.flags.join("; "),
            });
          }

          return false;
        }

        if (!answer) {
          notes.push(`${question.number}-savol: javob kalitida yo'q.`);
          return false;
        }

        kept.push(question.number);

        return true;
      })
      .map((question) => ({
        type: "choice" as const,
        text: question.text,
        options: {
          a: question.options.A ?? "",
          b: question.options.B ?? "",
          c: question.options.C ?? "",
          d: question.options.D ?? "",
        },
        correct: key?.answers.get(question.number) as "A" | "B" | "C" | "D",
        solution: null,
        solutionVideo: null,
      }));

    if (questions.length > 0) {
      for (const item of waiting) item.test = tests.length;

      pending.push(...waiting);
      numbers.push(kept);

      tests.push({
        title: test.title,
        description: null,
        questions,
        notes,
      });
    } else {
      errors.push(...notes);
    }
  });

  /*
   * Yakuniy hisobot bu yerda yozilmaydi: modeldan keyin savollar
   * soni o'zgaradi va eski raqam yolg'on bo'lib qoladi. Hisobni
   * route.ts oxirida, hamma bosqich tugagach chiqaradi.
   */

  return {
    tests,
    numbers,
    pending,
    errors,
    total: parsed.total,
    clean: parsed.clean,
  };
}


/**
 * PDF javoblar kalitini `.tex` kalitining ko'rinishiga keltirish.
 *
 * Nega kerak: savollar `.tex` dan o'qilganda ham javoblar PDF'da
 * qolgan bo'lishi mumkin. Ikkala manbani bitta ko'rinishga
 * keltirsak, birlashtirish kodi bitta bo'ladi.
 *
 * Kalitdagi yorliq test raqamini o'z ichiga oladi:
 *     "2-variant (1-TEST)"  ->  1-test
 */
export async function answerKeyFromPdf(
  buffer: Buffer,
): Promise<TexAnswerKey> {
  const tests = new Map<number, Map<number, "A" | "B" | "C" | "D">>();
  const errors: string[] = [];

  const { lines } = await extractLines(buffer);
  const variants = parsePdfAnswerKey(lines);

  for (const variant of variants) {
    const found = variant.label.match(/(\d{1,2})\s*-\s*test/i);

    if (!found) continue;

    tests.set(Number(found[1]), variant.answers);
  }

  if (tests.size === 0) {
    errors.push(
      "Javoblar PDF'idan kalit o'qilmadi " +
        "(\"2-variant (1-TEST)\" ko'rinishidagi sarlavha topilmadi).",
    );
  }

  return { tests, errors };
}

/**
 * Model tiklagan savollarni o'z joyiga qo'yish.
 *
 * Savollar test ichida RAQAMI bo'yicha tartiblangan, shuning
 * uchun tiklangan savol oxiriga emas, o'z o'rniga qo'yiladi —
 * aks holda 16-savol 20-savoldan keyin turib qoladi.
 */
export function mergeFixes(
  result: OfflineImport,
  fixes: Array<{
    test: number;
    number: number;
    text: string;
    options: { a: string; b: string; c: string; d: string };
  }>,
  answerOf: (test: number, number: number) => "A" | "B" | "C" | "D" | null,
): number {
  let added = 0;

  for (const fix of [...fixes].sort((a, b) => a.number - b.number)) {
    const test = result.tests[fix.test];
    const order = result.numbers[fix.test];

    if (!test || !order) continue;

    const correct = answerOf(fix.test, fix.number);

    if (!correct) continue;

    let at = order.findIndex((number) => number > fix.number);
    if (at === -1) at = order.length;

    order.splice(at, 0, fix.number);

    test.questions.splice(at, 0, {
      type: "choice",
      text: fix.text,
      options: fix.options,
      correct,
      solution: null,
      solutionVideo: null,
    });

    added += 1;
  }

  return added;
}

/** Natija AI'siz qoniqarlimi */
export function isOfflineGoodEnough(result: OfflineImport): boolean {
  if (result.total === 0 || result.tests.length === 0) return false;

  const saved = result.tests.reduce(
    (sum, test) => sum + test.questions.length,
    0,
  );

  return saved / result.total >= MIN_CLEAN_RATIO;
}
