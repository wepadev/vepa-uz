import type { SupabaseClient } from "@supabase/supabase-js";

import { GROUP_EXAM_CODE } from "@/lib/group-tests";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;

/**
 * Naşr qilingan test Testlar bölimida körinsin.
 *
 * Öquvçi testni yönaliş → bölim → mavzu orqali topadi. Üçalasidan
 * biri qoralama bölsa, test naşr qilingan bölsa ham körinmay qolardi:
 * yangi mavzu va bölim har doim qoralama bölib yaratiladi, test esa
 * alohida naşr qilinadi. Natijada "naşr qildim, lekin körinmayapti".
 *
 * Endi test naşr qilinganda (yoki naşr qilingan testi bor mavzu /
 * bölim oçilganda) uning mavzusi, bölimi va yönalişi ham oçiladi.
 * Videodarsga biriktirilgan-biriktirilmaganiga qaralmaydi.
 *
 * Istisno: "Guruhlar uçun maxsus testlar" yönalişi ataylab yopiq
 * turadi — uning testlari faqat uy vazifasi orqali oçiladi.
 *
 * Bog'liq SQL (mavjud testlar uçun bir martalik): db/41.
 */
export async function publishTestParents(
  supabase: Client,
  filter: { testIds?: number[]; topicId?: number; sectionId?: number },
): Promise<string | null> {
  let query = supabase
    .from("tests")
    .select("topic_id, section_id")
    .eq("is_published", true);

  if (filter.testIds) {
    if (filter.testIds.length === 0) return null;
    query = query.in("id", filter.testIds);
  }
  if (filter.topicId) query = query.eq("topic_id", filter.topicId);
  if (filter.sectionId) query = query.eq("section_id", filter.sectionId);

  const { data: tests, error: testsError } = await query;
  if (testsError) return testsError.message;

  const rows = (tests ?? []) as {
    topic_id: number | null;
    section_id: number | null;
  }[];

  const topicIds = [
    ...new Set(rows.map((row) => row.topic_id).filter(isId)),
  ];

  /* Mavzuning bölimi testdagi section_id dan ustun turadi */
  let sectionIds = rows.map((row) => row.section_id).filter(isId);

  if (topicIds.length > 0) {
    const { data: topics, error } = await supabase
      .from("test_topics")
      .select("section_id")
      .in("id", topicIds);

    if (error) return error.message;

    sectionIds = sectionIds.concat(
      ((topics ?? []) as { section_id: number }[]).map((t) => t.section_id),
    );
  }

  sectionIds = [...new Set(sectionIds)];
  if (sectionIds.length === 0) return null;

  const { data: sections, error: sectionsError } = await supabase
    .from("test_sections")
    .select("id, exam_type_id")
    .in("id", sectionIds);

  if (sectionsError) return sectionsError.message;

  const examTypeIds = [
    ...new Set(
      ((sections ?? []) as { exam_type_id: number }[]).map(
        (section) => section.exam_type_id,
      ),
    ),
  ];

  const { data: groupExam, error: groupError } = await supabase
    .from("test_exam_types")
    .select("id")
    .eq("code", GROUP_EXAM_CODE)
    .maybeSingle();

  if (groupError) return groupError.message;

  const groupExamId = (groupExam as { id: number } | null)?.id ?? null;

  if (topicIds.length > 0) {
    const { error } = await supabase
      .from("test_topics")
      .update({ is_published: true })
      .in("id", topicIds)
      .eq("is_published", false);

    if (error) return error.message;
  }

  {
    const { error } = await supabase
      .from("test_sections")
      .update({ is_published: true, updated_at: new Date().toISOString() })
      .in("id", sectionIds)
      .eq("is_published", false);

    if (error) return error.message;
  }

  const visibleExamIds = examTypeIds.filter((id) => id !== groupExamId);

  if (visibleExamIds.length > 0) {
    const { error } = await supabase
      .from("test_exam_types")
      .update({ is_published: true })
      .in("id", visibleExamIds)
      .eq("is_published", false);

    if (error) return error.message;
  }

  return null;
}

function isId(value: number | null): value is number {
  return typeof value === "number" && value > 0;
}
