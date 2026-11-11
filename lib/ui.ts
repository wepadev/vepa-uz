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
  "rounded-2xl border border-mb-line bg-white";

/** Karta ichidagi odatiy bo'shliq */
export const cardPad = "p-4 sm:p-5";

/** Bosiladigan karta — ustiga kelganda ko'tariladi */
export const cardHover =
  "press transition sm:hover:border-slate-300 sm:hover:shadow-md";

/** Asosiy amal tugmasi */
export const btnPrimary =
  "press btn-solid inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mb-brand px-4 text-sm font-bold text-white transition hover:bg-mb-brandDark disabled:cursor-not-allowed disabled:opacity-60";

/** Ikkinchi darajali tugma */
export const btnGhost =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50";

/** Xavfli amal (o'chirish) */
export const btnDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50";

/** Kulrang raqamli belgi */
export const chip =
  "rounded-md border border-mb-line bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600";

/** Sahifaning asosiy qismi */
export const pageSection =
  "mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8";

/** Bo'lim sarlavhasi (h2) */
export const sectionTitle = "font-serif text-xl font-bold sm:text-2xl";

/** Kiritish maydoni */
export const field =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100";
