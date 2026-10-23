import Link from "next/link";

import LessonCard from "@/components/lesson-card";
import {
  notFound,
} from "next/navigation";

import {
  buildBestScoreMap,
  buildLessonTestMap,
  isLessonPassed,
  lessonAverageScore,
} from "@/lib/lesson-progress";
import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dars bo‘limi",
  description:
    "Tanlangan bo‘limdagi videodarslar.",
};

type PageProps = {
  searchParams: Promise<{
    categoryId?: string | string[];
    locked?: string | string[];
  }>;
};

type LessonRow = {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  video_url: string | null;
  order_number: number;
  is_free: boolean;
};

type AttemptRow = {
  test_id: number;
  percentage: number | string;
};

type LessonTestRow = {
  lesson_id: number;
  test_id: number;
};

function getSingleValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export default async function LessonCategoryPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const categoryId = Number(
    getSingleValue(params.categoryId),
  );

  const showLockedMessage =
    getSingleValue(params.locked) === "1";

  if (
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    notFound();
  }

  const {
    supabase,
    user,
    profile,
  } = await requireSectionAccess(
    "lessons",
  );

  const [
    categoryResult,
    lessonsResult,
  ] = await Promise.all([
    supabase
      .from("lesson_categories")
      .select(`
        id,
        title,
        description
      `)
      .eq("id", categoryId)
      .eq("is_published", true)
      .single(),

    supabase
      .from("lessons")
      .select(`
        id,
        category_id,
        title,
        description,
        video_url,
        order_number,
        is_free
      `)
      .eq("category_id", categoryId)
      .eq("is_published", true)
      .order("order_number", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      }),
  ]);

  if (
    categoryResult.error ||
    !categoryResult.data
  ) {
    notFound();
  }

  if (lessonsResult.error) {
    throw new Error(
      `Darslar yuklanmadi: ${lessonsResult.error.message}`,
    );
  }

  const category = categoryResult.data;

  const lessons =
    (lessonsResult.data ??
      []) as LessonRow[];

  const lessonIds = lessons.map((lesson) => lesson.id);

  let links: LessonTestRow[] = [];
  let attempts: AttemptRow[] = [];

  if (lessonIds.length > 0) {
    const { data, error } = await supabase
      .from("lesson_tests")
      .select("lesson_id, test_id")
      .in("lesson_id", lessonIds)
      .order("order_number", { ascending: true });

    if (error) {
      throw new Error(
        `Dars testlari yuklanmadi: ${error.message}`,
      );
    }

    links = (data ?? []) as LessonTestRow[];
  }

  const testsByLesson = buildLessonTestMap(links);

  const testIds = [
    ...new Set(links.map((row) => row.test_id)),
  ];

  if (testIds.length > 0) {
    const { data, error } = await supabase
      .from("attempts")
      .select("test_id, percentage")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .in("test_id", testIds);

    if (error) {
      throw new Error(
        `Test natijalari yuklanmadi: ${error.message}`,
      );
    }

    attempts = (data ?? []) as AttemptRow[];
  }

  const bestScoreMap = buildBestScoreMap(attempts);

  const hasPremiumAccess =
    profile.role === "admin" ||
    (
      profile.premium_until !== null &&
      new Date(
        profile.premium_until,
      ).getTime() > Date.now()
    );

  let nextLessonIsUnlocked = true;

  const lessonStates = lessons.map((lesson) => {
    const isSequenceUnlocked = nextLessonIsUnlocked;

    const hasContentAccess =
      hasPremiumAccess || lesson.is_free === true;

    const lessonTests = testsByLesson.get(lesson.id) ?? [];

    const averageScore = lessonAverageScore(
      lessonTests,
      bestScoreMap,
    );

    const isCompleted = isLessonPassed(
      lessonTests,
      bestScoreMap,
    );

    nextLessonIsUnlocked =
      nextLessonIsUnlocked && isCompleted;

    return {
      lesson,
      isSequenceUnlocked,
      hasContentAccess,
      isCompleted,
      averageScore,
      testCount: lessonTests.length,
    };
  });

  const completedCount =
    lessonStates.filter(
      (state) => state.isCompleted,
    ).length;

  const categoryPercentage =
    lessons.length > 0
      ? Math.round(
          (completedCount /
            lessons.length) *
            100,
        )
      : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 py-2.5 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/lessons"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                ← Dars bo‘limlariga qaytish
              </Link>

              <h1 className="mt-0.5 truncate text-lg font-bold sm:text-2xl">
                {category.title}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-12">
        <div className="overflow-hidden rounded-2xl bg-mb-brand p-4 text-white shadow-lg sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold sm:text-2xl">
                {category.title}
              </h2>

              {category.description && (
                <p className="mt-1 max-w-xl text-sm leading-6 text-blue-100">
                  {category.description}
                </p>
              )}
            </div>

            <div className="w-full sm:w-44">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-100">Tugallangan</span>
                <strong>
                  {completedCount}/{lessons.length}
                </strong>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width: `${categoryPercentage}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {showLockedMessage && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Avval oldingi darsni yakunlang.
          </div>
        )}

        {lessons.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
            <p className="text-lg font-bold">Hozircha dars yo‘q</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:mt-7 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {lessonStates.map(
              ({
                lesson,
                isSequenceUnlocked,
                hasContentAccess,
                isCompleted,
                averageScore,
                testCount,
              }) => (
                <LessonCard
                  key={lesson.id}
                  lessonId={lesson.id}
                  orderNumber={lesson.order_number}
                  title={lesson.title}
                  description={lesson.description}
                  videoUrl={lesson.video_url}
                  categoryTitle={category.title}
                  isFree={lesson.is_free}
                  isCompleted={isCompleted}
                  hasContentAccess={hasContentAccess}
                  isSequenceUnlocked={isSequenceUnlocked}
                  testCount={testCount}
                  averageScore={averageScore}
                />
              ),
            )}
          </div>
        )}
      </section>
    </main>
  );
}
