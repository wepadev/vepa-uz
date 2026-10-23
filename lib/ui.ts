/**
 * Umumiy ko'rinish qoidalari — bitta manba.
 *
 * Maqsad: sayt va admin panel bir xil "tilda" gapirsin. Bu yerdagi
 * qiymatlar Tailwind klasslari, ya'ni istalgan joyda shunchaki
 * qo'shib yuboriladi:
 *
 *   <div className={card}>…</div>
 *   <button className={btnPrimary}>Saqlash</button>
 *
 * Qoidalar qisqa: kartalar `rounded-2xl`, tugmalar `rounded-xl`,
 * sarlavhalar `font-bold` (qora emas), chegara doim `mb-line`.
 */

/** Oq karta — ro'yxat, forma va blok uchun asos */
export const card =
  "rounded-2xl border border-mb-line bg-white shadow-sm";

/** Karta ichidagi odatiy bo'shliq */
export const cardPad = "p-4 sm:p-5";

/** Bosiladigan karta — ustiga kelganda ko'tariladi */
export const cardHover =
  "transition sm:hover:-translate-y-0.5 sm:hover:shadow-md";

/** Asosiy amal tugmasi */
export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mb-brand px-4 text-sm font-bold text-white transition hover:bg-mb-brandDark disabled:cursor-not-allowed disabled:opacity-60";

/** Ikkinchi darajali tugma */
export const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

/** Xavfli amal (o'chirish) */
export const btnDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50";

/** Kulrang raqamli belgi */
export const chip =
  "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600";

/** Sahifaning asosiy qismi */
export const pageSection =
  "mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8";

/** Bo'lim sarlavhasi (h2) */
export const sectionTitle = "text-lg font-bold sm:text-xl";

/** Kiritish maydoni */
export const field =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100";
