import Link from "next/link";
import { notFound } from "next/navigation";

import EmptyState from "@/components/ui/empty-state";
import PageHeader, { headerButton } from "@/components/ui/page-header";
import PremiumNote from "@/components/ui/premium-note";
import { RowIndex, RowLink, RowList, RowLock, Tag } from "@/components/ui/row";
import { examGlyph } from "@/lib/exam-visuals";
import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Test bölimlari",
  description:
    "Tanlangan yönalişdagi test bölimlari.",
};

type PageProps = {
  searchParams: Promise<{
    exam?: string | string[];
  }>;
};

type ExamTypeRow = {
  id: number;
  code: string;
  title: string;
  description: string | null;
};

type SectionRow = {
  id: number;
  title: string;
  description: string | null;
  order_number: number;
};

type TestRow = {
  id: number;
  section_id: number | null;
};

type TopicRow = {
  id: number;
  section_id: number;
  is_free: boolean;
};

type LessonTestRow = {
  test_id: number | null;
};

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TestSectionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const examCode = String(singleValue(params.exam) ?? "").trim();

  if (!examCode) {
    notFound();
  }

  const { supabase, profile } = await requireSectionAccess("tests");

  const { data: examTypeData, error: examTypeError } = await supabase
    .from("test_exam_types")
    .select("id, code, title, description")
    .eq("code", examCode)
    .eq("is_published", true)
    .maybeSingle();

  if (examTypeError) {
    throw new Error(
      `Test yönalişi yuklanmadi: ${examTypeError.message}`,
    );
  }

  if (!examTypeData) {
    notFound();
  }

  const examType = examTypeData as ExamTypeRow;

  const [sectionsResult, topicsResult, testsResult, lessonTestsResult] =
    await Promise.all([
    supabase
      .from("test_sections")
      .select("id, title, description, order_number")
      .eq("exam_type_id", examType.id)
      .eq("is_published", true)
      .order("order_number", { ascending: true })
      .order("id", { ascending: true }),

      supabase
        .from("test_topics")
        .select("id, section_id, is_free")
        .eq("is_published", true),

      supabase
        .from("tests")
        .select("id, section_id")
        .eq("is_published", true)
        .not("section_id", "is", null),

      supabase
        .from("lesson_tests")
        .select("test_id"),
    ]);

  if (sectionsResult.error) {
    throw new Error(
      `Bölimlar yuklanmadi: ${sectionsResult.error.message}`,
    );
  }

  if (topicsResult.error) {
    throw new Error(`Mavzular yuklanmadi: ${topicsResult.error.message}`);
  }

  if (testsResult.error) {
    throw new Error(`Testlar soni yuklanmadi: ${testsResult.error.message}`);
  }

  if (lessonTestsResult.error) {
    throw new Error(
      `Dars testlari tekşirilmadi: ${lessonTestsResult.error.message}`,
    );
  }

  const sections = (sectionsResult.data ?? []) as SectionRow[];
  const tests = (testsResult.data ?? []) as TestRow[];
  const lessonTestIds = new Set(
    ((lessonTestsResult.data ?? []) as LessonTestRow[])
      .map((row) => row.test_id)
      .filter((id): id is number => typeof id === "number"),
  );

  const testCountBySection = new Map<number, number>();

  for (const test of tests) {
    if (test.section_id === null || lessonTestIds.has(test.id)) {
      continue;
    }

    testCountBySection.set(
      test.section_id,
      (testCountBySection.get(test.section_id) ?? 0) + 1,
    );
  }

  const topicCountBySection = new Map<number, number>();

  /*
   * Qo'lda bepul qilingan mavzusi bor bo'limlar. Bepullik bo'limdan
   * meros olinmaydi, shuning uchun Premium bo'lim ichida ham ochiq
   * mavzu bo'lishi mumkin — o'quvchi buni ro'yxatdayoq ko'rsin.
   */
  const sectionsWithFreeTopic = new Set<number>();

  for (const topic of (topicsResult.data ?? []) as TopicRow[]) {
    topicCountBySection.set(
      topic.section_id,
      (topicCountBySection.get(topic.section_id) ?? 0) + 1,
    );

    if (topic.is_free) {
      sectionsWithFreeTopic.add(topic.section_id);
    }
  }

  /*
   * Bepul qoidasi: birinchi bo'limning birinchi mavzusi bepul.
   * Bu yerda faqat bo'lim ko'rsatiladi, shuning uchun birinchi
   * bo'limda "1-mavzu bepul" deb yoziladi — qaysi mavzu ekani
   * keyingi sahifada aniq ko'rinadi.
   */
  const firstSectionId = sections[0]?.id ?? null;

  const totalTests = sections.reduce(
    (sum, section) => sum + (testCountBySection.get(section.id) ?? 0),
    0,
  );
  const hasLockedSection = sections.some(
    (section) =>
      section.id !== firstSectionId && !sectionsWithFreeTopic.has(section.id),
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/tests"
        backLabel="Testlar"
        glyph={examGlyph(examType.code)}
        title={examType.title}
        subtitle={
          sections.length
            ? `${sections.length} bölim · ${totalTests} test`
            : examType.description || "Bölimni tanlang"
        }
        action={
          profile.role === "admin" ? (
            <Link
              href={`/admin/tests/sections?exam=${encodeURIComponent(examType.code)}`}
              className={headerButton}
            >
              Boşqariş
            </Link>
          ) : (
            <Link href="/results" className={headerButton}>
              Natijalarim
            </Link>
          )
        }
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {!sections.length ? (
          <EmptyState glyph="tests" title="Hozirça bölim qöşilmagan">
            Bölimlar naşr qilinganda şu yerda körinadi.
          </EmptyState>
        ) : (
          <>
            <p className="eyebrow">Bölimni tanlang</p>

            <RowList className="mt-3">
              {sections.map((section, index) => {
                const isFirstSection = section.id === firstSectionId;
                const testCount = testCountBySection.get(section.id) ?? 0;
                const topicCount = topicCountBySection.get(section.id) ?? 0;
                const hasFreeTopic = sectionsWithFreeTopic.has(section.id);

                return (
                  <RowLink
                    key={section.id}
                    href={`/tests/topics?sectionId=${section.id}`}
                    lead={<RowIndex value={index + 1} />}
                    title={section.title}
                    meta={`${topicCount} mavzu · ${testCount} test`}
                    trail={
                      isFirstSection ? (
                        <Tag tone="free">1-mavzu bepul</Tag>
                      ) : hasFreeTopic ? (
                        <Tag tone="free">Bepul mavzu bor</Tag>
                      ) : (
                        <RowLock />
                      )
                    }
                  />
                );
              })}
            </RowList>

            {hasLockedSection && <PremiumNote className="mt-4" />}
          </>
        )}
      </section>
    </main>
  );
}
