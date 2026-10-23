import Link from "next/link";
import { ArrowRight, History, Sparkles, Trophy } from "lucide-react";

import { accents } from "@/components/ui/section-visual";
import { examAccent, examIcon } from "@/lib/exam-visuals";

import { requireSectionAccess } from "@/lib/require-section-access";
import BrandMark from "@/components/ui/brand-mark";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Testlar",
  description:
    "Attestatsiya, Milliy sertifikat va SAT yo‘nalishlari bo‘yicha onlayn testlar.",
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
  section_id: number | null;
};

type LessonTestRow = {
  test_id: number;
};

export default async function TestsPage() {
  const { supabase, user, profile } =
    await requireSectionAccess("tests");

  const [examTypesResult, sectionsResult, testsResult, lessonTestsResult] =
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
        .select("id, section_id")
        .eq("is_published", true)
        .not("section_id", "is", null),
      supabase
        .from("lesson_tests")
        .select("test_id"),
    ]);

  if (examTypesResult.error) {
    throw new Error(
      `Test yo‘nalishlari yuklanmadi: ${examTypesResult.error.message}`,
    );
  }

  if (sectionsResult.error) {
    throw new Error(
      `Test bo‘limlari yuklanmadi: ${sectionsResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(
      `Testlar soni yuklanmadi: ${testsResult.error.message}`,
    );
  }

  if (lessonTestsResult.error) {
    throw new Error(
      `Dars testlari tekshirilmadi: ${lessonTestsResult.error.message}`,
    );
  }

  const examTypes = (examTypesResult.data ?? []) as ExamTypeRow[];
  const sections = (sectionsResult.data ?? []) as SectionRow[];
  const tests = (testsResult.data ?? []) as TestRow[];
  const lessonTestIds = new Set(
    ((lessonTestsResult.data ?? []) as LessonTestRow[]).map(
      (row) => row.test_id,
    ),
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
    if (test.section_id === null || lessonTestIds.has(test.id)) {
      continue;
    }

    testCountBySection.set(
      test.section_id,
      (testCountBySection.get(test.section_id) ?? 0) + 1,
    );
  }

  const fullName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "O‘quvchi";

  const totalTests = [...testCountBySection.values()].reduce(
    (sum, value) => sum + value,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark size={40} className="h-9 w-9 sm:h-10 sm:w-10" />

            <div className="min-w-0">
              <p className="truncate text-base font-bold sm:text-lg">
                Testlar
              </p>

              <p className="truncate text-xs text-slate-500">
                {fullName}
              </p>
            </div>
          </Link>

          {profile.role === "admin" && (
            <Link
              href="/admin/tests"
              className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Boshqarish
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        <div className="relative overflow-hidden rounded-3xl bg-mb-brand p-5 text-white shadow-lg sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10"
          />

          <div className="relative">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-100">
              <Sparkles
                className="h-4 w-4"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              {totalTests} ta test tayyor
            </p>

            <h1 className="mt-1.5 text-2xl font-bold leading-tight sm:text-4xl">
              Bilimingizni sinab ko‘ring
            </h1>

            <p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">
              Yo‘nalishni tanlang, ichidan bo‘lim va testni oching.
              Natija test tugagach darrov chiqadi.
            </p>
          </div>
        </div>

        {!examTypes.length ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <p className="text-lg font-bold text-slate-700">
              Hozircha test yo‘q
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3">
            {examTypes.map((examType) => {
              const examSections = sections.filter(
                (section) => section.exam_type_id === examType.id,
              );

              const testCount = examSections.reduce(
                (sum, section) =>
                  sum + (testCountBySection.get(section.id) ?? 0),
                0,
              );

              const Icon = examIcon(examType.code);
              const visual = accents[examAccent(examType.code)];
              const empty = testCount === 0;

              return (
                <Link
                  key={examType.id}
                  href={`/tests/sections?exam=${encodeURIComponent(examType.code)}`}
                  className="group flex items-center gap-3.5 rounded-2xl border border-mb-line bg-white p-3.5 shadow-sm transition sm:p-4 sm:hover:-translate-y-0.5 sm:hover:shadow-md"
                >
                  <span
                    className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${visual.softBox}`}
                  >
                    <Icon
                      className="h-7 w-7"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[17px] font-bold leading-6 text-mb-ink">
                        {examType.title}
                      </span>

                      {!empty && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          3 ta bepul
                        </span>
                      )}
                    </span>

                    {examType.description && (
                      <span className="mt-0.5 block line-clamp-1 text-sm text-mb-muted">
                        {examType.description}
                      </span>
                    )}

                    <span className="mt-1 block text-xs font-semibold text-mb-muted">
                      {empty
                        ? "Test qo‘shilmagan"
                        : `${sectionCountByExam.get(examType.id) ?? 0} bo‘lim · ${testCount} test`}
                    </span>
                  </span>

                  <ArrowRight
                    className="h-5 w-5 shrink-0 text-mb-muted transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
          <Link
            href="/results"
            className="flex items-center gap-2.5 rounded-2xl border border-mb-line bg-white px-4 py-3 shadow-sm transition sm:hover:-translate-y-0.5 sm:hover:shadow-md"
          >
            <History
              className="h-5 w-5 shrink-0 text-mb-brand"
              strokeWidth={2}
              aria-hidden="true"
            />

            <span className="text-sm font-semibold text-mb-ink">
              Natijalarim
            </span>
          </Link>

          <Link
            href="/leaderboard"
            className="flex items-center gap-2.5 rounded-2xl border border-mb-line bg-white px-4 py-3 shadow-sm transition sm:hover:-translate-y-0.5 sm:hover:shadow-md"
          >
            <Trophy
              className="h-5 w-5 shrink-0 text-amber-500"
              strokeWidth={2}
              aria-hidden="true"
            />

            <span className="text-sm font-semibold text-mb-ink">
              Reyting
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
