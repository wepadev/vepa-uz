/**
 * Brauzerdagi xatoni serverga yuboradi.
 *
 * Xato ekranida chaqiriladi. Hech qachon xato tashlamaydi va
 * javobni kutmaydi — foydalanuvchi ko'radigan sahifaga xalaqit
 * bermasligi kerak.
 */
export function sendErrorReport(
  error: Error & { digest?: string },
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload = JSON.stringify({
      message: error?.message || "Noma'lum xato",
      digest: error?.digest ?? null,
      url: window.location.pathname + window.location.search,
    });

    /*
     * sendBeacon sahifa yopilib ketsa ham xabarni yetkazadi.
     * Qo'llab-quvvatlanmasa oddiy fetch bilan urinamiz.
     */
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/report-error",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }

    void fetch("/api/report-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Xabar ketmasa ham sahifa ishlashda davom etadi
  }
}
