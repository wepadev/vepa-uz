/**
 * Kirishdan keyin qaytiladigan manzilni tekshiradi.
 *
 * Faqat sayt ichidagi yo'l (`/tests?...`) qabul qilinadi. `//evil.com`
 * yoki `https://...` kabi tashqi manzil kelsa bosh sahifa qaytadi —
 * aks holda havola orqali o'quvchini begona saytga yuborish mumkin edi.
 */
export function getSafeNext(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/";
  }

  return value;
}

/**
 * Supabase tasdiqlagandan keyin qaytadigan manzil.
 *
 * `next` faqat kerak bo'lganda qo'shiladi: Supabase'dagi "Redirect
 * URLs" ro'yxatida so'roq belgisi bilan manzilga ruxsat bo'lmasa,
 * u Site URL'ga (bosh sahifaga) qaytaradi — ya'ni avvalgidek ishlaydi.
 */
export function authCallbackUrl(next: string) {
  const base = `${window.location.origin}/auth/callback`;

  return next === "/" ? base : `${base}?next=${encodeURIComponent(next)}`;
}
