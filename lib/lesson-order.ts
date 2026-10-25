/*
 * Videodarslarning bo'lim ichidagi tartibi.
 *
 * Admin darsga tartib raqamini o'zi beradi. Shu raqam band bo'lsa,
 * o'sha joydagi va undan keyingi darslar bir pog'ona suriladi.
 * Natijada bo'limdagi raqamlar doim 1, 2, 3, ... bo'lib qoladi.
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
 * Darsni berilgan o'ringa qo'yganda har bir darsning yangi raqami.
 * O'rin 1 dan kichik bo'lsa birinchi, darslar sonidan katta bo'lsa
 * oxirgi o'ringa tushadi.
 */
export function placeLesson(
  lessons: LessonOrderRow[],
  lessonId: number,
  position: number,
): LessonOrderUpdate[] {
  const ordered = [...lessons]
    .sort(
      (a, b) =>
        a.order_number - b.order_number || a.id - b.id,
    )
    .map((lesson) => lesson.id)
    .filter((id) => id !== lessonId);

  const index = Math.min(
    Math.max(Math.trunc(position) - 1, 0),
    ordered.length,
  );

  ordered.splice(index, 0, lessonId);

  return ordered.map((id, i) => ({
    id,
    order_number: i + 1,
  }));
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
      lessons.length,
      ...lessons.map((lesson) => lesson.order_number),
    ) + 1;

  return [
    { id: lessonId, order_number: parkingSpot },
    ...decreasing,
    ...increasing,
    moving,
  ];
}
