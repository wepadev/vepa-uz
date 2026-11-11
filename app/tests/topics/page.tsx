import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import PageHeader from "@/components/ui/page-header";
import { requireSectionAccess } from "@/lib/require-section-access";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mavzular",
  description: "Tanlangan bölimdagi test mavzulari.",
};

type PageProps = {
  searchParams: Promise<{
    sectionId?: string | string[];
  }>;
};

type SectionRow = {
  id: number;
  exam_type_id: number;
  title: string;
  description: string | null;
};

type ExamTypeRow = {
  id: number;
  code: string;
  title: string;
};

type TopicRow = {
  id: number;
  title: string;
  description: string | null;
  order_number: number;
  is_free: boolean;
};

type TestRow = {
  id: number;
  topic_id: number | null;
};

type LessonTestRow = {
  test_id: number | null;
};

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TestTopicsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sectionId = Number(singleValue(params.sectionId));

  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    notFound();
  }

  const { supabase, profile } = await requireSectionAccess("tests");

  const { data: sectionData, error: sectionError } = await supabase
    .from("test_sections")
    .select("id, exam_type_id, title, description")
    .eq("id", sectionId)
    .eq("is_published", true)
    .maybeSingle();

  if (sectionError) {
    throw new Error(`Bölim yuklanmadi: ${sectionError.message}`);
  }

  if (!sectionData) notFound();

  const section = sectionData as SectionRow;

  const { data: examTypeData, error: examTypeError } = await supabase
    .from("test_exam_types")
    .select("id, code, title")
    .eq("id", section.exam_type_id)
    .eq("is_published", true)
    .maybeSingle();

  if (examTypeError) {
    throw new Error(`Test yönalişi yuklanmadi: ${examTypeError.message}`);
  }

  if (!examTypeData) notFound();

  const examType = examTypeData as ExamTypeRow;

  const [topicsResult, firstSectionResult, testsResult, lessonTestsResult] =
    await Promise.all([
      supabase
        .from("test_topics")
        .select("id, title, description, order_number, is_free")
        .eq("section_id", section.id)
        .eq("is_published", true)
        .order("order_number", { ascending: true })
        .order("id", { ascending: true }),

      /*
       * Bepul mavzu qaysi ekanini aniqlash uchun yo'nalishning
       * birinchi nashr qilingan bo'limi kerak. Qoida db/34 dagi
       * `free_topic_id()` bilan bir xil: birinchi bo'lim, uning
       * birinchi mavzusi.
       */
      supabase
        .from("test_sections")
        .select("id")
        .eq("exam_type_id", examType.id)
        .eq("is_published", true)
        .order("order_number", { ascending: true })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("tests")
        .select("id, topic_id")
        .eq("is_published", true)
        .not("topic_id", "is", null),

      supabase.from("lesson_tests").select("test_id"),
    ]);

  if (topicsResult.error) {
    throw new Error(`Mavzular yuklanmadi: ${topicsResult.error.message}`);
  }

  if (firstSectionResult.error) {
    throw new Error(
      `Bepul bölim aniqlanmadi: ${firstSectionResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(`Testlar soni yuklanmadi: ${testsResult.error.message}`);
  }

  if (lessonTestsResult.error) {
    throw new Error(
      `Dars testlari tekşirilmadi: ${lessonTestsResult.error.message}`,
    );
  }

  const topics = (topicsResult.data ?? []) as TopicRow[];
  const lessonTestIds = new Set(
    ((lessonTestsResult.data ?? []) as LessonTestRow[])
      .map((row) => row.test_id)
      .filter((id): id is number => typeof id === "number"),
  );

  const testCountByTopic = new Map<number, number>();

  for (const test of (testsResult.data ?? []) as TestRow[]) {
    if (test.topic_id === null || lessonTestIds.has(test.id)) continue;

    testCountByTopic.set(
      test.topic_id,
      (testCountByTopic.get(test.topic_id) ?? 0) + 1,
    );
  }

  /*
   * Avtomatik bepul mavzu: birinchi bo'limning birinchi mavzusi.
   * Undan tashqari admin istalgan mavzuni qo'lda bepul qilishi
   * mumkin (`is_free`) — bo'lim Premium bo'lsa ham u ochiq qoladi.
   * Qoida db/35 dagi `math_booster_is_test_free()` bilan bir xil.
   */
  const isFirstSection = firstSectionResult.data?.id === section.id;
  const freeTopicId = isFirstSection ? topics[0]?.id ?? null : null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref={`/tests/sections?exam=${encodeURIComponent(examType.code)}`}
        backLabel={examType.title}
        title={section.title}
        subtitle={section.description || "Mavzuni tanlang"}
        action={
          profile.role === "admin" ? (
            <Link
              href={`/admin/tests/section?sectionId=${section.id}`}
              className="inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Boşqariş
            </Link>
          ) : (
            <Link
              href="/results"
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Natijalarim
            </Link>
          )
        }
      />

      <section className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-12">
        <div className="hero-board rounded-2xl p-4 text-white sm:rounded-3xl sm:p-8">
          <p className="text-[12px] font-bold text-blue-100 sm:text-sm">
            {examType.title} · {section.title}
          </p>
          <h2 className="mt-1 text-xl font-bold sm:mt-2 sm:text-3xl">
            Mavzuni tanlang
          </h2>
        </div>

        {!topics.length ? (
          <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-lg font-bold text-slate-700">
              Hozirça mavzu qöşilmagan
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Administrator mavzu yaratib, naşr qilganda şu yerda körinadi.
            </p>
          </div>
        ) : (
          <>
            {/* Mobil: bitta mavzu — bitta qator */}
            <div className="mt-5 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm sm:hidden">
              {topics.map((topic, index) => {
                const isFree = topic.id === freeTopicId || topic.is_free;
                const testCount = testCountByTopic.get(topic.id) ?? 0;

                return (
                  <Link
                    key={topic.id}
                    href={`/tests/list?topicId=${topic.id}`}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-3 active:bg-slate-50",
                      index > 0 && "border-t border-mb-line",
                    )}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mb-tint text-mb-brand">
                      <BookOpen
                        className="h-5 w-5"
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[15px] font-bold leading-snug text-mb-ink">
                          {topic.title}
                        </span>

                        <span
                          className={
                            isFree
                              ? "shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                              : "shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                          }
                        >
                          {isFree ? "Bepul" : "Premium"}
                        </span>
                      </span>

                      <span className="mt-0.5 block truncate text-[12px] font-medium text-mb-muted">
                        {testCount} ta test
                        {topic.description ? ` · ${topic.description}` : ""}
                      </span>
                    </span>

                    <ChevronRight
                      className="h-[18px] w-[18px] shrink-0 text-mb-muted"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
            </div>

            {/* Katta ekran: kartalar */}
            <div className="mt-7 hidden gap-5 sm:grid md:grid-cols-2 xl:grid-cols-3">
              {topics.map((topic) => {
                const isFree = topic.id === freeTopicId || topic.is_free;
                const testCount = testCountByTopic.get(topic.id) ?? 0;

                return (
                  <article
                    key={topic.id}
                    className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mb-tint text-mb-brand">
                        <BookOpen
                          className="h-6 w-6"
                          strokeWidth={1.9}
                          aria-hidden="true"
                        />
                      </span>
                      <span
                        className={
                          isFree
                            ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                            : "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                        }
                      >
                        {isFree ? "Bepul mavzu" : "Premium"}
                      </span>
                    </div>

                    <h3 className="mt-5 text-xl font-bold text-slate-950">
                      {topic.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                      {topic.description || "Uşbu mavzudagi testlar."}
                    </p>

                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Testlar soni
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {testCount}
                      </p>
                    </div>

                    <Link
                      href={`/tests/list?topicId=${topic.id}`}
                      className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-mb-brand px-5 py-3 text-center font-bold text-white hover:bg-mb-brandDark"
                    >
                      Testlarni köriş
                    </Link>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
