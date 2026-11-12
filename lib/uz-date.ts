/**
 * Sana — yangi alifboda (ş, ç). Brauzerning `uz-UZ` formati eski
 * yozuvda ("seshanba") qaytaradi, şuning uçun nomlar şu yerda.
 * Vaqt mintaqasi: Toşkent (UTC+5, yozgi vaqt yöq).
 */
const DAYS = [
  "Yakşanba",
  "Duşanba",
  "Seşanba",
  "Çorşanba",
  "Payşanba",
  "Juma",
  "Şanba",
];

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

/** "Seşanba, 11-noyabr" */
export function todayLabel(now = Date.now()) {
  const tashkent = new Date(now + 5 * 3_600_000);

  return `${DAYS[tashkent.getUTCDay()]}, ${tashkent.getUTCDate()}-${MONTHS[tashkent.getUTCMonth()]}`;
}
