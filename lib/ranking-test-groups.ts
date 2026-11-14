import type { SupabaseClient } from "@supabase/supabase-js";

import type { RankingTestRpcRow } from "@/lib/stats-types";

/*
 * Reyting sahifasidagi test tanlaş röyxati.
 *
 * Testlar mavzu içida "1-test", "2-test", "3-test" deb nomlanadi
 * (db/38). Reyting RPC si faqat şu nomni qaytaradi, şuning uçun
 * ilgari tanlaş röyxatida 89 ta "1-test" ketma-ket turardi. Bu yerda
 * har testga mavzusi va bölimi qöşiladi va ular katalogdagi tartibda
 * guruhlanadi: bölim → mavzu → testlar.
 */

export type RankingTestItem = {
  id: number;
  /** Bazadagi nom: "1-test" */
  title: string;
  participants: number;
};

export type RankingTopicGroup = {
  /** URL dagi kalit: "t12" (mavzu), "s3" (mavzusiz bölim), "x" */
  key: string;
  /** Bölim: "Algebra 1-qism" (bir nečta yönaliş bölsa — "Milliy sertifikat · Algebra") */
  section: string;
  /** Mavzu tartib raqami: "8" yoki null */
  number: number | null;
  /** Mavzu nomi: "Oddiy kasrlar 1-qism" */
  topic: string;
  tests: RankingTestItem[];
};

type TestRow = {
  id: number;
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
  code?: string | null;
  title: string;
  order_number: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;

const order = (value: number | null | undefined) => value ?? 9999;

export async function loadRankingTestGroups(
  supabase: Client,
  rankingTests: RankingTestRpcRow[],
): Promise<RankingTopicGroup[]> {
  if (rankingTests.length === 0) return [];

  const ids = rankingTests.map((test) => Number(test.test_id));

  const [testsResult, topicsResult, sectionsResult, examsResult] =
    await Promise.all([
      supabase
        .from("tests")
        .select("id, order_number, topic_id, section_id")
        .in("id", ids),
      supabase
        .from("test_topics")
        .select("id, section_id, title, order_number"),
      supabase
        .from("test_sections")
        .select("id, exam_type_id, title, order_number"),
      supabase.from("test_exam_types").select("id, code, title, order_number"),
    ]);

  /*
   * Katalog jadvallari ochilmasa ham sahifa yiqilmasin: testlar
   * "Boşqa testlar" guruhida, RPC tartibida çiqadi.
   */
  const tests = new Map(
    ((testsResult.data ?? []) as TestRow[]).map((row) => [row.id, row]),
  );
  const topics = new Map(
    ((topicsResult.data ?? []) as TopicRow[]).map((row) => [row.id, row]),
  );
  const sections = new Map(
    ((sectionsResult.data ?? []) as SectionRow[]).map((row) => [row.id, row]),
  );
  const exams = new Map(
    ((examsResult.data ?? []) as ExamRow[]).map((row) => [row.id, row]),
  );

  const examIds = new Set<number>();

  const placed = rankingTests.map((ranking, index) => {
    const id = Number(ranking.test_id);
    const test = tests.get(id);
    const topic = test?.topic_id ? topics.get(test.topic_id) : undefined;
    const section = sections.get(topic?.section_id ?? test?.section_id ?? -1);
    const exam = section?.exam_type_id
      ? exams.get(section.exam_type_id)
      : undefined;

    if (exam) examIds.add(exam.id);

    return { ranking, index, id, test, topic, section, exam };
  });

  /* Yönaliş nomi faqat bir nečta yönaliş bölsa kerak */
  const showExam = examIds.size > 1;

  const groups = new Map<
    string,
    RankingTopicGroup & { sort: number[] }
  >();

  for (const item of placed) {
    const { topic, section, exam } = item;

    const key = topic ? `t${topic.id}` : section ? `s${section.id}` : "x";

    let group = groups.get(key);

    if (!group) {
      const sectionTitle = section
        ? showExam && exam
          ? `${exam.code?.startsWith("mock-") ? "Mock · " : ""}${exam.title} · ${section.title}`
          : section.title
        : "Boşqa testlar";

      group = {
        key,
        section: sectionTitle,
        number: topic?.order_number ?? null,
        topic: topic?.title ?? (section ? "Mavzusiz testlar" : "Boşqa testlar"),
        tests: [],
        sort: [
          section ? 0 : 1,
          order(exam?.order_number),
          exam?.id ?? 0,
          order(section?.order_number),
          section?.id ?? 0,
          topic ? 0 : 1,
          order(topic?.order_number),
          topic?.id ?? 0,
        ],
      };

      groups.set(key, group);
    }

    group.tests.push({
      id: item.id,
      title: item.ranking.title,
      participants: Number(item.ranking.participants) || 0,
    });
  }

  const testOrder = new Map(
    placed.map((item) => [
      item.id,
      [order(item.test?.order_number), item.index],
    ]),
  );

  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  };

  return [...groups.values()]
    .sort((a, b) => compare(a.sort, b.sort))
    .map((group) => {
      const { sort: _sort, ...rest } = group;
      void _sort;

      return {
        ...rest,
        tests: [...group.tests].sort((a, b) =>
          compare(testOrder.get(a.id) ?? [0], testOrder.get(b.id) ?? [0]),
        ),
      };
    });
}

/** "8. Oddiy kasrlar 1-qism" */
export function topicLabel(group: RankingTopicGroup) {
  return group.number != null ? `${group.number}. ${group.topic}` : group.topic;
}
