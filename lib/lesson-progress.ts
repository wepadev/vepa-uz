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

/**
 * DARS OCHIQMI — bitta joyda yoziladigan qoida.
 *
 * Ikki xil to'siq bor va ular bir-biridan mustaqil:
 *
 *   1. TARIF. Dars Premium obunachiga va adminga ochiq. Obunasi
 *      yo'q o'quvchiga esa faqat qo'lda bepul qilingan dars ochiq
 *      (`lessons.is_free`).
 *
 *   2. NAVBAT. Keyingi dars oldingisining testi 90% ga yetganda
 *      ochiladi. Qo'lda bepul qilingan dars bu navbatdan TASHQARIDA
 *      turadi — unga yetib borish uchun oldingi darslarni o'tish
 *      shart emas, aks holda bepulligining ma'nosi qolmaydi.
 *
 * Bepul darsni ochish navbatni surmaydi: undan keyingi pullik dars
 * baribir o'zidan oldingilari bajarilgandagina ochiladi. Ya'ni
 * bepul dars — navbatga qo'shilgan eshik emas, yon eshik.
 *
 * Darslar ro'yxati EKRANDAGI TARTIBDA berilishi kerak
 * (order_number bo'yicha), chunki navbat shu tartibda hisoblanadi.
 */
export type LessonGateInput = {
  /** `lessons.is_free` — qo'lda bepul qilingan */
  isFree: boolean;
  /** Dars testlarining o'rtachasi 90% ga yetganmi */
  isCompleted: boolean;
};

export type LessonGate = {
  /** Tarif bo'yicha ruxsat bor */
  hasContentAccess: boolean;
  /** Navbat bo'yicha ochiq */
  isSequenceUnlocked: boolean;
  /** Dars haqiqatan ochiq (ikkala shart ham bajarilgan) */
  isOpen: boolean;
};

export function buildLessonGates(
  lessons: LessonGateInput[],
  hasPremiumAccess: boolean,
): LessonGate[] {
  /* Shu paytgacha hamma dars bajarilganmi */
  let chainUnlocked = true;

  return lessons.map((lesson) => {
    const hasContentAccess =
      hasPremiumAccess || lesson.isFree;

    const isSequenceUnlocked =
      chainUnlocked || lesson.isFree;

    chainUnlocked =
      chainUnlocked && lesson.isCompleted;

    return {
      hasContentAccess,
      isSequenceUnlocked,
      isOpen:
        hasContentAccess && isSequenceUnlocked,
    };
  });
}
