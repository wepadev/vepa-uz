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

export const GROUP_EXAM_TITLE = "Guruhlar uçun maxsus testlar";

/** Guruh vazifasi uchun tanlanadigan test */
export type GroupTestOption = {
  test_id: number;
  test_title: string;
  section_title: string;
  question_count: number;
};

type SupabaseLike = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/**
 * Bu test faqat uy vazifasi sifatida oçiladimi?
 *
 * Ilgari bu savol bazadagi `is_group_only_test()` dan söralardi.
 * db/26 da u "vazifaga berişga böladimi" degan ma'noga ötkazilib,
 * har bir katalog testiga `true` qaytaradigan bölib qoldi — natijada
 * Testlar bölimidagi birorta test oçilmasdi. Şuning uçun qoida endi
 * şu yerda, aniq yoziladi:
 *
 *   · darsga biriktirilgan test — heç qaçon guruh testi emas;
 *   · testning yönalişi "guruh-testlari" — guruh testi;
 *   · yönaliş öquvçiga körinmaydi (naşr qilinmagan yoki RLS
 *     yaşirgan) — guruh testi, ya'ni faqat vazifa orqali.
 */
export async function isGroupOnlyTest(
  supabase: SupabaseLike,
  testId: number,
): Promise<boolean> {
  const [lessonLink, testRow] = await Promise.all([
    supabase
      .from("lesson_tests")
      .select("test_id")
      .eq("test_id", testId)
      .limit(1),
    supabase
      .from("tests")
      .select("section_id")
      .eq("id", testId)
      .maybeSingle(),
  ]);

  if ((lessonLink.data ?? []).length > 0) return false;

  const sectionId = (testRow.data as { section_id: number | null } | null)
    ?.section_id;

  // Bölimsiz test — katalogda yöq, faqat vazifa orqali
  if (!sectionId) return true;

  const { data: section } = await supabase
    .from("test_sections")
    .select("exam_type_id")
    .eq("id", sectionId)
    .maybeSingle();

  const examTypeId = (section as { exam_type_id: number } | null)
    ?.exam_type_id;

  if (!examTypeId) return true;

  const { data: examType } = await supabase
    .from("test_exam_types")
    .select("code, is_published")
    .eq("id", examTypeId)
    .maybeSingle();

  const exam = examType as { code: string; is_published: boolean } | null;

  if (!exam) return true;

  return exam.code === GROUP_EXAM_CODE || exam.is_published === false;
}

/**
 * Katalog testi bepulmi — Testlar ro'yxatidagi "Bepul" / qulf bilan
 * bir xil qoida (db/35 `math_booster_is_test_free()`):
 * testning özi bepul, mavzusi bepul yoki yönalişning birinçi
 * bölimidagi birinçi mavzu.
 *
 * Bazadagi himoya asosiy; bu tekşiruv baza tuzatilguniça (db/40)
 * Premium testni manzil orqali oçib bölmasligi uçun.
 */
export async function isCatalogTestFree(
  supabase: SupabaseLike,
  testId: number,
): Promise<boolean> {
  const { data: testData } = await supabase
    .from("tests")
    .select("is_free, topic_id, section_id")
    .eq("id", testId)
    .maybeSingle();

  const test = testData as {
    is_free: boolean | null;
    topic_id: number | null;
    section_id: number | null;
  } | null;

  if (!test) return false;
  if (test.is_free) return true;
  if (!test.topic_id || !test.section_id) return false;

  const [{ data: topicData }, { data: sectionData }] = await Promise.all([
    supabase
      .from("test_topics")
      .select("is_free")
      .eq("id", test.topic_id)
      .maybeSingle(),
    supabase
      .from("test_sections")
      .select("exam_type_id")
      .eq("id", test.section_id)
      .maybeSingle(),
  ]);

  if ((topicData as { is_free: boolean } | null)?.is_free) return true;

  const examTypeId = (sectionData as { exam_type_id: number } | null)
    ?.exam_type_id;

  if (!examTypeId) return false;

  const { data: firstSection } = await supabase
    .from("test_sections")
    .select("id")
    .eq("exam_type_id", examTypeId)
    .eq("is_published", true)
    .order("order_number", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const firstSectionId = (firstSection as { id: number } | null)?.id;

  if (!firstSectionId) return false;

  const { data: firstTopic } = await supabase
    .from("test_topics")
    .select("id")
    .eq("section_id", firstSectionId)
    .eq("is_published", true)
    .order("order_number", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (firstTopic as { id: number } | null)?.id === test.topic_id;
}
