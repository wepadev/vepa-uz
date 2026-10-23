/**
 * Misollar ro'yxatini matndan o'qish.
 *
 * TOP kitobda bitta mavzuda o'nlab misol bo'ladi, shuning uchun admin
 * panelda ular bittalab emas, ro'yxat bilan kiritiladi. Har bir qator —
 * bitta misol:
 *
 *     12-misol | https://youtu.be/xxxxxxxxxxx
 *     13-misol
 *
 * Havola ixtiyoriy: misolni avval qo'shib, videoni keyinroq qo'yish
 * mumkin. Ajratuvchi — birinchi `|` belgisi.
 *
 * Havolani tekshiruvchi funksiya tashqaridan beriladi (`lib/video-url`).
 * Shu tufayli bu fayl hech narsani import qilmaydi va uni test qilish
 * oson — `lib/video-url.ts` va `lib/grades.ts` kabi.
 */

export const MAX_EXAMPLE_LABEL = 100;
export const MAX_EXAMPLES_PER_BATCH = 100;

export type VideoCheck = (raw: string | null | undefined) => {
  value: string | null;
  error: string | null;
};

export type ParsedExample = {
  label: string;
  videoUrl: string | null;
};

export type ParseExamplesResult = {
  rows: ParsedExample[];
  /** Foydalanuvchiga ko'rsatiladigan xatolar, qator raqami bilan */
  problems: string[];
};

export function parseExampleLines(
  raw: string | null | undefined,
  checkVideo: VideoCheck,
): ParseExamplesResult {
  const lines = String(raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      problems: ["Kamida bitta misol yozing."],
    };
  }

  if (lines.length > MAX_EXAMPLES_PER_BATCH) {
    return {
      rows: [],
      problems: [
        `Bir martada ${MAX_EXAMPLES_PER_BATCH} tagacha misol qo‘shish mumkin.`,
      ],
    };
  }

  const rows: ParsedExample[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    const number = index + 1;
    const cut = line.indexOf("|");
    const label = (cut >= 0 ? line.slice(0, cut) : line).trim();
    const urlText = cut >= 0 ? line.slice(cut + 1).trim() : "";

    if (label.length === 0) {
      problems.push(`${number}-qator: misol nomini yozing.`);
      return;
    }

    if (label.length > MAX_EXAMPLE_LABEL) {
      problems.push(
        `${number}-qator: misol nomi ${MAX_EXAMPLE_LABEL} ta belgidan oshmasin.`,
      );
      return;
    }

    const key = label.toLowerCase();

    if (seen.has(key)) {
      problems.push(
        `${number}-qator: “${label}” ro‘yxatda takrorlanyapti.`,
      );
      return;
    }

    const video = checkVideo(urlText);

    if (video.error) {
      problems.push(`${number}-qator: ${video.error}`);
      return;
    }

    seen.add(key);
    rows.push({ label, videoUrl: video.value });
  });

  /*
   * Xato bo'lsa hech narsa qaytarilmaydi: ro'yxat yo to'liq qo'shiladi,
   * yo umuman qo'shilmaydi. Yarmi tushib, yarmi qolib ketsa admin
   * qaysi biri kirganini qidirib o'tirishi kerak bo'lardi.
   */
  return {
    rows: problems.length > 0 ? [] : rows,
    problems,
  };
}
