/**
 * Ustozga Telegram orqali xabar.
 *
 * `report-error.ts` xatolar uchun edi — bu esa oddiy ish xabarlari
 * uchun: sovg'a so'rovi, yangi to'lov va shunga o'xshashlar. Ular
 * xato emas, shuning uchun takroriy xabarni to'suvchi filtr ham,
 * "xato" belgisi ham yo'q.
 *
 * Muhit o'zgaruvchilari `report-error.ts` bilan bir xil:
 *   TELEGRAM_BOT_TOKEN     — botingiz tokeni
 *   TELEGRAM_ERROR_CHAT_ID — xabar keladigan chat
 *
 * Sozlanmagan bo'lsa modul jim turadi va serverga yozadi. Xabar
 * yetib bormagani sababli asosiy ish (sovg'a so'rovi) hech qachon
 * bekor bo'lmasligi kerak.
 */

const TELEGRAM_API = "https://api.telegram.org";

/** Telegram HTML rejimida maxsus belgilarni himoyalash */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function notifyAdmin(title: string, body: string) {
  const token =
    process.env.TELEGRAM_ERROR_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN;

  const chatId = process.env.TELEGRAM_ERROR_CHAT_ID;

  const text = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`;

  if (!token || !chatId) {
    console.log(`[xabar] ${title}\n${body}`);
    return { delivered: false, reason: "sozlanmagan" as const };
  }

  try {
    const response = await fetch(
      `${TELEGRAM_API}/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.slice(0, 3500),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `[xabar] Telegram javobi: ${response.status}`,
      );

      return { delivered: false, reason: "telegram" as const };
    }

    return { delivered: true, reason: null };
  } catch (error) {
    console.error("[xabar] yuborilmadi:", error);

    return { delivered: false, reason: "tarmoq" as const };
  }
}
