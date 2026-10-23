/**
 * Aloqa ma'lumotlari — bitta manba.
 *
 * Ilgari admin username faqat `NEXT_PUBLIC_TELEGRAM_ADMIN_USERNAME`
 * muhit o'zgaruvchisidan olinardi. Amalda bu chalkashlik keltirdi:
 * kodda yangi qiymat tursa ham, Vercel'dagi eski qiymat ustun
 * kelib, sayt eski usernamega yo'naltiraverdi.
 *
 * Shu sababli qiymat endi shu yerda turadi. O'zgartirish kerak
 * bo'lsa faqat shu qatorni yangilang — sayt bo'ylab hamma joyda
 * o'zgaradi.
 */
export const TELEGRAM_ADMIN_USERNAME = "vepa_uz_admin";

/** Kanal va ijtimoiy tarmoqlar */
export const TELEGRAM_CHANNEL_USERNAME = "vepa_ustoz";
export const INSTAGRAM_USERNAME = "vepa_ustoz";

/** @ belgisisiz, toza username */
export function cleanUsername(value: string) {
  return value.trim().replace(/^@+/, "");
}
