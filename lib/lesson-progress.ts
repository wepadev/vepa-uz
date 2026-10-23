/**
 * Darsning tugallanganini aniqlash qoidasi.
 *
 * Bitta darsga bir nechta test biriktiriladi. Keyingi dars
 * ularning O'RTACHA natijasi 90% ga yetganda ochiladi.
 *
 * Ishlanmagan test 0 deb hisoblanadi — shuning uchun uchtadan
 * ikkitasini a'lo ishlab, uchinchisini tashlab ketib bo'lmaydi.
 *
 * Testi yo'q dars hech kimni to'smaydi: ilgari u yerda "videoning
 * 90% ini ko'ring" qoidasi bor edi, lekin videoni haqiqatan
 * ko'rganini tekshirib bo'lmasdi va o'quvchini bekorga to'sardi.
 */
export const LESSON_PASS_PERCENTAGE = 90;

/** Testlarning eng yaxshi natijalari o'rtachasi. Test yo'q bo'lsa null */
export function lessonAverageScore(
  testIds: number[],
  bestScoreMap: Map<number, number>,
) {
  if (testIds.length === 0) {
    return null;
  }

  const total = testIds.reduce(
    (sum, testId) => sum + (bestScoreMap.get(testId) ?? 0),
    0,
  );

  return total / testIds.length;
}

/** Dars tugallanganmi — keyingisini ochish uchun shu tekshiriladi */
export function isLessonPassed(
  testIds: number[],
  bestScoreMap: Map<number, number>,
) {
  const average = lessonAverageScore(testIds, bestScoreMap);

  return average === null || average >= LESSON_PASS_PERCENTAGE;
}

/** Bir necha urinishdan eng yaxshisini oladi */
export function buildBestScoreMap(
  attempts: Array<{ test_id: number; percentage: number | string }>,
) {
  const result = new Map<number, number>();

  for (const attempt of attempts) {
    const score = Number(attempt.percentage);

    if (!Number.isFinite(score)) {
      continue;
    }

    result.set(
      attempt.test_id,
      Math.max(result.get(attempt.test_id) ?? 0, score),
    );
  }

  return result;
}

/** Dars -> testlar ro'yxati */
export function buildLessonTestMap(
  rows: Array<{ lesson_id: number; test_id: number }>,
) {
  const result = new Map<number, number[]>();

  for (const row of rows) {
    result.set(row.lesson_id, [
      ...(result.get(row.lesson_id) ?? []),
      row.test_id,
    ]);
  }

  return result;
}
