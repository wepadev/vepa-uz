import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import Pagination from "@/components/ui/pagination";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Natijalarim",
  description:
    "Ishlagan testlaringiz tarixi va statistikangiz.",
};

const PAGE_SIZE = 1000;
const ANSWER_ATTEMPT_CHUNK_SIZE = 100;

/** Natijalar tarixida bir sahifada nechta karta ko'rsatiladi */
const RESULTS_PAGE_SIZE = 20;

type PageProps = {
  searchParams: Promise<{
    view?: string | string[];
    page?: string | string[];
  }>;
};

type SupabaseServerClient = Awaited<
  ReturnType<typeof createClient>
>;

type ProfileRow = {
  full_name: string | null;
  role: string;
  is_active: boolean;
};

type AttemptRow = {
  id: string;
  user_id: string;
  test_id: number;
  /** Bo'sh bo'lmasa — bu urinish uy vazifasi sifatida ishlangan */
  assignment_id: number | null;
  score: number;
  total_questions: number;
  percentage: number | string;
  started_at: string;
  completed_at: string | null;
};

type TestRow = {
  id: number;
  title: string;
};

type LessonTestRow = {
  test_id: number | null;
};

type UserAnswerRow = {
  attempt_id: string;
  question_id: number;
  selected_answer: string;
  is_correct: boolean;
};

type RankingTestRpcRow = {
  test_id: number | string;
  title: string;
  created_at: string;
  participants: number | string;
};

type UserSummaryRpcRow = {
  user_id: string;
  full_name: string;
  is_ranked: boolean;
  overall_rank: number | string;
  overall_participants: number | string;
  rating_points: number | string;
  ranking_tests_total: number | string;
  tests_completed: number | string;
  attempts_completed: number | string;
  excellent_tests: number | string;
  average_percentage: number | string;
  highest_percentage: number | string;
};

type UserTestStatisticsRpcRow = {
  test_id: number | string;
  title: string;
  attempts_count: number | string;
  completed_attempts: number | string;
  last_attempt_at: string | null;
  best_attempt_id: string | null;
  best_percentage: number | string;
  best_duration_seconds: number | string | null;
  best_completed_at: string | null;
  test_rank: number | string;
  test_participants: number | string;
  is_passed: boolean;
};

type ResultView = AttemptRow & {
  testTitle: string;
  percentageNumber: number;
  correctCount: number;
  totalAnswerCount: number;
  answeredCount: number;
  elapsedTime: string;
  testKind: "ranking" | "lesson" | "homework" | "other";
  attemptsForTest: number;
  bestPercentage: number;
  isBestAttempt: boolean;
  testRank: number;
  testParticipants: number;
};

function getSingleValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function getNumber(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatPercentage(
  value: number | string,
) {
  const number = getNumber(value);

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Tugallanmagan";
  }

  return new Intl.DateTimeFormat(
    "uz-UZ",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    },
  ).format(new Date(value));
}

function getDurationSeconds(
  startedAt: string,
  completedAt: string | null,
) {
  if (!completedAt) {
    return Number.MAX_SAFE_INTEGER;
  }

  const milliseconds =
    new Date(completedAt).getTime() -
    new Date(startedAt).getTime();

  if (
    !Number.isFinite(milliseconds) ||
    milliseconds < 0
  ) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.floor(
    milliseconds / 1000,
  );
}

function formatDurationFromSeconds(
  totalSeconds: number,
) {
  if (
    !Number.isFinite(totalSeconds) ||
    totalSeconds ===
      Number.MAX_SAFE_INTEGER
  ) {
    return "—";
  }

  const hours = Math.floor(
    totalSeconds / 3600,
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );

  const seconds =
    totalSeconds % 60;

  return [
    hours,
    minutes,
    seconds,
  ]
    .map((part) =>
      String(part).padStart(2, "0"),
    )
    .join(":");
}

