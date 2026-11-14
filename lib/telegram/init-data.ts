import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Telegram Mini App'ning `initData` satrini tekşiriş.
 *
 * Telegram ilovani oçganda sahifaga foydalanuvçi haqida satr beradi
 * (`Telegram.WebApp.initData`). Uni brauzerda soxtalaştiriş oson,
 * şuning uçun serverda imzosi tekşiriladi:
 *
 *   secret = HMAC_SHA256(key = "WebAppData", bot_token)
 *   hash   = HMAC_SHA256(key = secret, data_check_string)
 *
 * data_check_string — `hash` dan boşqa hamma maydon, alifbo tartibida,
 * "kalit=qiymat" qatorlari "\n" bilan ulangan.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Fayl faqat `node:crypto` ga tayanadi — tests/ da Next'siz sinaladi.
 */

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

export type VerifiedInitData = {
  user: TelegramUser;
  authDate: number;
  startParam: string | null;
};

/** initData qança vaqt yaroqli (soniya). Ilova oçilgan zahoti yuboriladi. */
export const INIT_DATA_MAX_AGE = 24 * 60 * 60;

function dataCheckString(params: URLSearchParams) {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function signInitData(params: URLSearchParams, botToken: string) {
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secret)
    .update(dataCheckString(params))
    .digest("hex");
}

/** Imzo töğri va muddati ötmagan bölsa ma'lumotni, aks holda `null` qaytaradi */
export function verifyInitData(
  initData: string,
  botToken: string,
  now = Math.floor(Date.now() / 1000),
  maxAge = INIT_DATA_MAX_AGE,
): VerifiedInitData | null {
  if (!initData || !botToken || initData.length > 8192) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;

  const expected = Buffer.from(signInitData(params, botToken), "hex");
  const given = Buffer.from(hash, "hex");

  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));

  if (!Number.isSafeInteger(authDate) || authDate <= 0) return null;
  // Kelajakdagi sana (soat farqi) uçun 5 daqiqa yon beriladi
  if (authDate > now + 300 || now - authDate > maxAge) return null;

  let user: TelegramUser;

  try {
    user = JSON.parse(params.get("user") ?? "");
  } catch {
    return null;
  }

  if (
    !user ||
    typeof user !== "object" ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0
  ) {
    return null;
  }

  return {
    user,
    authDate,
    startParam: params.get("start_param") || null,
  };
}

/** Telegram'dagi ism — profil uçun */
export function telegramFullName(user: TelegramUser) {
  const name = [user.first_name, user.last_name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");

  return (name || user.username || "Öquvçi").slice(0, 80);
}
