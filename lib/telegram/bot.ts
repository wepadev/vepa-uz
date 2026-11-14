import "server-only";

import { createHash } from "node:crypto";

import { getAppBotToken } from "@/lib/telegram/config";

const TELEGRAM_API = "https://api.telegram.org";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://vepa.uz"
).replace(/\/$/, "");

/** Mini App manzili — BotFather'dagi "Main App" ham şu */
export const miniAppUrl = `${siteUrl}/tg`;

/*
 * Webhook maxfiy so'zi tokendan hisoblanadi: alohida o'zgaruvçi
 * kerak emas. Telegram uni har so'rovda
 * X-Telegram-Bot-Api-Secret-Token sarlavhasida qaytaradi.
 */
export function webhookSecret(token = getAppBotToken()) {
  return createHash("sha256")
    .update(`vepa-webhook:${token}`)
    .digest("hex")
    .slice(0, 48);
}

export async function callBot<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const token = getAppBotToken();

  if (!token) return { ok: false, description: "TELEGRAM_APP_BOT_TOKEN yöq" };

  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return (await response.json().catch(() => ({
    ok: false,
    description: `HTTP ${response.status}`,
  }))) as { ok: boolean; result?: T; description?: string };
}

/** Ilovani oçadigan tugma (xabar ostida) */
export function openAppKeyboard(text = "Ilovani oçiş", path?: string) {
  const url = path ? `${miniAppUrl}?p=${encodeURIComponent(path)}` : miniAppUrl;
  return { inline_keyboard: [[{ text, web_app: { url } }]] };
}
