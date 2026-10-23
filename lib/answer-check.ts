/**
 * Test javoblarini kalit bilan solishtirish.
 *
 * Bu fayl ataylab hech narsani import qilmaydi — shuning uchun uni
 * `tests/` dagi testlar `../lib/answer-check.ts` ko'rinishida to'g'ridan
 * to'g'ri chaqira oladi (`lib/video-url.ts` va `lib/grades.ts` kabi).
 */

/** Bitta savol natijasi */
export type Mark =
  /** to'g'ri belgilangan */
  | "correct"
  /** xato belgilangan */
  | "wrong"
  /** javob berilmagan (yoki yetmay qolgan) */
  | "blank"
  /** kalitda javob yo'q — bu savol baholanmaydi */
  | "nokey";

export type CheckRow = {
  /** savol raqami, 1 dan boshlanadi */
  n: number;
  /** foydalanuvchi belgilagani: "A".."D" yoki null */
  given: string | null;
  /** to'g'ri javob: "A".."D" yoki null (kalitda yo'q) */
  key: string | null;
  mark: Mark;
};

export type CheckResult = {
  rows: CheckRow[];
  /** baholanadigan savollar soni (kaliti bor) */
  total: number;
  correct: number;
  wrong: number;
  /** kaliti bor, lekin javob berilmagan */
  blank: number;
  /** kaliti yo'q — baholanmaydi */
  noKey: number;
  /** to'g'rilar foizi, 0..100 */
  percent: number;
  /** kiritilgan javoblar soni */
  givenCount: number;
  /** kalitdagi savollar soni */
  expectedCount: number;
  /** kiritilgan javob kalitdagidan ko'p bo'lsa — ortiqchasi soni */
  extraCount: number;
};

const LETTERS = "ABCD";
/** Javob berilmagan savolni belgilash uchun */
const BLANK = "?";

/**
 * Erkin yozilgan javoblarni harflar ro'yxatiga aylantiradi.
 *
 * "ABCD", "A B C D", "1. A  2. B", "1) a, 2) b" — hammasi ishlaydi:
 * A-D harflari tartib bilan olinadi, raqam va tinish belgilari
 * tashlab yuboriladi. Savolni o'tkazib yuborgan bo'lsangiz `?` qo'ying.
 */
export function parseGivenAnswers(
  raw: string | null | undefined,
): string[] {
  const out: string[] = [];

  for (const ch of String(raw ?? "")) {
    const up = ch.toUpperCase();

    if (LETTERS.includes(up)) {
      out.push(up);
      continue;
    }

    if (up === BLANK) {
      out.push(BLANK);
    }
  }

  return out;
}

/**
 * Javoblarni kalit bilan solishtiradi.
 *
 * `key` — kalitdagi harflar ketma-ketligi; `?` bo'lsa o'sha savolning
 * javobi kalitda yo'q va u umumiy ballga kirmaydi.
 */
export function gradeAnswers(
  raw: string | null | undefined,
  key: string,
): CheckResult {
  const given = parseGivenAnswers(raw);
  const expectedCount = key.length;

  const rows: CheckRow[] = [];
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let noKey = 0;

  for (let i = 0; i < expectedCount; i += 1) {
    const keyCh = key[i]?.toUpperCase() ?? BLANK;
    const givenCh = given[i] ?? null;

    if (!LETTERS.includes(keyCh)) {
      noKey += 1;
      rows.push({ n: i + 1, given: givenCh === BLANK ? null : givenCh, key: null, mark: "nokey" });
      continue;
    }

    if (givenCh === null || givenCh === BLANK) {
      blank += 1;
      rows.push({ n: i + 1, given: null, key: keyCh, mark: "blank" });
      continue;
    }

    if (givenCh === keyCh) {
      correct += 1;
      rows.push({ n: i + 1, given: givenCh, key: keyCh, mark: "correct" });
    } else {
      wrong += 1;
      rows.push({ n: i + 1, given: givenCh, key: keyCh, mark: "wrong" });
    }
  }

  const total = expectedCount - noKey;

  return {
    rows,
    total,
    correct,
    wrong,
    blank,
    noKey,
    percent: total > 0 ? Math.round((correct / total) * 100) : 0,
    givenCount: given.length,
    expectedCount,
    extraCount: Math.max(0, given.length - expectedCount),
  };
}
