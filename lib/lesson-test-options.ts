import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Videodarsga test biriktirishda ko'rsatiladigan ro'yxat.
 *
 * Testlar "1-test", "2-test" deb nomlangani uchun ularni mavzu
 * bo'yicha guruhlab beramiz: "Algebra 1-qism · 8. Oddiy kasrlar
 * (1-qism)" sarlavhasi ostida 1-test, 2-test, 3-test.
 */

export type LessonTestOption = {
  id: number;
  title: string;
  /** Mavzu bilan to'liq nom: "Oddiy kasrlar (1-qism) · 1-test" */
  label: string;
  isPublished: boolean;
  /** Guruh sarlavhasi: bo'lim va mavzu */
  group: string;
};

type TestRow = {
  id: number;
  title: string;
  is_published: boolean;
  order_number: number | null;
  topic_id: number | null;
  section_id: number | null;
};

type TopicRow = {
  id: number;
  section_id: number;
  title: string;
  order_number: number | null;
};

type SectionRow = {
  id: number;
  exam_type_id: number | null;
  title: string;
  order_number: number | null;
};

type ExamRow = {
  id: number;
  title: string;
  order_number: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;

const NO_TOPIC = "Mavzusiz testlar";

export async function loadLessonTestOptions(
  supabase: Client,
): Promise<LessonTestOption[]> {
  const [testsResult, topicsResult, sectionsResult, examsResult] =
    await Promise.all([
      supabase
        .from("tests")
        .select("id, title, is_published, order_number, topic_id, section_id"),
      supabase
        .from("test_topics")
        .select("id, section_id, title, order_number"),
      supabase
        .from("test_sections")
        .select("id, exam_type_id, title, order_number"),
      supabase.from("test_exam_types").select("id, title, order_number"),
    ]);

  if (testsResult.error) {
    throw new Error(`Testlar yuklanmadi: ${testsResult.error.message}`);
  }

  const tests = (testsResult.data ?? []) as TestRow[];
  const topics = new Map(
    ((topicsResult.data ?? []) as TopicRow[]).map((row) => [row.id, row]),
  );
  const sections = new Map(
    ((sectionsResult.data ?? []) as SectionRow[]).map((row) => [row.id, row]),
  );
  const exams = new Map(
    ((examsResult.data ?? []) as ExamRow[]).map((row) => [row.id, row]),
  );

  const order = (value: number | null | undefined) => value ?? 9999;

  const rows = tests.map((test) => {
    const topic = test.topic_id ? topics.get(test.topic_id) : undefined;
    const section = sections.get(topic?.section_id ?? test.section_id ?? -1);
    const exam = section?.exam_type_id ? exams.get(section.exam_type_id) : undefined;

    const group = topic
      ? `${section?.title ?? "Bölimsiz"} · ${topic.order_number ?? ""}. ${topic.title}`
      : section
        ? `${section.title} · ${NO_TOPIC.toLowerCase()}`
        : NO_TOPIC;

    const label =
      topic && !test.title.includes(topic.title)
        ? `${topic.title} · ${test.title}`
        : test.title;

    return {
      option: {
        id: test.id,
        title: test.title,
        label,
        isPublished: test.is_published,
        group,
      },
      sort: [
        topic || section ? 0 : 1,
        order(exam?.order_number),
        exam?.id ?? 0,
        order(section?.order_number),
        section?.id ?? 0,
        topic ? 0 : 1,
        order(topic?.order_number),
        topic?.id ?? 0,
        order(test.order_number),
        test.id,
      ],
    };
  });

  rows.sort((a, b) => {
    for (let i = 0; i < a.sort.length; i += 1) {
      if (a.sort[i] !== b.sort[i]) return a.sort[i] - b.sort[i];
    }
    return 0;
  });

  return rows.map((row) => row.option);
}
