/**
 * Oddiy "shuncha vaqtda shuncha marta" cheklovi.
 *
 * Xotirada saqlanadi, ya'ni har bir server nusxasi (Vercel
 * funksiyasi) o'z hisobini yuritadi. Bu mukammal himoya emas,
 * lekin bitta manzildan ketma-ket yuborilgan yuzlab so'rovni
 * to'xtatish uchun yetarli — ochiq yo'llarda (masalan,
 * /api/report-error) Telegram botini spamdan saqlaydi.
 */
export type RateLimiter = {
  /** true — ruxsat, false — limit tugagan */
  take: (key: string, now?: number) => boolean;
};

export function createRateLimiter(options: {
  /** oyna ichida ruxsat etilgan so'rovlar soni */
  limit: number;
  /** oyna uzunligi, millisekund */
  windowMs: number;
  /** xotirada saqlanadigan kalitlar soni chegarasi */
  maxKeys?: number;
}): RateLimiter {
  const { limit, windowMs, maxKeys = 1000 } = options;
  const hits = new Map<string, number[]>();

  return {
    take(key, now = Date.now()) {
      const from = now - windowMs;
      const list = (hits.get(key) ?? []).filter((at) => at > from);

      if (list.length >= limit) {
        hits.set(key, list);
        return false;
      }

      list.push(now);
      hits.set(key, list);

      // Xotira cheksiz o'smasin: eng eski kalitlarni tashlaymiz
      if (hits.size > maxKeys) {
        for (const [k, times] of hits) {
          if (hits.size <= maxKeys) break;
          if (times.every((at) => at <= from) || k !== key) hits.delete(k);
        }
      }

      return true;
    },
  };
}

/** So'rov yuborgan manzil (Vercel `x-forwarded-for` ni o'zi qo'yadi) */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }

  return headers.get("x-real-ip") ?? "nomalum";
}
