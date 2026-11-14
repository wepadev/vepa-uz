import "server-only";

import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * /katalog sahifasi uchun ochiq ro'yxat: test bo'limlari va
 * mavzulari, videodarslar va darsliklar nomlari.
 *
 * Mehmonning bazani o'qish huquqi yo'q, shuning uchun admin mijozi
 * ishlatiladi. Faqat nashr qilingan narsalarning NOMI va tartibi
 * olinadi — savollar, javoblar, video havolalari olinmaydi. Har bir
 * element saytning o'z sahifasiga olib boradi; u yerda kirish
 * so'raladi va kirgandan keyin aynan o'sha sahifa ochiladi.
 *
 * Natija bir soatga saqlanadi. Xato bo'lsa `null`.
 */
export type CatalogTopic = {
  id: number;
  title: string;
  isFree: boolean;
  testCount: number;
};

export type CatalogSection = {
  id: number;
  title: string;
  topics: CatalogTopic[];
};

export type CatalogExam = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  sections: CatalogSection[];
};

export type CatalogLesson = {
  id: number;
  title: string;
  orderNumber: number | null;
  isFree: boolean;
};

export type CatalogCategory = {
  id: number;
  title: string;
  lessons: CatalogLesson[];
};

export type CatalogTextbook = {
  id: number;
  title: string;
  grade: number | null;
  bookType: string;
};

export type CatalogTree = {
  exams: CatalogExam[];
  categories: CatalogCategory[];
  textbooks: CatalogTextbook[];
};

type Row = Record<string, unknown>;

const num = (value: unknown) => (typeof value === "number" ? value : Number(value));
const text = (value: unknown) => (typeof value === "string" ? value : "");

export const getCatalogTree = unstable_cache(
  async (): Promise<CatalogTree | null> => {
    try {
      const admin = createAdminClient();

      const [exams, sections, topics, tests, categories, lessons, textbooks] =
        await Promise.all([
          admin
            .from("test_exam_types")
            .select("id, code, title, description, order_number")
            .eq("is_published", true)
            /* Mock testlar /mock da, katalogda emas (lib/mock.ts) */
            .not("code", "like", "mock-%")
            .order("order_number", { ascending: true })
            .order("id", { ascending: true }),
          admin
            .from("test_sections")
            .select("id, exam_type_id, title, order_number")
            .eq("is_published", true)
            .order("order_number", { ascending: true })
            .order("id", { ascending: true }),
          admin
            .from("test_topics")
            .select("id, section_id, title, order_number, is_free")
            .eq("is_published", true)
            .order("order_number", { ascending: true })
            .order("id", { ascending: true }),
          admin
            .from("tests")
            .select("id, topic_id")
            .eq("is_published", true)
            .not("topic_id", "is", null),
          admin
            .from("lesson_categories")
            .select("id, title, order_number")
            .eq("is_published", true)
            .order("order_number", { ascending: true })
            .order("id", { ascending: true }),
          admin
            .from("lessons")
            .select("id, category_id, title, order_number, is_free")
            .eq("is_published", true)
            .order("order_number", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true }),
          admin
            .from("textbooks")
            .select("id, title, grade, book_type")
            .eq("is_published", true)
            .order("grade", { ascending: true, nullsFirst: false })
            .order("title", { ascending: true }),
        ]);

      if (exams.error || sections.error || topics.error || categories.error || lessons.error) {
        return null;
      }

      // Dars testlari ham katalogda sanaladi (sayt ham şunday qiladi)
      const testCount = new Map<number, number>();

      for (const row of (tests.data ?? []) as Row[]) {
        const topicId = num(row.topic_id);
        testCount.set(topicId, (testCount.get(topicId) ?? 0) + 1);
      }

      const topicsBySection = new Map<number, CatalogTopic[]>();

      for (const row of (topics.data ?? []) as Row[]) {
        const sectionId = num(row.section_id);
        const list = topicsBySection.get(sectionId) ?? [];
        list.push({
          id: num(row.id),
          title: text(row.title),
          isFree: row.is_free === true,
          testCount: testCount.get(num(row.id)) ?? 0,
        });
        topicsBySection.set(sectionId, list);
      }

      const sectionsByExam = new Map<number, CatalogSection[]>();

      for (const row of (sections.data ?? []) as Row[]) {
        const examId = num(row.exam_type_id);
        const sectionTopics = (topicsBySection.get(num(row.id)) ?? []).filter(
          (topic) => topic.testCount > 0,
        );
        if (sectionTopics.length === 0) continue;
        const list = sectionsByExam.get(examId) ?? [];
        list.push({ id: num(row.id), title: text(row.title), topics: sectionTopics });
        sectionsByExam.set(examId, list);
      }

      const lessonsByCategory = new Map<number, CatalogLesson[]>();

      for (const row of (lessons.data ?? []) as Row[]) {
        const categoryId = num(row.category_id);
        const list = lessonsByCategory.get(categoryId) ?? [];
        list.push({
          id: num(row.id),
          title: text(row.title),
          orderNumber: row.order_number == null ? null : num(row.order_number),
          isFree: row.is_free === true,
        });
        lessonsByCategory.set(categoryId, list);
      }

      return {
        exams: ((exams.data ?? []) as Row[])
          .map((row) => ({
            id: num(row.id),
            code: text(row.code),
            title: text(row.title),
            description: text(row.description) || null,
            sections: sectionsByExam.get(num(row.id)) ?? [],
          }))
          .filter((exam) => exam.sections.length > 0),
        categories: ((categories.data ?? []) as Row[])
          .map((row) => ({
            id: num(row.id),
            title: text(row.title),
            lessons: lessonsByCategory.get(num(row.id)) ?? [],
          }))
          .filter((category) => category.lessons.length > 0),
        textbooks: textbooks.error
          ? []
          : ((textbooks.data ?? []) as Row[]).map((row) => ({
              id: num(row.id),
              title: text(row.title),
              grade: row.grade == null ? null : num(row.grade),
              bookType: text(row.book_type),
            })),
      };
    } catch {
      return null;
    }
  },
  ["public-catalog-tree"],
  { revalidate: 3600 },
);
