import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import MathText from "@/components/math-text";
import YouTubeEmbed from "@/components/youtube-embed";
import {
  buildBestScoreMap,
  buildLessonGates,
  buildLessonTestMap,
  isLessonCompletedByTests,
  isLessonPassed,
  lessonAverageScore,
} from "@/lib/lesson-progress";
import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Videodars",
  description:
    "Dars videosi va unga tegişli test.",
};

type PageProps = {
  searchParams: Promise<{
    lessonId?: string | string[];
  }>;
};

type LessonRow = {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  video_url: string | null;
  content: string | null;
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

function formatPercentage(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1);
}

export default async function LessonViewPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const lessonId = Number(
    getSingleValue(params.lessonId),
  );

  if (
    !Number.isInteger(lessonId) ||
    lessonId <= 0
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

  const {
    data: currentLessonData,
    error: lessonError,
  } = await supabase
    .from("lessons")
    .select(`
      id,
      category_id,
      title,
      description,
      video_url,
      content,
      order_number,
      is_free
    `)
    .eq("id", lessonId)
    .eq("is_published", true)
    .single();

  if (
    lessonError ||
    !currentLessonData
  ) {
    notFound();
  }

  const currentLesson =
    currentLessonData as LessonRow;

  const hasPremiumAccess =
    profile.role === "admin" ||
    (
      profile.premium_until !== null &&
      new Date(
        profile.premium_until,
      ).getTime() > Date.now()
    );

  /*
   * Tarif to'sig'i. Navbat to'sig'i pastroqda, darslar ro'yxati
   * yuklangandan keyin tekshiriladi.
   */
  const hasCurrentLessonAccess =
    hasPremiumAccess ||
    currentLesson.is_free === true;

  if (!hasCurrentLessonAccess) {
    redirect(
      `/pricing?locked=lesson&lessonId=${currentLesson.id}`,
    );
  }

  const [
    categoryResult,
    lessonsResult,
  ] = await Promise.all([
    supabase
      .from("lesson_categories")
      .select(`
        id,
        title,
        is_published
      `)
      .eq(
        "id",
        currentLesson.category_id,
      )
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
        content,
        order_number,
        is_free
      `)
      .eq(
        "category_id",
        currentLesson.category_id,
      )
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

  const currentIndex =
    lessons.findIndex(
      (lesson) =>
        lesson.id === currentLesson.id,
    );

  if (currentIndex < 0) {
    notFound();
  }

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

  function isLessonCompleted(lesson: LessonRow) {
    return isLessonPassed(
      testsByLesson.get(lesson.id) ?? [],
      bestScoreMap,
    );
  }

  /*
   * Navbat to'sig'i — qoida `lib/lesson-progress.ts` da,
   * `/lessons/category` bilan bitta joydan o'qiladi.
   */
  const gates = buildLessonGates(
    lessons.map((lesson) => ({
      isFree: lesson.is_free === true,
      isCompleted:
        isLessonCompleted(lesson),
    })),
    hasPremiumAccess,
  );

  const isUnlocked =
    gates[currentIndex].isSequenceUnlocked;

  if (!isUnlocked) {
    redirect(
      `/lessons/category?categoryId=${currentLesson.category_id}&locked=1`,
    );
  }

  const previousLesson =
    currentIndex > 0
      ? lessons[currentIndex - 1]
      : null;

  const nextLesson =
    currentIndex < lessons.length - 1
      ? lessons[currentIndex + 1]
      : null;

  const currentCompleted =
    isLessonCompletedByTests(
      testsByLesson.get(currentLesson.id) ?? [],
      bestScoreMap,
    );

  const nextLessonHasAccess =
    Boolean(
      !nextLesson ||
      gates[currentIndex + 1]
        .hasContentAccess,
    );

  const nextLessonUnlocked =
    Boolean(
      nextLesson &&
      gates[currentIndex + 1].isOpen,
    );

  const currentTestIds =
    testsByLesson.get(currentLesson.id) ?? [];

  const averageScore = lessonAverageScore(
    currentTestIds,
    bestScoreMap,
  );

  let attachedTests: Array<{
    id: number;
    title: string;
    is_published: boolean;
  }> = [];

  if (currentTestIds.length > 0) {
    const { data, error } = await supabase
      .from("tests")
      .select(`
        id,
        title,
        is_published
      `)
      .in("id", currentTestIds);

    if (error) {
      throw new Error(
        `Biriktirilgan testlar yuklanmadi: ${error.message}`,
      );
    }

    /* Tartib admin belgilagancha qolsin */
    attachedTests = currentTestIds
      .map((id) => (data ?? []).find((test) => test.id === id))
      .filter(
        (test): test is {
          id: number;
          title: string;
          is_published: boolean;
        } => Boolean(test),
      );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 py-2.5 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <a
                href={`/lessons/category?categoryId=${currentLesson.category_id}`}
                className="inline-flex min-h-8 items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                ← {category.title}
              </a>

              <h1 className="mt-0.5 truncate text-base font-bold sm:mt-2 sm:text-2xl">
                {currentLesson.order_number}.{" "}
                {currentLesson.title}
              </h1>
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span
                className={
                  currentLesson.is_free
                    ? "rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700"
                    : "rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700"
                }
              >
                {currentLesson.is_free
                  ? "Bepul"
                  : "Premium"}
              </span>

              <span
                className={
                  currentCompleted
                    ? "rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700"
                    : "rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700"
                }
              >
                {currentCompleted
                  ? "Tugallangan"
                  : (testsByLesson.get(currentLesson.id) ?? [])
                        .length === 0
                    ? "Testsiz dars"
                    : "Jarayonda"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-12">
        {currentLesson.description && (
          <p className="mb-4 max-w-3xl text-sm leading-6 text-slate-600">
            {currentLesson.description}
          </p>
        )}

        {currentLesson.video_url ? (
          <YouTubeEmbed
            url={currentLesson.video_url}
            title={currentLesson.title}
          />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Bu darsga video biriktirilmagan.
          </div>
        )}

        {currentLesson.content && (
          <article className="mt-5 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
              Nazariy qism
            </p>

            <div className="mt-3 leading-8 text-slate-800">
              <MathText
                content={
                  currentLesson.content
                }
              />
            </div>
          </article>
        )}

        {attachedTests.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-blue-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-bold text-blue-900">
                Dars testlari
              </p>

              <p className="text-sm font-semibold text-blue-800">
                Örtaça:{" "}
                <span
                  className={
                    currentCompleted
                      ? "text-emerald-700"
                      : "text-blue-700"
                  }
                >
                  {formatPercentage(averageScore ?? 0)}%
                </span>
                <span className="font-medium text-blue-600">
                  {" "}/ 90%
                </span>
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {attachedTests.map((test) => {
                const score = bestScoreMap.get(test.id) ?? 0;

                return (
                  <div
                    key={test.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-mb-ink">
                        {test.title}
                      </p>

                      <p className="mt-0.5 text-xs text-mb-muted">
                        Natijangiz: {formatPercentage(score)}%
                      </p>
                    </div>

                    {test.is_published ? (
                      <a
                        href={`/tests/take?testId=${test.id}&lessonId=${currentLesson.id}`}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
                      >
                        {score > 0 ? "Qayta işlaş" : "Boşlaş"}
                      </a>
                    ) : (
                      <span className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-500">
                        Yopiq
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {previousLesson ? (
            <a
              href={`/lessons/view?lessonId=${previousLesson.id}`}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Oldingi dars
            </a>
          ) : (
            <a
              href={`/lessons/category?categoryId=${currentLesson.category_id}`}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
            >
              Darslar röyxati
            </a>
          )}

          {nextLesson ? (
            !nextLessonHasAccess ? (
              <Link
                href={`/pricing?locked=lesson&lessonId=${nextLesson.id}`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-center font-bold text-white hover:bg-amber-600"
              >
                🔒 Keyingi dars Premium
              </Link>
            ) : nextLessonUnlocked ? (
              <a
                href={`/lessons/view?lessonId=${nextLesson.id}`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-center font-bold text-white hover:bg-blue-700"
              >
                Keyingi dars →
              </a>
            ) : (
              <div className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-200 px-5 py-3 text-center font-bold text-slate-500">
                🔒 Keyingi dars yopiq
              </div>
            )
          ) : (
            <Link
              href="/lessons"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-center font-bold text-white hover:bg-emerald-700"
            >
              Barça dars bölimlari
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
