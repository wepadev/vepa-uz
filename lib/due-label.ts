/** "3 kun qoldi" / "5 soat qoldi" — vazifa muddatigacha qolgan vaqt */
export function remainingLabel(dueAt: string, now = Date.now()) {
  const ms = new Date(dueAt).getTime() - now;

  if (ms <= 0) {
    return "Muddat tugadi";
  }

  const hours = Math.floor(ms / 3_600_000);

  if (hours >= 48) {
    return `${Math.floor(hours / 24)} kun qoldi`;
  }

  if (hours >= 1) {
    return `${hours} soat qoldi`;
  }

  return `${Math.max(1, Math.floor(ms / 60_000))} daqiqa qoldi`;
}

/** Vazifa muddati: "25.10, 20:00" — Toshkent vaqti bilan */
export function formatDue(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}
