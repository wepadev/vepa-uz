/**
 * Videoyechim havolasini tekshirish va tozalash.
 *
 * Bir joyda turgani ma'qul: mavzu yaratish va tahrirlash formalari
 * ham, kelajakda boshqa joylar ham shundan foydalanadi.
 */
export type VideoUrlResult = {
  /** Saqlanadigan qiymat. Bo'sh bo'lsa null */
  value: string | null;
  /** Xato matni. Xato bo'lmasa null */
  error: string | null;
};

export function normalizeVideoUrl(
  raw: string | null | undefined,
): VideoUrlResult {
  const text = String(raw ?? "").trim();

  // Bo'sh qoldirish mumkin — video ixtiyoriy
  if (!text) {
    return { value: null, error: null };
  }

  let url: URL;

  try {
    url = new URL(text);
  } catch {
    return {
      value: null,
      error:
        "Havola to‘liq bo‘lishi kerak: https:// bilan boshlansin.",
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      value: null,
      error: "Faqat http yoki https havolasi qabul qilinadi.",
    };
  }

  /*
   * Faqat YouTube. Sayt videoni YouTube pleyeri orqali ko'rsatadi,
   * boshqa manzil qo'yilsa o'quvchida bo'sh joy chiqadi.
   */
  const host = url.hostname.replace(/^www\./, "");

  const allowed = [
    "youtube.com",
    "m.youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
  ];

  if (!allowed.includes(host)) {
    return {
      value: null,
      error: "Hozircha faqat YouTube havolasi qo‘llab-quvvatlanadi.",
    };
  }

  return { value: url.toString(), error: null };
}
