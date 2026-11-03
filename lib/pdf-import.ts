/**
 * Testning tuzilishi — TURLAR.
 *
 * Bu fayl ilgari PDF'ni Gemini/Claude ga yuborib test ajratadigan
 * katta modul edi. 2026-10-19 da ajratish butunlay boshqa yo'lga
 * o'tdi:
 *
 *   `.tex` manbadan  -> lib/tex-savollar.ts   (asosiy yo'l, bepul)
 *   PDF'dan          -> lib/pdf-offline.ts    (qoidalar bilan)
 *   qolgan savollar  -> lib/pdf-ai-tuzatish.ts (faqat kerak bo'lsa)
 *
 * Eski kod (model so'rovlari, PDF bo'laklash, tekshiruvlar) hech
 * qayerdan chaqirilmay qolgandi — 2026-10-23 da olib tashlandi.
 * Fayl nomi ataylab o'zgartirilmadi: turlarni o'nlab joy import
 * qiladi, nomni o'zgartirsak shuncha joyni tahrirlash kerak
 * bo'lardi va foydasi yo'q.
 */

export type ParsedChoiceQuestion = {
  type: "choice";
  text: string;
  options: { a: string; b: string; c: string; d: string };
  correct: "A" | "B" | "C" | "D";
  solution: string | null;
  /** Yechim videosi (YouTube) */
  solutionVideo: string | null;
  /**
   * `.tex` dagi chizma: uni chizadigan LaTeX hujjat. Brauzer uni
   * `/api/admin/tex-chizma` ga yuborib rasm oladi.
   */
  figure?: string | null;
  /** Chizilgan rasm — `data:image/png;base64,...`. Saqlashda bucket'ga yuklanadi */
  image?: string | null;
};

export type ParsedWrittenPart = {
  label: string;
  text: string;
  answer: string;
  accepted?: string[];
  solution?: string | null;
  solutionVideo?: string | null;
};

export type ParsedWrittenQuestion = {
  type: "written";
  text: string | null;
  parts: ParsedWrittenPart[];
};

export type ParsedQuestion =
  | ParsedChoiceQuestion
  | ParsedWrittenQuestion;

export type ParsedTest = {
  title: string;
  description: string | null;
  questions: ParsedQuestion[];
  /** Modelning o'zi shubha bildirgan joylari */
  notes: string[];
};
