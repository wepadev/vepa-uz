import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { ChevronRight } from "@/components/ui/icons";
import EmptyState from "@/components/ui/empty-state";
import Pagination from "@/components/ui/pagination";
import ProgressRing from "@/components/ui/progress-ring";
import { Tag } from "@/components/ui/row";
import { btnPrimary } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getSingleValue } from "@/lib/stats-format";
import type {
  RankingTestRpcRow,
  UserSummaryRpcRow,
  UserTestStatisticsRpcRow,
} from "@/lib/stats-types";
import PageHeader, { headerPrimaryButton } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Natijalarim",
  description:
    "Işlagan testlaringiz tarixi va statistikangiz.",
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

  const user = await getCurrentUser();

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
      title: "Barçasi",
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
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        glyph="results"
        title="Natijalarim"
        action={
          <Link href="/tests" className={headerPrimaryButton}>
            Test işlaş
          </Link>
        }
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Umumiy holat: örtaça natija, örin va sonlar bitta kartada */}
        <div className="rounded-2xl border border-mb-line bg-white p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <ProgressRing
              value={averageRankingPercentage}
              size={76}
              stroke={8}
              tone={averageRankingPercentage >= 90 ? "success" : "brand"}
            >
              <span className="num text-base font-extrabold text-mb-ink">
                {formatPercentage(averageRankingPercentage)}%
              </span>
            </ProgressRing>

            <div className="min-w-0 flex-1">
              <p className="eyebrow">Örtaça natija</p>

              {profile.role === "admin" ? (
                <p className="mt-1 text-sm text-mb-muted">
                  Admin hisobiga reyting berilmaydi.
                </p>
              ) : currentOverall ? (
                <Link
                  href="/leaderboard"
                  className="group mt-1 inline-flex items-center gap-1 text-lg font-bold text-mb-ink"
                >
                  <span className="num">
                    {currentOverallRank}-örin
                    <span className="font-normal text-mb-muted">
                      {" "}
                      · {overallParticipants} öquvçi içida
                    </span>
                  </span>
                  <ChevronRight
                    className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              ) : (
                <p className="mt-1 text-sm leading-5 text-mb-muted">
                  Reyting testini işlang — örningiz şu yerda çiqadi.
                </p>
              )}
            </div>
          </div>

          <dl className="num mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Tugallangan", String(completedResults.length)],
              ["Reyting testi", String(userBestRankingAttempts.length)],
              ["Eng yuqori", `${formatPercentage(highestRankingPercentage)}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-2 py-2.5">
                <dt className="text-xs font-semibold text-mb-muted">{label}</dt>
                <dd className="mt-0.5 text-xl font-extrabold text-mb-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <section className="mt-6">
          <h2 className="eyebrow">Natijalar tarixi</h2>

          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1">
            {filterTabs.map((tab) => {
              const isActive = activeView === tab.key;

              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "num inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-center text-[13px] font-semibold leading-4 transition-colors",
                    isActive
                      ? "bg-white text-mb-ink shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {tab.title}
                  <span className="text-slate-400">{tab.count}</span>
                </Link>
              );
            })}
          </div>

          {filteredResults.length === 0 ? (
            <EmptyState
              glyph="results"
              title="Bu bölimda natija yöq"
              className="mt-4"
              action={
                <Link href="/tests" className={btnPrimary}>
                  Testlarni köriş
                </Link>
              }
            >
              Test işlaganingizdan keyin natija va xatolar tahlili şu yerda
              çiqadi.
            </EmptyState>
          ) : (
            <ol className="mt-4 grid gap-3">
              {visibleResults.map((result) => {
                const isCompleted = Boolean(result.completed_at);
                const percentage = result.percentageNumber;

                const body = (
                  <>
                    <ProgressRing
                      value={isCompleted ? percentage : 0}
                      size={52}
                      stroke={6}
                      tone={
                        percentage >= 90
                          ? "success"
                          : percentage >= 60
                            ? "brand"
                            : "danger"
                      }
                    >
                      <span className="num text-xs font-extrabold text-mb-ink">
                        {isCompleted
                          ? `${Math.round(percentage)}%`
                          : "…"}
                      </span>
                    </ProgressRing>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold leading-snug text-mb-ink sm:text-base">
                        {result.testTitle}
                      </span>

                      <span className="num mt-0.5 block text-[13px] text-mb-muted">
                        {formatDate(result.completed_at ?? result.started_at)}
                        {" · "}
                        {resultKindLabel(result.testKind)}
                      </span>

                      <span className="num mt-1.5 block text-[13px] font-semibold text-slate-700">
                        Töğri {result.correctCount}/{result.totalAnswerCount}
                        <span className="font-normal text-mb-muted">
                          {" · "}
                          {result.score}/{result.total_questions} ball ·{" "}
                          {result.elapsedTime}
                        </span>
                      </span>

                      <span className="mt-2 flex flex-wrap gap-1.5 empty:hidden">
                        {!isCompleted && <Tag tone="accent">Tugallanmagan</Tag>}

                        {result.isBestAttempt && (
                          <Tag tone="free">Hisobga olingan</Tag>
                        )}

                        {result.testKind === "ranking" &&
                          result.testRank > 0 && (
                            <Tag tone="brand">
                              {result.testRank}-örin · {result.testParticipants}{" "}
                              kişidan
                            </Tag>
                          )}

                        {result.attemptsForTest > 1 && (
                          <Tag>{result.attemptsForTest} uriniş</Tag>
                        )}
                      </span>
                    </span>

                    {isCompleted && (
                      <ChevronRight
                        className="h-5 w-5 shrink-0 self-center text-slate-400 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    )}
                  </>
                );

                return (
                  <li key={result.id}>
                    {isCompleted ? (
                      <Link
                        href={`/results/view?attemptId=${result.id}`}
                        className="edge group flex items-start gap-3 rounded-2xl border border-mb-line bg-white p-3.5 sm:p-4"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 p-3.5 sm:p-4">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
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
