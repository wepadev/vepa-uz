/**
 * Xato xabarnomasi.
 *
 * Nega Sentry emas: u yangi paket o'rnatishni talab qiladi, loyihaga
 * qo'shimcha og'irlik va yana bitta akkaunt qo'shadi. Sizda esa
 * Telegram allaqachon bor. Shuning uchun xato yuz berganda bot
 * to'g'ridan-to'g'ri sizga yozadi — bog'liqliksiz, bepul.
 *
 * Kerak bo'ladigan muhit o'zgaruvchilari:
 *   TELEGRAM_BOT_TOKEN     — mavjud botingizning tokeni
 *   TELEGRAM_ERROR_CHAT_ID — xabar keladigan chat (sizning id ingiz)
 *
 * Xato xabarlarini alohida botga ajratmoqchi bo'lsangiz,
 * TELEGRAM_ERROR_BOT_TOKEN qo'shing — u ustun keladi.
 *
 * Ular sozlanmagan bo'lsa modul jim turadi va faqat serverga yozadi
 * (Vercel → Logs bo'limida ko'rinadi). Ya'ni sayt baribir ishlaydi.
 */

type ErrorReport = {
  /** Xato matni */
  message: string;
  /** Qayerda yuz berdi: "server", "brauzer", "api" */
  where: string;
  /** Next.js bergan digest — Vercel loglaridan topish uchun */
  digest?: string | null;
  /** Qaysi sahifada */
  url?: string | null;
  /** Qo'shimcha ma'lumot */
  detail?: string | null;
};

/*
 * Bir xil xato takrorlanaversa Telegram to'lib ketmasin.
 * Serversiz muhitda bu xotira uzoq yashamaydi, lekin bitta
 * nosozlik yuzlab xabar yuborishining oldini oladi.
 */
const recent = new Map<string, number>();
const QUIET_MS = 10 * 60 * 1000;

function isDuplicate(key: string) {
  const now = Date.now();
  const last = recent.get(key);

  // Eskirgan yozuvlarni tozalab turamiz
  if (recent.size > 100) {
    for (const [k, at] of recent) {
      if (now - at > QUIET_MS) recent.delete(k);
    }
  }

  if (last && now - last < QUIET_MS) {
    return true;
  }

  recent.set(key, now);
  return false;
}

function trim(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export type ReportResult = {
  delivered: boolean;
  /** Yetkazilmagan bo'lsa — sababi (tashxis sahifasi uchun) */
  reason?: string;
};

export async function reportError(
  report: ErrorReport,
): Promise<ReportResult> {
  const line = [
    `[${report.where}]`,
    report.message,
    report.digest ? `digest=${report.digest}` : "",
    report.url ? `url=${report.url}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Vercel loglariga har doim yozamiz
  console.error("XATO:", line, report.detail ?? "");

  // Alohida bot ko'rsatilgan bo'lsa o'shani, bo'lmasa umumiysini
  const token =
    process.env.TELEGRAM_ERROR_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN;

  const chatId = process.env.TELEGRAM_ERROR_CHAT_ID;

  if (!token || !chatId) {
    return {
      delivered: false,
      reason: !token
        ? "TELEGRAM_BOT_TOKEN sozlanmagan"
        : "TELEGRAM_ERROR_CHAT_ID sozlanmagan",
    };
  }

  if (isDuplicate(`${report.where}:${report.message}`)) {
    return {
      delivered: false,
      reason: "Bu xato yaqinda yuborilgan (10 daqiqalik tösiq)",
    };
  }

  const text = [
    "⚠️ Vepa Ustoz — xatolik",
    "",
    `Qayerda: ${report.where}`,
    report.url ? `Sahifa: ${report.url}` : null,
    "",
    trim(report.message, 500),
    report.detail ? `\n${trim(report.detail, 800)}` : null,
    report.digest ? `\ndigest: ${report.digest}` : null,
  ]
    .filter((row) => row !== null)
    .join("\n");

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      },
    );

    if (response.ok) {
      return { delivered: true };
    }

    /*
     * Telegram xatoni tushunarli qilib aytadi ("chat not found",
     * "bot was blocked by the user", "Unauthorized) — o'shani
     * tashxis sahifasiga uzatamiz.
     */
    const body = await response.text();

    return {
      delivered: false,
      reason: `Telegram javobi (${response.status}): ${trim(body, 300)}`,
    };
  } catch (error) {
    /*
     * Xabar ketmasa ham xato tashlamaymiz. Xato haqida xabar
     * berishga urinish yana bitta xato keltirib chiqarmasligi kerak.
     */
    return {
      delivered: false,
      reason: `Tarmoq xatosi: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