function formatAttemptDuration(
  attempt: AttemptRow,
) {
  if (!attempt.completed_at) {
    return "Jarayonda";
  }

  return formatDurationFromSeconds(
    getDurationSeconds(
      attempt.started_at,
      attempt.completed_at,
    ),
  );
}

function resultKindLabel(
  kind: ResultView["testKind"],
) {
  if (kind === "ranking") {
    return "Reyting testi";
  }

  if (kind === "lesson") {
    return "Dars testi";
  }

  if (kind === "homework") {
    return "Uy vazifasi";
  }

  return "Arxiv testi";
}

async function fetchCurrentUserAttempts(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const rows: AttemptRow[] = [];

  for (
    let from = 0;
    ;
    from += PAGE_SIZE
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("attempts")
      .select(`
        id,
        user_id,
        test_id,
        assignment_id,
        score,
        total_questions,
        percentage,
        started_at,
        completed_at
      `)
      .eq("user_id", userId)
      .order("started_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(
        from,
        from + PAGE_SIZE - 1,
      );

    if (error) {
      throw new Error(
        `Natijalar yuklanmadi: ${error.message}`,
      );
    }

    const page =
      (data ?? []) as AttemptRow[];

    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchUserAnswers(
  supabase: SupabaseServerClient,
  attemptIds: string[],
) {
  const rows: UserAnswerRow[] = [];

  for (
    let start = 0;
    start < attemptIds.length;
    start += ANSWER_ATTEMPT_CHUNK_SIZE
  ) {
    const attemptIdChunk =
      attemptIds.slice(
        start,
        start +
          ANSWER_ATTEMPT_CHUNK_SIZE,
      );

    for (
      let from = 0;
      ;
      from += PAGE_SIZE
    ) {
      const {
        data,
        error,
      } = await supabase
        .from("user_answers")
        .select(`
          attempt_id,
          question_id,
          selected_answer,
          is_correct
        `)
        .in(
          "attempt_id",
          attemptIdChunk,
        )
        .order("attempt_id", {
          ascending: true,
        })
        .order("question_id", {
          ascending: true,
        })
        .range(
          from,
          from + PAGE_SIZE - 1,
        );

      if (error) {
        throw new Error(
          `Javoblar statistikasi yuklanmadi: ${error.message}`,
        );
      }

      const page =
        (data ??
          []) as UserAnswerRow[];

      rows.push(...page);

      if (page.length < PAGE_SIZE) {
        break;
      }
    }
  }

  return rows;
}

export default async function MyResultsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const requestedView =
    getSingleValue(params.view);

  const activeView =
    requestedView === "ranking" ||
    requestedView === "lessons"
      ? requestedView
      : "all";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const {
    data: profileData,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(`
      full_name,
      role,
      is_active
    `)
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profileData ||
    profileData.is_active !== true
  ) {
    redirect("/");
  }

  const profile =
    profileData as ProfileRow;

  const [
    currentUserAttempts,
    rankingTestsResult,
    summaryResult,
    testStatisticsResult,
    lessonTestsResult,
  ] = await Promise.all([
    fetchCurrentUserAttempts(
      supabase,
      user.id,
    ),

    supabase.rpc(
      "get_ranking_tests",
    ),

    supabase.rpc(
      "get_user_ranking_summary",
      {
        p_user_id: null,
      },
    ),

    supabase.rpc(
      "get_user_test_statistics",
      {
        p_user_id: null,
        p_test_id: null,
      },
    ),

    supabase
      .from("lesson_tests")
      .select("test_id"),
  ]);

  if (rankingTestsResult.error) {
    throw new Error(
      `Reyting testlari yuklanmadi: ${rankingTestsResult.error.message}`,
    );
  }

  if (summaryResult.error) {
    throw new Error(
      `Umumiy reyting yuklanmadi: ${summaryResult.error.message}`,
    );
  }

  if (testStatisticsResult.error) {
    throw new Error(
      `Test reytinglari yuklanmadi: ${testStatisticsResult.error.message}`,
    );
  }

  if (lessonTestsResult.error) {
    throw new Error(
      `Dars testlari aniqlanmadi: ${lessonTestsResult.error.message}`,
    );
  }

  const rankingTests =
    (
      rankingTestsResult.data ??
      []
    ) as RankingTestRpcRow[];

  const summary =
    (
      summaryResult.data ??
      []
    )[0] as
      | UserSummaryRpcRow
      | undefined;

  const testStatistics =
    (
      testStatisticsResult.data ??
      []
    ) as UserTestStatisticsRpcRow[];

  const lessonTests =
    (
      lessonTestsResult.data ??
      []
    ) as LessonTestRow[];

  const rankingTestIdSet =
    new Set(
      rankingTests.map(
        (test) =>
          getNumber(test.test_id),
      ),
    );

  const lessonTestIds =
    new Set(
      lessonTests
        .map(
          (lesson) =>
            lesson.test_id,
        )
        .filter(
          (
            testId,
          ): testId is number =>
            typeof testId === "number",
        ),
    );

  const statisticsByTest =
    new Map(
      testStatistics.map((row) => [
        getNumber(row.test_id),
        row,
      ]),
    );

  const currentAttemptIds =
    currentUserAttempts.map(
      (attempt) => attempt.id,
    );

  const currentTestIds = [
    ...new Set(
      currentUserAttempts.map(
        (attempt) =>
          attempt.test_id,
      ),
    ),
  ];

  const [
    userAnswers,
    testsResult,
  ] = await Promise.all([
    currentAttemptIds.length > 0
      ? fetchUserAnswers(
          supabase,
          currentAttemptIds,
        )
      : Promise.resolve(
          [] as UserAnswerRow[],
        ),

    currentTestIds.length > 0
      ? supabase
          .from("tests")
          .select("id, title")
          .in("id", currentTestIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (testsResult.error) {
    throw new Error(
      `Test nomlari yuklanmadi: ${testsResult.error.message}`,
    );
  }

  const tests =
    (
      testsResult.data ??
      []
    ) as TestRow[];

  const testMap =
    new Map<number, string>();

  for (const test of rankingTests) {
    testMap.set(
      getNumber(test.test_id),
      test.title,
    );
  }

  for (const test of tests) {
    testMap.set(
      test.id,
      test.title,
    );
  }

  const answersByAttempt =
    new Map<
      string,
      UserAnswerRow[]
    >();

  for (const answer of userAnswers) {
    const current =
      answersByAttempt.get(
        answer.attempt_id,
      ) ?? [];

    current.push(answer);

    answersByAttempt.set(
      answer.attempt_id,
      current,
    );
  }

  const attemptsCountByTest =
    new Map<number, number>();

  for (
    const attempt of
    currentUserAttempts
  ) {
    attemptsCountByTest.set(
      attempt.test_id,
      (attemptsCountByTest.get(
        attempt.test_id,
      ) ?? 0) + 1,
    );
  }

  const results: ResultView[] =
    currentUserAttempts.map(
      (attempt) => {
        const answers =
          answersByAttempt.get(
            attempt.id,
          ) ?? [];

        const answeredCount =
          answers.filter(
            (answer) =>
              answer.selected_answer
                ?.trim()
                .length > 0,
          ).length;

        const correctCount =
          answers.filter(
            (answer) =>
              answer.is_correct ===
              true,
          ).length;

        /*
         * Turini aniqlash tartibi muhim.
         *
         * Uy vazifasi birinchi tekshiriladi: uni "Testlar" bo'limidagi
         * testdan ham berish mumkin, o'sha holatda ham u reyting
         * testi emas, balki vazifa deb ko'rsatilishi kerak.
         */
        const testKind:
          ResultView["testKind"] =
          attempt.assignment_id
            ? "homework"
            : rankingTestIdSet.has(
                  attempt.test_id,
                )
              ? "ranking"
              : lessonTestIds.has(
                    attempt.test_id,
                  )
                ? "lesson"
                : "other";

        const statistics =
          statisticsByTest.get(
            attempt.test_id,
          );

        return {
          ...attempt,
          testTitle:
            testMap.get(
              attempt.test_id,
            ) ?? "Nomaʼlum test",
          percentageNumber:
            getNumber(
              attempt.percentage,
            ),
          correctCount,
          totalAnswerCount:
            answers.length,
          answeredCount,
          elapsedTime:
            formatAttemptDuration(
              attempt,
            ),
          testKind,
          attemptsForTest:
            attemptsCountByTest.get(
              attempt.test_id,
            ) ?? 1,
          bestPercentage:
            statistics
              ? getNumber(
                  statistics.best_percentage,
                )
              : 0,
          isBestAttempt:
            Boolean(
              statistics
                ?.best_attempt_id &&
                statistics
                  .best_attempt_id ===
                  attempt.id,
            ),
          testRank:
            statistics
              ? getNumber(
                  statistics.test_rank,
                )
              : 0,
          testParticipants:
            statistics
              ? getNumber(
                  statistics.test_participants,
                )
              : 0,
        };
      },
    );

  const rankingResults =
    results.filter(
      (result) =>
        result.testKind ===
        "ranking",
    );

  const lessonResults =
    results.filter(
      (result) =>
        result.testKind ===
        "lesson",
    );

  const filteredResults =
    activeView === "ranking"
      ? rankingResults
      : activeView === "lessons"
        ? lessonResults
        : results;

  /*
   * Sahifalash.
   *
   * Ko'p test ishlagan o'quvchida bu ro'yxat yuzlab kartaga
   * yetadi va sahifa sekinlashadi. Barcha natijalar baribir
   * yuklanadi (statistika ular asosida hisoblanadi), lekin
   * ekranga bir vaqtda 20 tasi chiqadi.
   */
  const resultsTotal =
    filteredResults.length;

  const resultsTotalPages = Math.max(
    1,
    Math.ceil(
      resultsTotal / RESULTS_PAGE_SIZE,
    ),
  );

  const resultsPage = Math.min(
    Math.max(
      1,
      Number(
        getSingleValue(params.page),
      ) || 1,
    ),
    resultsTotalPages,
  );

  const visibleResults =
    filteredResults.slice(
      (resultsPage - 1) *
        RESULTS_PAGE_SIZE,
      resultsPage * RESULTS_PAGE_SIZE,
    );

  /** Sahifa manzili — tanlangan bo'lim saqlanadi */
  function resultsPageHref(
    page: number,
  ) {
    const search = new URLSearchParams();

    if (activeView !== "all") {
      search.set("view", activeView);
    }

    if (page > 1) {
      search.set(
        "page",
        String(page),
      );
    }

    const text = search.toString();

    return text
      ? `/results?${text}`
      : "/results";
  }

  const completedResults =
    results.filter(
      (result) =>
        Boolean(
          result.completed_at,
        ),
    );

  const userBestRankingAttempts =
    testStatistics.filter(
      (statistics) =>
        Boolean(
          statistics.best_attempt_id,
        ),
    );

  const highestRankingPercentage =
    getNumber(
      summary?.highest_percentage,
    );

  const averageRankingPercentage =
    getNumber(
      summary?.average_percentage,
    );

  const currentOverallRank =
    getNumber(
      summary?.overall_rank,
    );

  const overallParticipants =
    getNumber(
      summary?.overall_participants,
    );

  const currentOverall =
    summary?.is_ranked
      ? {
          ratingPoints:
            getNumber(
              summary.rating_points,
            ),
        }
      : null;

  const filterTabs = [
    {
      key: "all",
      title: "Barchasi",
      count: results.length,
      href: "/results",
    },
    {
      key: "ranking",
      title: "Reyting testlari",
      count: rankingResults.length,
      href: "/results?view=ranking",
    },
    {
      key: "lessons",
      title: "Dars testlari",
      count: lessonResults.length,
      href: "/results?view=lessons",
    },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← Bosh sahifa
            </Link>

            <p className="truncate text-lg font-bold sm:text-xl">
              Natijalarim
            </p>
          </div>

          <Link
            href="/tests"
            className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-mb-brand px-4 text-sm font-semibold text-white hover:bg-mb-brandDark"
          >
            Test ishlash
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        {/* Umumiy o'rin */}
        <div className="relative overflow-hidden rounded-3xl bg-mb-brand p-5 text-white shadow-lg sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-100">
                Umumiy reyting
              </p>

              {profile.role === "admin" ? (
                <p className="mt-1 text-lg font-bold">
                  Admin hisobiga reyting berilmaydi
                </p>
              ) : currentOverall ? (
                <>
                  <p className="mt-1 text-4xl font-bold leading-none sm:text-5xl">
                    {currentOverallRank}
                    <span className="text-2xl font-bold">-o‘rin</span>
                  </p>

                  <p className="mt-1.5 text-sm text-blue-100">
                    {overallParticipants} o‘quvchi ichida ·{" "}
                    {formatPercentage(
                      currentOverall.ratingPoints,
                    )}{" "}
                    ball
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-bold sm:text-3xl">
                    Hali reytingda emassiz
                  </p>

                  <p className="mt-1.5 text-sm text-blue-100">
                    Reyting testlarini ishlang — o‘rningiz shu yerda
                    chiqadi.
                  </p>
                </>
              )}
            </div>

            <Link
              href="/leaderboard"
              className="inline-flex min-h-11 items-center rounded-2xl bg-white/15 px-4 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/25"
            >
              Reyting jadvali
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {[
            {
              label: "Tugallangan",
              value: String(completedResults.length),
              tone: "text-mb-ink",
            },
            {
              label: "Reyting testi",
              value: String(userBestRankingAttempts.length),
              tone: "text-blue-600",
            },
            {
              label: "O‘rtacha",
              value: `${formatPercentage(averageRankingPercentage)}%`,
              tone: "text-blue-600",
            },
            {
              label: "Eng yuqori",
              value: `${formatPercentage(highestRankingPercentage)}%`,
              tone: "text-emerald-600",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-mb-line bg-white px-3 py-3 text-center shadow-sm sm:px-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mb-muted">
                {card.label}
              </p>

              <p className={`mt-1 text-2xl font-bold ${card.tone}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold sm:text-xl">
              Natijalar tarixi
            </h2>

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {filterTabs.map((tab) => {
                const isActive =
                  activeView === tab.key;

                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className={
                      isActive
                        ? "inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white sm:text-sm"
                        : "inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-3 py-2 text-center text-xs font-bold text-slate-600 hover:bg-slate-100 sm:text-sm"
                    }
                  >
                    <span>
                      {tab.title}
                    </span>

                    <span
                      className={
                        isActive
                          ? "rounded-full bg-white/15 px-2 py-0.5 text-[10px]"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500"
                      }
                    >
                      {tab.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {filteredResults.length ===
          0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center sm:px-6 sm:py-16">
              <h3 className="text-lg font-bold">
                Bu boʼlimda natija yoʼq
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Test ishlaganingizdan
                keyin natija shu yerda
                chiqadi.
              </p>

              <Link
                href="/tests"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
              >
                Testlarni koʼrish
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {visibleResults.map(
                (result) => {
                  const isCompleted =
                    Boolean(
                      result.completed_at,
                    );

                  return (
                    <article
                      key={result.id}
                      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div
                        className={
                          result.testKind ===
                          "lesson"
                            ? "h-1.5 bg-mb-brand"
                            : isCompleted
                              ? "h-1.5 bg-emerald-500"
                              : "h-1.5 bg-amber-500"
                        }
                      />

                      <div className="p-5 sm:p-6">
                        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold leading-7 sm:text-xl">
                                {
                                  result.testTitle
                                }
                              </h3>

                              <span
                                className={
                                  result.testKind ===
                                  "ranking"
                                    ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                                    : result.testKind ===
                                        "lesson"
                                      ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                                      : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                                }
                              >
                                {resultKindLabel(
                                  result.testKind,
                                )}
                              </span>

                              {result.testKind ===
                                "lesson" && (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                                  Reytingga
                                  kirmaydi
                                </span>
                              )}

                              {result.isBestAttempt && (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                                  Eng yaxshi
                                  urinish
                                </span>
                              )}

                              <span
                                className={
                                  isCompleted
                                    ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                    : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"
                                }
                              >
                                {isCompleted
                                  ? "Tugallangan"
                                  : "Jarayonda"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-medium text-slate-500">
                              {formatDate(
                                result.completed_at ??
                                  result.started_at,
                              )}
                            </p>
                          </div>

                          {result.testKind ===
                            "ranking" &&
                            result.testRank >
                              0 && (
                              <div className="rounded-2xl bg-blue-600 px-5 py-3 text-center text-white">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-100">
                                  Test reytingi
                                </p>

                                <p className="mt-1 text-2xl font-bold">
                                  {
                                    result.testRank
                                  }
                                  /
                                  {
                                    result.testParticipants
                                  }
                                </p>
                              </div>
                            )}
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                          <div className="rounded-2xl bg-blue-50 p-3">
                            <p className="text-xs font-bold text-blue-600">
                              Foiz
                            </p>

                            <p
                              className={
                                result.percentageNumber >=
                                80
                                  ? "mt-1 text-xl font-bold text-emerald-600"
                                  : result.percentageNumber >=
                                      60
                                    ? "mt-1 text-xl font-bold text-blue-700"
                                    : "mt-1 text-xl font-bold text-red-600"
                              }
                            >
                              {formatPercentage(
                                result.percentage,
                              )}
                              %
                            </p>
                          </div>

                          <div className="rounded-2xl bg-emerald-50 p-3">
                            <p className="text-xs font-bold text-emerald-700">
                              Toʼgʼri
                            </p>

                            <p className="mt-1 text-xl font-bold text-emerald-700">
                              {
                                result.correctCount
                              }
                              /
                              {
                                result.totalAnswerCount
                              }
                            </p>
                          </div>

                          <div className="rounded-2xl bg-blue-50 p-3">
                            <p className="text-xs font-bold text-blue-700">
                              Ball
                            </p>

                            <p className="mt-1 text-xl font-bold text-blue-700">
                              {result.score}/
                              {
                                result.total_questions
                              }
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-100 p-3">
                            <p className="text-xs font-bold text-slate-600">
                              Vaqt
                            </p>

                            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-800">
                              {
                                result.elapsedTime
                              }
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500 sm:text-sm">
                            <span>
                              Javob berilgan:{" "}
                              {
                                result.answeredCount
                              }
                              /
                              {
                                result.totalAnswerCount
                              }
                            </span>

                            <span>
                              Jami urinish:{" "}
                              {
                                result.attemptsForTest
                              }
                            </span>

                            {result.testKind ===
                              "ranking" && (
                              <span>
                                Eng yaxshi:{" "}
                                {formatPercentage(
                                  result.bestPercentage,
                                )}
                                %
                              </span>
                            )}
                          </div>

                          {isCompleted && (
                            <Link
                              href={`/results/view?attemptId=${result.id}`}
                              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-blue-700"
                            >
                              Batafsil koʼrish
                            </Link>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}

          <Pagination
            currentPage={resultsPage}
            totalPages={resultsTotalPages}
            totalItems={resultsTotal}
            pageSize={RESULTS_PAGE_SIZE}
            hrefFor={resultsPageHref}
          />
        </section>
      </section>
    </main>
  );
}
