import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Mini App'ga havola orqali beriladigan parametr (`startapp=...`).
 *
 * Telegram faqat [A-Za-z0-9_-] belgilarni va 512 tagaça uzunlikni
 * qabul qiladi, şuning uçun ikki xil qiymat bor:
 *
 *   p_<base64url>   — sayt içidagi sahifa: t.me/bot?startapp=p_L21vY2s
 *                     ilovani darrov /mock da oçadi
 *   L_<id>_<muddat>_<imzo> — saytdagi hisobni Telegram'ga ulaş kodi.
 *                     Profil sahifasida yasaladi, 30 daqiqa yaroqli.
 *                     Imzo SUPABASE_SECRET_KEY bilan (ota-ona kodi kabi),
 *                     bazaga hech narsa yozilmaydi.
 */

const UUID_HEX = /^[0-9a-f]{32}$/;
const SIGNATURE_LENGTH = 22;
export const LINK_TOKEN_TTL = 30 * 60;

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function pathStartParam(path: string) {
  const param = `p_${toBase64Url(path)}`;
  return param.length <= 512 ? param : null;
}

/** `p_...` dan xavfsiz ički yöl, boşqa hollarda `null` */
export function readPathStartParam(param: string | null | undefined) {
  if (!param?.startsWith("p_")) return null;

  let path: string;

  try {
    path = Buffer.from(param.slice(2), "base64url").toString("utf8");
  } catch {
    return null;
  }

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\") ||
    /[\u0000-\u001f]/.test(path)
  ) {
    return null;
  }

  return path;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`telegram-ulaş:${payload}`)
    .digest("base64url")
    .slice(0, SIGNATURE_LENGTH);
}

export function createLinkToken(
  userId: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
) {
  const id = userId.replace(/-/g, "").toLowerCase();
  const expires = (now + LINK_TOKEN_TTL).toString(36);
  const payload = `${id}_${expires}`;
  return `L_${payload}_${sign(payload, secret)}`;
}

/** Töğri va muddati ötmagan kod bölsa foydalanuvçi id sini qaytaradi */
export function readLinkToken(
  token: string | null | undefined,
  secret: string,
  now = Math.floor(Date.now() / 1000),
) {
  if (!token || !secret) return null;

  const match = /^L_([0-9a-f]{32})_([0-9a-z]{1,10})_([A-Za-z0-9_-]+)$/.exec(
    token,
  );

  if (!match || !UUID_HEX.test(match[1])) return null;

  const payload = `${match[1]}_${match[2]}`;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(match[3]);

  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  if (parseInt(match[2], 36) < now) return null;

  const hex = match[1];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
