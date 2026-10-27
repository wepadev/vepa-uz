/*
 * Videodarslarning bo'lim ichidagi tartibi.
 *
 * Admin darsga tartib raqamini o'zi beradi va dars AYNAN shu raqam
 * bilan saqlanadi: "Algebra 1-qism" da 11- va 13-dars bo'lishi
 * mumkin, ular 1, 2 ga aylantirilmaydi. Raqam band bo'lsa, o'sha
 * dars bir pog'ona suriladi; uning orqasida zich turganlar ham
 * (12, 13, 14 …) suriladi. Bo'sh joydan keyingilarga tegilmaydi.
 */

export type LessonOrderRow = {
  id: number;
  order_number: number;
};

export type LessonOrderUpdate = {
  id: number;
  order_number: number;
};

/**
 * Formadan kelgan tartib raqamini o'qiydi.
 * Bo'sh qoldirilsa null — "oxiriga qo'yilsin" degani.
 * Noto'g'ri qiymat bo'lsa undefined.
 */
export function parseOrderNumber(
  value: FormDataEntryValue | null,
): number | null | undefined {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const number = Number(text);

  if (!Number.isInteger(number) || number < 1 || number > 10000) {
    return undefined;
  }

  return number;
}

/**
 * Darsni berilgan raqamga qo'yganda har bir darsning yangi raqami.
 * Ko'chirilayotgan dars aynan shu raqamni oladi (1 dan kichik
 * bo'lsa 1). Boshqa darslar faqat to'qnashuv bo'lsa suriladi.
 */
export function placeLesson(
  lessons: LessonOrderRow[],
  lessonId: number,
  position: number,
): LessonOrderUpdate[] {
  const target = Math.max(Math.trunc(position), 1);

  const others = lessons
    .filter((lesson) => lesson.id !== lessonId)
    .sort(
      (a, b) =>
        a.order_number - b.order_number || a.id - b.id,
    );

  const result: LessonOrderUpdate[] = [
    { id: lessonId, order_number: target },
  ];

  /* Oxirgi band raqam: shundan kichik yoki teng turgan dars suriladi */
  let taken = target;

  for (const lesson of others) {
    if (
      lesson.order_number >= target &&
      lesson.order_number <= taken
    ) {
      taken += 1;
      result.push({ id: lesson.id, order_number: taken });
    } else {
      result.push({
        id: lesson.id,
        order_number: lesson.order_number,
      });
    }
  }

  return result.sort(
    (a, b) => a.order_number - b.order_number,
  );
}

/**
 * Bazaga yoziladigan o'zgarishlar, to'qnashuvsiz ketma-ketlikda.
 *
 * Agar (category_id, order_number) noyob bo'lsa ham hech bir qadamda
 * ikki dars bir xil raqamga tushmasligi uchun: avval ko'chirilayotgan
 * dars vaqtincha bo'sh raqamga chiqariladi, so'ng kamayadiganlar
 * o'sish tartibida, ko'payadiganlar kamayish tartibida yangilanadi,
 * oxirida ko'chirilgan dars o'z joyiga tushadi.
 */
export function planLessonReorder(
  lessons: LessonOrderRow[],
  lessonId: number,
  position: number,
): LessonOrderUpdate[] {
  const current = new Map(
    lessons.map((lesson) => [lesson.id, lesson.order_number]),
  );

  const target = placeLesson(lessons, lessonId, position);

  const changed = target.filter(
    (row) => current.get(row.id) !== row.order_number,
  );

  const moving = changed.find((row) => row.id === lessonId);
  const others = changed.filter((row) => row.id !== lessonId);

  const decreasing = others
    .filter((row) => row.order_number < (current.get(row.id) ?? 0))
    .sort((a, b) => a.order_number - b.order_number);

  const increasing = others
    .filter((row) => row.order_number > (current.get(row.id) ?? 0))
    .sort((a, b) => b.order_number - a.order_number);

  if (!moving) {
    return [...decreasing, ...increasing];
  }

  const parkingSpot =
    Math.max(
      ...lessons.map((lesson) => lesson.order_number),
      ...target.map((row) => row.order_number),
    ) + 1;

  return [
    { id: lessonId, order_number: parkingSpot },
    ...decreasing,
    ...increasing,
    moving,
  ];
}
