
import { Lock } from "@/components/ui/icons";
import { notFound } from "next/navigation";

import LessonCard from "@/components/lesson-card";
import EmptyState from "@/components/ui/empty-state";
import ProgressRing from "@/components/ui/progress-ring";

import {
  buildLastScoreMap,
  buildLessonGates,
  buildLessonTestMap,
  isLessonCompletedByTests,
  isLessonPassed,
  lessonAverageScore,
} from "@/lib/lesson-progress";
import { requireSectionAccess } from "@/lib/require-section-access";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dars bölimi",
  description:
    "Tanlangan bölimdagi videodarslar.",
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
  completed_at: string | null;
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
      .select("test_id, percentage, completed_at")
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

  const lastScoreMap = buildLastScoreMap(attempts);

  const hasPremiumAccess =
    profile.role === "admin" ||
    (
      profile.premium_until !== null &&
      new Date(
        profile.premium_until,
      ).getTime() > Date.now()
    );

  /*
   * Qaysi dars ochiq — qoida `lib/lesson-progress.ts` da,
   * `/lessons/view` bilan bitta joydan o'qiladi.
   */
  const lessonFacts = lessons.map((lesson) => {
    const lessonTests =
      testsByLesson.get(lesson.id) ?? [];

    return {
      lesson,
      lessonTests,
      averageScore: lessonAverageScore(
        lessonTests,
        lastScoreMap,
      ),
      isCompleted: isLessonPassed(
        lessonTests,
        lastScoreMap,
      ),
      /* Ekrandagi "Tugallangan" — testsiz dars bunga kirmaydi */
      isDone: isLessonCompletedByTests(
        lessonTests,
        lastScoreMap,
      ),
    };
  });

  const gates = buildLessonGates(
    lessonFacts.map((fact) => ({
      isFree: fact.lesson.is_free === true,
      isCompleted: fact.isCompleted,
    })),
    hasPremiumAccess,
  );

  const lessonStates = lessonFacts.map(
    (fact, index) => ({
      lesson: fact.lesson,
      isSequenceUnlocked:
        gates[index].isSequenceUnlocked,
      hasContentAccess:
        gates[index].hasContentAccess,
      isCompleted: fact.isDone,
      averageScore: fact.averageScore,
      testCount: fact.lessonTests.length,
    }),
  );

  const completedCount =
    lessonStates.filter(
      (state) => state.isCompleted,
    ).length;

  /* Testsiz darsni tugallab bo'lmaydi, shuning uchun hisobga kirmaydi */
  const countableLessons =
    lessonStates.filter(
      (state) => state.testCount > 0,
    ).length;

  const categoryPercentage =
    countableLessons > 0
      ? Math.round(
          (completedCount /
            countableLessons) *
            100,
        )
      : 0;

  /* Navbatdagi dars: oçiq, lekin hali tugallanmagan birinçi dars */
  const currentIndex = lessonStates.findIndex(
    (state) =>
      state.hasContentAccess &&
      state.isSequenceUnlocked &&
      !state.isCompleted &&
      state.testCount > 0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/lessons"
        backLabel="Videodarslar"
        title={category.title}
        subtitle={category.description || undefined}
        width="3xl"
        action={
          countableLessons > 0 ? (
            <ProgressRing
              value={categoryPercentage}
              size={48}
              stroke={5}
              tone={categoryPercentage === 100 ? "success" : "brand"}
            >
              <span className="num text-[11px] font-bold text-mb-ink">
                {completedCount}/{countableLessons}
              </span>
            </ProgressRing>
          ) : null
        }
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {showLockedMessage && (
          <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-vp-warning-line bg-vp-warning-soft px-4 py-3 text-sm font-semibold text-vp-warning">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            Bu dars hali yopiq. Avval oldingi dars testini 90% ga işlang.
          </div>
        )}

        {lessons.length === 0 ? (
          <EmptyState glyph="lessons" title="Hozirça dars yöq">
            Darslar qöşilişi bilan şu yerda çiqadi.
          </EmptyState>
        ) : (
          <ol>
            {lessonStates.map(
              (
                {
                  lesson,
                  isSequenceUnlocked,
                  hasContentAccess,
                  isCompleted,
                  averageScore,
                  testCount,
                },
                index,
              ) => (
                <LessonCard
                  key={lesson.id}
                  lessonId={lesson.id}
                  orderNumber={lesson.order_number}
                  title={lesson.title}
                  description={lesson.description}
                  videoUrl={lesson.video_url}
                  isFree={lesson.is_free}
                  isCompleted={isCompleted}
                  hasContentAccess={hasContentAccess}
                  isSequenceUnlocked={isSequenceUnlocked}
                  testCount={testCount}
                  averageScore={averageScore}
                  isCurrent={index === currentIndex}
                  isLast={index === lessonStates.length - 1}
                />
              ),
            )}
          </ol>
        )}
      </section>
    </main>
  );
}
