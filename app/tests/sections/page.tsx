import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";
import { notFound } from "next/navigation";

import PageHeader from "@/components/ui/page-header";
import { requireSectionAccess } from "@/lib/require-section-access";
import { cn } from "@/lib/utils";

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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/tests"
        backLabel="Testlar"
        title={examType.title}
        subtitle={examType.description || "Bölimni tanlang"}
        action={
          profile.role === "admin" ? (
            <Link
              href={`/admin/tests/sections?exam=${encodeURIComponent(examType.code)}`}
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
        {/* Telefonda bu blok ekranning yarmini egallamasligi uchun ixchamroq */}
        <div className="hero-board rounded-2xl p-4 text-white sm:rounded-3xl sm:p-8">
          <p className="text-[12px] font-bold text-blue-100 sm:text-sm">
            Mavzular va bölimlar
          </p>
          <h2 className="mt-1 text-xl font-bold sm:mt-2 sm:text-3xl">
            Kerakli bölimni tanlang
          </h2>
        </div>

        {!sections.length ? (
          <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-lg font-bold text-slate-700">
              Hozirça bölim qöşilmagan
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Administrator bölim yaratib, naşr qilganda şu yerda körinadi.
            </p>
          </div>
        ) : (
          <>
            {/*
              Mobil: ro'yxat ko'rinishi.
              Kartalar telefon ekranida juda ko'p joy egallardi — bitta
              bo'lim uchun deyarli butun ekran ketardi. Endi har bir
              bo'lim bitta qator: ikonka, nom, qisqa ma'lumot.
            */}
            <div className="mt-5 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm sm:hidden">
              {sections.map((section, index) => {
                const isFirstSection = section.id === firstSectionId;
                const testCount = testCountBySection.get(section.id) ?? 0;
                const topicCount = topicCountBySection.get(section.id) ?? 0;
                const hasFreeTopic = sectionsWithFreeTopic.has(section.id);

                return (
                  <Link
                    key={section.id}
                    href={`/tests/topics?sectionId=${section.id}`}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-3 active:bg-slate-50",
                      index > 0 && "border-t border-mb-line",
                    )}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mb-tint text-mb-brand">
                      <Layers
                        className="h-5 w-5"
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[15px] font-bold leading-snug text-mb-ink">
                          {section.title}
                        </span>

                        <span
                          className={
                            isFirstSection || hasFreeTopic
                              ? "shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                              : "shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                          }
                        >
                          {isFirstSection
                            ? "1-mavzu bepul"
                            : hasFreeTopic
                              ? "Bepul mavzu bor"
                              : "Premium"}
                        </span>
                      </span>

                      <span className="mt-0.5 block truncate text-[12px] font-medium text-mb-muted">
                        {topicCount} ta mavzu · {testCount} ta test
                        {section.description ? ` · ${section.description}` : ""}
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

            {/* Katta ekran: avvalgi kartalar */}
            <div className="mt-7 hidden gap-5 sm:grid md:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => {
              const isFirstSection = section.id === firstSectionId;
              const testCount = testCountBySection.get(section.id) ?? 0;
              const topicCount = topicCountBySection.get(section.id) ?? 0;
              const hasFreeTopic = sectionsWithFreeTopic.has(section.id);

              return (
                <article
                  key={section.id}
                  className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mb-tint text-mb-brand sm:h-12 sm:w-12 sm:rounded-2xl">
                      <Layers className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <span
                      className={
                        isFirstSection || hasFreeTopic
                          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                          : "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                      }
                    >
                      {isFirstSection
                        ? "1-mavzu bepul"
                        : hasFreeTopic
                          ? "Bepul mavzu bor"
                          : "Premium"}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-slate-950">
                    {section.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                    {section.description || "Uşbu bölimdagi testlar."}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Mavzular
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {topicCount}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Testlar
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {testCount}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/tests/topics?sectionId=${section.id}`}
                    className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-mb-brand px-5 py-3 text-center font-bold text-white hover:bg-mb-brandDark"
                  >
                    Mavzularni köriş
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
