/** Qidiruv matnining eng uzun uzunligi */
const MAX_LENGTH = 60;

/**
 * Qidiruv matnini bazaga yuborishdan oldin tozalash.
 *
 * PostgREST `or(...)` shartida vergul, qavs, yulduzcha va foiz
 * belgisi maxsus ma'noga ega. Foydalanuvchi ularni yozib yuborsa
 * so'rov buziladi yoki butunlay boshqa natija qaytaradi.
 *
 * Shuning uchun faqat harf, raqam, bo'sh joy va chiziqcha
 * qoldiriladi. O'zbek tilidagi tutuq belgisi (oʻ, gʻ — U+02BB)
 * Unicode bo'yicha harf hisoblanadi, ya'ni saqlanib qoladi.
 */
export function sanitizeSearchText(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .slice(0, MAX_LENGTH);
}
