/**
 * Variantlarni aralashtirish.
 *
 * Aralashtirish tartibi foydalanuvchi + test + savol dan kelib chiqib
 * hisoblanadi. Ya'ni:
 *   - har bir o'quvchida boshqacha tartib chiqadi;
 *   - sahifa yangilansa ham tartib o'zgarmaydi;
 *   - bazaga hech narsa saqlanmaydi.
 */

/** Matndan barqaror son (FNV-1a) */
function hashSeed(input: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

/** Barqaror tasodifiy sonlar generatori (mulberry32) */
function makeRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ba'zi variantlarni joyidan qo'zg'atib bo'lmaydi:
 * "Barchasi to'g'ri", "To'g'ri javob yo'q" kabi variantlar
 * ma'no jihatidan oxirida turishi kerak.
 */
const FIXED_PATTERNS = [
  "barchasi",
  "hammasi",
  "yuqoridagi",
  "to‘g‘ri javob yo‘q",
  "to'g'ri javob yo'q",
  "javob yo‘q",
  "javob yo'q",
  "hech biri",
  "barcha javob",
];

export function hasFixedOption(
  texts: Array<string | null | undefined>,
): boolean {
  return texts.some((text) => {
    if (!text) return false;

    const normalized = text.toLowerCase();

    return FIXED_PATTERNS.some((pattern) =>
      normalized.includes(pattern),
    );
  });
}

/**
 * Ro'yxatni barqaror tarzda aralashtiradi (Fisher–Yates).
 * Bir xil `seed` har doim bir xil natija beradi.
 */
export function stableShuffle<T>(items: T[], seed: string): T[] {
  const result = [...items];
  const random = makeRandom(hashSeed(seed));

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

const DISPLAY_LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Variantlarni aralashtirib, ko'rsatiladigan harflarni qayta beradi.
 *
 * `letter` — asl harf, javob shu ko'rinishda yuboriladi.
 * `displayLetter` — o'quvchi ekranda ko'radigan harf.
 *
 * "Barchasi to'g'ri" kabi variant bo'lsa, aralashtirish o'tkazilmaydi.
 */
export function shuffleOptions<
  T extends { letter: string; text: string },
>(options: T[], seed: string): Array<T & { displayLetter: string }> {
  const keepOrder =
    options.length < 2 ||
    hasFixedOption(options.map((option) => option.text));

  const ordered = keepOrder
    ? options
    : stableShuffle(options, seed);

  return ordered.map((option, index) => ({
    ...option,
    displayLetter: DISPLAY_LETTERS[index] ?? option.letter,
  }));
}
