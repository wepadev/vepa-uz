import Link from "next/link";
import { ChevronRight } from "@/components/ui/icons";

import EmptyState from "@/components/ui/empty-state";
import { GlyphTile } from "@/components/ui/glyph";
import { examGlyph } from "@/lib/exam-visuals";

import { requireSectionAccess } from "@/lib/require-section-access";
import PageHeader, { headerButton } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Testlar",
  description:
    "Attestatsiya, Milliy sertifikat va SAT yönalişlari böyiça onlayn testlar.",
};

type ExamTypeRow = {
  id: number;
  code: "attestatsiya" | "milliy-sertifikat" | "sat";
  title: string;
  description: string | null;
  order_number: number;
};

type SectionRow = {
  id: number;
  exam_type_id: number;
};

type TestRow = {
  id: number;
  topic_id: number | null;
};

type TopicRow = {
  id: number;
  section_id: number;
};

export default async function TestsPage() {
  const { supabase, profile } =
    await requireSectionAccess("tests");

  const [examTypesResult, sectionsResult, testsResult, topicsResult] =
    await Promise.all([
      supabase
        .from("test_exam_types")
        .select("id, code, title, description, order_number")
        .eq("is_published", true)
        .order("order_number", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("test_sections")
        .select("id, exam_type_id")
        .eq("is_published", true),
      supabase
        .from("tests")
        .select("id, topic_id")
        .eq("is_published", true)
        .not("topic_id", "is", null),
      supabase
        .from("test_topics")
        .select("id, section_id")
        .eq("is_published", true),
    ]);

  if (examTypesResult.error) {
    throw new Error(
      `Test yönalişlari yuklanmadi: ${examTypesResult.error.message}`,
    );
  }

  if (sectionsResult.error) {
    throw new Error(
      `Test bölimlari yuklanmadi: ${sectionsResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(
      `Testlar soni yuklanmadi: ${testsResult.error.message}`,
    );
  }

  if (topicsResult.error) {
    throw new Error(`Mavzular yuklanmadi: ${topicsResult.error.message}`);
  }

  const examTypes = (examTypesResult.data ?? []) as ExamTypeRow[];
  const sections = (sectionsResult.data ?? []) as SectionRow[];
  const tests = (testsResult.data ?? []) as TestRow[];
  // Test öquvçiga faqat naşr qilingan mavzu orqali körinadi
  const sectionOfTopic = new Map(
    ((topicsResult.data ?? []) as TopicRow[]).map((topic) => [
      topic.id,
      topic.section_id,
    ]),
  );

  const sectionCountByExam = new Map<number, number>();
  const testCountBySection = new Map<number, number>();

  for (const section of sections) {
    sectionCountByExam.set(
      section.exam_type_id,
      (sectionCountByExam.get(section.exam_type_id) ?? 0) + 1,
    );
  }

  for (const test of tests) {
    const sectionId =
      test.topic_id === null ? undefined : sectionOfTopic.get(test.topic_id);

    if (sectionId === undefined) continue;

    testCountBySection.set(
      sectionId,
      (testCountBySection.get(sectionId) ?? 0) + 1,
    );
  }

  /* Faqat körinib turgan yönalişlardagi testlar sanaladi */
  const visibleExamIds = new Set(examTypes.map((examType) => examType.id));
  const totalTests = sections.reduce(
    (sum, section) =>
      visibleExamIds.has(section.exam_type_id)
        ? sum + (testCountBySection.get(section.id) ?? 0)
        : sum,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        glyph="tests"
        title="Testlar"
        subtitle={
          totalTests > 0
            ? `${totalTests} ta test · natija darrov çiqadi`
            : "Yönalişni tanlang"
        }
        action={
          profile.role === "admin" ? (
            <Link href="/admin/tests" className={headerButton}>
              Boşqariş
            </Link>
          ) : null
        }
      />

      <section className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        <p className="eyebrow">Yönalişni tanlang</p>

        {!examTypes.length ? (
          <EmptyState glyph="tests" title="Hozirça test yöq" className="mt-3">
            Testlar qöşilişi bilan şu yerda çiqadi.
          </EmptyState>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {examTypes.map((examType) => {
              const examSections = sections.filter(
                (section) => section.exam_type_id === examType.id,
              );

              const testCount = examSections.reduce(
                (sum, section) =>
                  sum + (testCountBySection.get(section.id) ?? 0),
                0,
              );

              const sectionCount = sectionCountByExam.get(examType.id) ?? 0;
              const empty = testCount === 0;

              return (
                <Link
                  key={examType.id}
                  href={`/tests/sections?exam=${encodeURIComponent(examType.code)}`}
                  className="edge group flex items-center gap-4 rounded-2xl border border-mb-line bg-white p-4 lg:flex-col lg:items-start lg:gap-5 lg:p-5"
                >
                  <GlyphTile name={examGlyph(examType.code)} size="lg" />

                  <span className="min-w-0 flex-1 lg:w-full">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-lg font-bold leading-6 text-mb-ink">
                        {examType.title}
                      </span>

                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>

                    {examType.description && (
                      <span className="mt-0.5 block line-clamp-2 text-sm leading-5 text-mb-muted">
                        {examType.description}
                      </span>
                    )}

                    <span className="num mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                      {empty ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500">
                          Tez orada
                        </span>
                      ) : (
                        <>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                            {sectionCount} bölim
                          </span>
                          <span className="rounded-md bg-mb-tintSoft px-2 py-0.5 text-mb-brandDark">
                            {testCount} test
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        <p className="eyebrow mt-8">Sizning işlaringiz</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                href: "/results",
                glyph: "results",
                title: "Natijalarim",
                text: "Işlangan testlar va xatolar tahlili",
              },
              {
                href: "/leaderboard",
                glyph: "ranking",
                title: "Reyting",
                text: "Boşqalar orasida örningiz",
              },
            ] as const
          ).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="edge group flex items-center gap-3 rounded-2xl border border-mb-line bg-white p-3"
            >
              <GlyphTile name={item.glyph} size="sm" />

              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-5 text-mb-ink">
                  {item.title}
                </span>
                <span className="block truncate text-sm text-mb-muted">
                  {item.text}
                </span>
              </span>

              <ChevronRight
                className="h-5 w-5 shrink-0 text-slate-400"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
