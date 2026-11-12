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
import {
  TEST_TOPIC_SELECT,
  testLabel,
  type TestWithTopic,
} from "@/lib/test-label";
import { Check, ChevronLeft, ChevronRight, Lock } from "@/components/ui/icons";
import PageHeader from "@/components/ui/page-header";
import ProgressRing from "@/components/ui/progress-ring";
import { RowIndex } from "@/components/ui/row";
import { btnAccent, btnGhost, btnPrimary } from "@/lib/ui";

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
    test_topics?: TestWithTopic["test_topics"];
  }> = [];

  if (currentTestIds.length > 0) {
    const { data, error } = await supabase
      .from("tests")
      .select(`
        id,
        title,
        is_published,
        ${TEST_TOPIC_SELECT}
      `)
      .in("id", currentTestIds);

    if (error) {
      throw new Error(
        `Biriktirilgan testlar yuklanmadi: ${error.message}`,
      );
    }

    /* Tartib admin belgilagancha qolsin */
    attachedTests = currentTestIds
      .map((id) =>
        ((data ?? []) as Array<(typeof attachedTests)[number]>).find(
          (test) => test.id === id,
        ),
      )
      .filter(
        (test): test is (typeof attachedTests)[number] => Boolean(test),
      );
  }

  const hasTests = attachedTests.length > 0;
  const averageValue = averageScore ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref={`/lessons/category?categoryId=${currentLesson.category_id}`}
        backLabel={category.title}
        backNative
        title={currentLesson.title}
        subtitle={`${currentLesson.order_number}-dars · ${lessons.length} darsdan`}
        width="4xl"
        action={
          currentCompleted ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-vp-success-soft px-2.5 py-1.5 text-sm font-semibold text-vp-success">
              <Check className="h-4 w-4" aria-hidden="true" />
              Ötilgan
            </span>
          ) : null
        }
      />

      <section className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
        {currentLesson.video_url ? (
          <YouTubeEmbed
            url={currentLesson.video_url}
            title={currentLesson.title}
          />
        ) : (
          <div className="rounded-2xl border border-vp-warning-line bg-vp-warning-soft px-4 py-3 text-sm font-medium text-vp-warning">
            Bu darsga video biriktirilmagan.
          </div>
        )}

        {currentLesson.description && (
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-700">
            {currentLesson.description}
          </p>
        )}

        {currentLesson.content && (
          <article className="mt-5 rounded-2xl border border-mb-line bg-white p-4 sm:p-6">
            <p className="eyebrow">Nazariy qism</p>

            <div className="mt-3 leading-8 text-slate-800">
              <MathText content={currentLesson.content} />
            </div>
          </article>
        )}

        {hasTests && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-mb-line bg-white">
            {/* Darvoza: keyingi dars oçilişi uçun nima qoldi */}
            <div className="flex items-center gap-4 border-b border-mb-line p-4 sm:p-5">
              <ProgressRing
                value={averageValue}
                size={64}
                stroke={7}
                tone={currentCompleted ? "success" : "brand"}
              >
                <span className="num text-sm font-bold text-mb-ink">
                  {formatPercentage(averageValue)}%
                </span>
              </ProgressRing>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold leading-snug text-mb-ink">
                  {currentCompleted
                    ? "Dars ötildi"
                    : averageValue > 0
                      ? `90% gaça yana ${formatPercentage(Math.max(0, 90 - averageValue))}% qoldi`
                      : "Endi darsni test bilan mustahkamlang"}
                </h2>
                <p className="mt-0.5 text-sm leading-5 text-mb-muted">
                  {currentCompleted
                    ? nextLesson
                      ? "Keyingi dars oçildi."
                      : "Bu kursning oxirgi darsi edi."
                    : "Testlar örtaçasi 90% ga yetganda keyingi dars oçiladi."}
                </p>
              </div>
            </div>

            <ol className="divide-y divide-mb-line">
              {attachedTests.map((test, index) => {
                const score = bestScoreMap.get(test.id) ?? 0;
                const passed = score >= 90;

                return (
                  <li
                    key={test.id}
                    className="flex items-center gap-3 px-3.5 py-3 sm:px-5"
                  >
                    <RowIndex
                      value={index + 1}
                      tone={passed ? "done" : "plain"}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] font-bold leading-snug text-mb-ink">
                        {testLabel(test)}
                      </p>

                      <p className="num mt-0.5 text-[13px] text-mb-muted">
                        {score > 0
                          ? `Eng yaxşi natija ${formatPercentage(score)}%`
                          : "Hali işlanmagan"}
                      </p>
                    </div>

                    {test.is_published ? (
                      <a
                        href={`/tests/take?testId=${test.id}&lessonId=${currentLesson.id}`}
                        className={
                          score > 0
                            ? `${btnGhost} min-h-10 shrink-0`
                            : `${btnPrimary} min-h-10 shrink-0`
                        }
                      >
                        {score > 0 ? "Qayta işlaş" : "Boşlaş"}
                      </a>
                    ) : (
                      <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">
                        Yopiq
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <nav className="mt-6 grid grid-cols-2 gap-3" aria-label="Darslar orasida ötiş">
          {previousLesson ? (
            <a
              href={`/lessons/view?lessonId=${previousLesson.id}`}
              className={`${btnGhost} min-h-12`}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              Oldingi dars
            </a>
          ) : (
            <a
              href={`/lessons/category?categoryId=${currentLesson.category_id}`}
              className={`${btnGhost} min-h-12`}
            >
              Darslar röyxati
            </a>
          )}

          {nextLesson ? (
            !nextLessonHasAccess ? (
              <Link
                href={`/pricing?locked=lesson&lessonId=${nextLesson.id}`}
                className={`${btnAccent} min-h-12`}
              >
                <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                Keyingi dars Premium
              </Link>
            ) : nextLessonUnlocked ? (
              <a
                href={`/lessons/view?lessonId=${nextLesson.id}`}
                className={`${btnPrimary} min-h-12`}
              >
                Keyingi dars
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            ) : (
              <div className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 text-center text-sm font-semibold text-slate-500">
                <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                Keyingi dars yopiq
              </div>
            )
          ) : (
            <Link href="/lessons" className={`${btnPrimary} min-h-12`}>
              Barça kurslar
            </Link>
          )}
        </nav>
      </section>
    </main>
  );
}
