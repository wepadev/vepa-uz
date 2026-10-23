/**
 * "Guruhlar uchun maxsus testlar" yo'nalishi.
 *
 * Bu yo'nalish test katalogida ataylab yopiq turadi (is_published = false),
 * shuning uchun o'quvchi uni ko'rmaydi. Ichidagi testlar faqat guruhga
 * uy vazifasi qilib berilganda ochiladi.
 *
 * Bog'liq SQL: db/06-guruh-testlari.sql
 */
export const GROUP_EXAM_CODE = "guruh-testlari";

export const GROUP_EXAM_TITLE = "Guruhlar uchun maxsus testlar";

/** Guruh vazifasi uchun tanlanadigan test */
export type GroupTestOption = {
  test_id: number;
  test_title: string;
  section_title: string;
  question_count: number;
};
