/**
 * Darslik yechimlari qamrab oladigan sinflar.
 *
 * Bir joyda turibdi, chunki oraliq ikki joyda kerak bo'ladi:
 * admin formasidagi ro'yxatda va serverdagi tekshiruvda. Ilgari
 * ikkalasida 1–12 deb yozilgan edi va ular bir-biridan xabarsiz
 * o'zgarib ketishi mumkin edi.
 */
export const MIN_GRADE = 5;
export const MAX_GRADE = 11;

/** [5, 6, 7, 8, 9, 10, 11] */
export const GRADES = Array.from(
  { length: MAX_GRADE - MIN_GRADE + 1 },
  (_, index) => MIN_GRADE + index,
);

export function isValidGrade(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_GRADE &&
    value <= MAX_GRADE
  );
}
