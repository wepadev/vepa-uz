/*
 * Mini App boti sozlamalari (Vercel → Settings → Environment Variables):
 *
 *   TELEGRAM_APP_BOT_TOKEN           — @BotFather bergan token (maxfiy!)
 *   NEXT_PUBLIC_TELEGRAM_BOT_USERNAME — botning nomi, @ siz (masalan vepa_uz_bot)
 *
 * Xatolar boti (TELEGRAM_BOT_TOKEN, lib/report-error.ts) alohida qoladi:
 * u faqat ustozga xabar yuboradi, Mini App esa hamma uçun.
 */

export function getAppBotToken() {
  return process.env.TELEGRAM_APP_BOT_TOKEN?.trim() || "";
}

export function getBotUsername() {
  return (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "")
    .trim()
    .replace(/^@/, "");
}

/** t.me havolasi: Mini App'ni kerakli parametr bilan oçadi */
export function miniAppLink(startParam?: string | null) {
  const username = getBotUsername();
  if (!username) return null;
  return startParam
    ? `https://t.me/${username}?startapp=${encodeURIComponent(startParam)}`
    : `https://t.me/${username}?startapp`;
}
