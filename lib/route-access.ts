/**
 * Qaysi sahifa tizimga kirishni talab qiladi.
 *
 * Ilgari teskari qoida bor edi: "ochiq ro'yxatda bo'lmagan hamma
 * narsa yopiq". Natijada mehmon yo'q manzilni (masalan, eski
 * havolani) ochsa, 404 o'rniga kirish sahifasiga otilardi va
 * kirgandan keyin yana 404 ko'rardi.
 *
 * Endi yopiq bo'limlar aniq sanab o'tilgan. Ro'yxatda bo'lmagan
 * manzil proxy'dan o'tadi: mavjud bo'lsa ochiladi (bosh sahifa,
 * /pricing, /katalog), yo'q bo'lsa "Bunday sahifa topilmadi"
 * chiqadi.
 *
 * `app/` ga yangi yopiq bo'lim qo'shsangiz, shu yerga ham yozing.
 * tests/route-access.test.ts buni eslatadi: app/ dagi har bir
 * papka shu ro'yxatda yoki PUBLIC_SECTIONS da bo'lishi shart.
 */
export const PROTECTED_SECTIONS = [
  "access-denied",
  "access-required",
  "admin",
  "api",
  "dokon",
  "guruhim",
  "homework",
  "leaderboard",
  "lessons",
  "mock",
  "payment",
  "profile",
  "results",
  "takrorlash",
  "tests",
  "textbooks",
] as const;

/** Mehmon ham ochadigan bo'limlar */
export const PUBLIC_SECTIONS = ["auth", "katalog", "ota-ona", "pricing"] as const;

/** Yopiq bo'lim ichidagi, lekin mehmonga ochiq yo'llar */
const PUBLIC_EXCEPTIONS = new Set([
  /* Brauzer xatolari mehmonda ham yuz beradi (ichida o'z cheklovi bor) */
  "/api/report-error",
]);

export function requiresLogin(pathname: string) {
  if (PUBLIC_EXCEPTIONS.has(pathname)) {
    return false;
  }

  const section = pathname.split("/")[1] ?? "";

  return (PROTECTED_SECTIONS as readonly string[]).includes(section);
}
