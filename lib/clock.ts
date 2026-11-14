/**
 * Sarflangan vaqt: "3:09" (1 soatdan kam) yoki "1:03:09".
 * Ilgari hamma joyda "00:03:09" edi — kiçik kataklarga sig'masdi.
 */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}
