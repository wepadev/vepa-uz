import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Ota-ona hisoboti uchun imzoli kod: "<o'quvchi id>-<imzo>".
 *
 * Imzo serverdagi maxfiy kalit bilan hisoblanadi, shuning uchun
 * id ni o'zgartirib boshqa o'quvchining hisobotini ochib bo'lmaydi.
 * Bazaga hech narsa yozilmaydi — kod har safar qayta hisoblanadi.
 */

const SIGNATURE_LENGTH = 22;

function sign(studentId: number, secret: string) {
  return createHmac("sha256", secret)
    .update(`ota-ona:${studentId}`)
    .digest("base64url")
    .slice(0, SIGNATURE_LENGTH);
}

export function createParentToken(studentId: number, secret: string) {
  return `${studentId}-${sign(studentId, secret)}`;
}

/** To'g'ri kod bo'lsa o'quvchi id sini, aks holda `null` qaytaradi */
export function readParentToken(token: string, secret: string) {
  const match = /^(\d{1,12})-([A-Za-z0-9_-]+)$/.exec(token);

  if (!match) return null;

  const studentId = Number(match[1]);
  const expected = Buffer.from(sign(studentId, secret));
  const given = Buffer.from(match[2]);

  if (
    !Number.isSafeInteger(studentId) ||
    studentId <= 0 ||
    given.length !== expected.length ||
    !timingSafeEqual(given, expected)
  ) {
    return null;
  }

  return studentId;
}
