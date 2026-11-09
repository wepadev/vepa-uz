import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { Trophy } from "lucide-react";
import Pagination from "@/components/ui/pagination";
import { formatDate, getSingleValue, toNumber } from "@/lib/stats-format";
import type {
  RankingTestRpcRow,
  UserSummaryRpcRow,
  UserTestStatisticsRpcRow,
} from "@/lib/stats-types";
import PageHeader, { headerButton } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reyting",
  description:
    "Eng yaxşi natijalar va umumiy reyting jadvali.",
};

/*
 * Bir sahifada nechta o'quvchi ko'rsatiladi.
 *
 * Ilgari 100 tasi birdan yuklanardi. O'quvchilar soni ortgani sari
 * sahifa og'irlashadi, telefonda esa pastga uzoq aylantirishga
 * to'g'ri keladi. Endi bazadan ham faqat kerakli qismi olinadi —
 * RPC funksiyalari `p_offset` ni allaqachon qabul qiladi.
 */
const LEADERBOARD_PAGE_SIZE = 25;

type PageProps = {
  searchParams: Promise<{
    testId?: string | string[];
    page?: string | string[];
    testPage?: string | string[];
  }>;
};

type CurrentProfileRow = {
  full_name: string | null;
  role: string;
  is_active: boolean;
};

type OverallRpcRow = {
  overall_rank: number | string;
  participants: number | string;
  user_id: string;
  full_name: string;
  rating_points: number | string;
  tests_completed: number | string;
  excellent_tests: number | string;
  average_percentage: number | string;
  highest_percentage: number | string;
};

type TestLeaderboardRpcRow = {
  test_rank: number | string;
  participants: number | string;
  user_id: string;
  full_name: string;
  attempt_id: string;
  percentage: number | string;
  duration_seconds: number | string;
  score: number | string;
  total_questions: number | string;
  completed_at: string;
  attempts_count: number | string;
};

function formatNumber(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const number = toNumber(value);

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}

function formatDuration(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const totalSeconds =
    toNumber(value);

  if (totalSeconds < 0) {
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

function Medal({
  rank,
}: {
  rank: number;
}) {
  if (rank > 3) {
    return (
      <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-slate-100 px-2 text-sm font-bold text-slate-700">
        {rank}
      </span>
    );
  }

  const className =
    rank === 1
      ? "bg-amber-100 text-amber-700"
      : rank === 2
        ? "bg-slate-200 text-slate-700"
        : "bg-amber-100 text-amber-700";

  return (
    <span
      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-2xl px-2 text-lg font-bold ${className}`}
      aria-label={`${rank}-örin`}
    >
      {rank === 1
        ? "🥇"
        : rank === 2
          ? "🥈"
          : "🥉"}
    </span>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  /** So'rovdagi sahifa raqami — noto'g'ri qiymatda 1-sahifa */
  function readPage(
    value: string | string[] | undefined,
  ) {
    const number = Number(
      getSingleValue(value),
    );

    return Number.isInteger(number) &&
      number > 0
      ? number
      : 1;
  }

  const overallPage = readPage(
    params.page,
  );

  const testPage = readPage(
    params.testPage,
  );

  /** Sahifa manzili — tanlangan test va ikkinchi jadval saqlanadi */
  function hrefWith(
    overrides: {
      page?: number;
      testPage?: number;
    },
  ) {
    const search = new URLSearchParams();

    const testId = getSingleValue(
      params.testId,
    );

    const nextPage =
      overrides.page ?? overallPage;

    const nextTestPage =
      overrides.testPage ?? testPage;

    if (testId) {
      search.set("testId", testId);
    }

    if (nextPage > 1) {
      search.set(
        "page",
        String(nextPage),
      );
    }

    if (nextTestPage > 1) {
      search.set(
        "testPage",
        String(nextTestPage),
      );
    }

    const text = search.toString();

    return text
      ? `/leaderboard?${text}`
      : "/leaderboard";
  }

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const {
    data: currentProfileData,
    error: currentProfileError,
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
    currentProfileError ||
    !currentProfileData ||
    currentProfileData.is_active !==
      true
  ) {
    redirect("/");
  }

  const currentProfile =
    currentProfileData as CurrentProfileRow;

  const [
    rankingTestsResult,
    overallResult,
    summaryResult,
  ] = await Promise.all([
    supabase.rpc(
      "get_ranking_tests",
    ),

    supabase.rpc(
      "get_overall_leaderboard",
      {
        p_limit:
          LEADERBOARD_PAGE_SIZE,
        p_offset:
          (overallPage - 1) *
          LEADERBOARD_PAGE_SIZE,
      },
    ),

    supabase.rpc(
      "get_user_ranking_summary",
      {
        p_user_id: null,
      },
    ),
  ]);

  if (rankingTestsResult.error) {
    throw new Error(
      `Reyting testlari yuklanmadi: ${rankingTestsResult.error.message}`,
    );
  }

  if (overallResult.error) {
    throw new Error(
      `Umumiy reyting yuklanmadi: ${overallResult.error.message}`,
    );
  }

  if (summaryResult.error) {
    throw new Error(
      `Şaxsiy reyting yuklanmadi: ${summaryResult.error.message}`,
    );
  }

  const rankingTests =
    (
      rankingTestsResult.data ??
      []
    ) as RankingTestRpcRow[];

  const overallRows =
    (
      overallResult.data ??
      []
    ) as OverallRpcRow[];

  const currentSummary =
    (
      summaryResult.data ??
      []
    )[0] as
      | UserSummaryRpcRow
      | undefined;

  const requestedTestId =
    Number(
      getSingleValue(
        params.testId,
      ),
    );

  const selectedTest =
    rankingTests.find(
      (test) =>
        toNumber(test.test_id) ===
        requestedTestId,
    ) ??
    rankingTests[0] ??
    null;

  let testRows:
    TestLeaderboardRpcRow[] = [];

  let currentTestStatistics:
    | UserTestStatisticsRpcRow
    | null = null;

  if (selectedTest) {
    const selectedTestId =
      toNumber(
        selectedTest.test_id,
      );

    const [
      testLeaderboardResult,
      userTestResult,
    ] = await Promise.all([
      supabase.rpc(
        "get_test_leaderboard",
        {
          p_test_id:
            selectedTestId,
          p_limit:
            LEADERBOARD_PAGE_SIZE,
          p_offset:
            (testPage - 1) *
            LEADERBOARD_PAGE_SIZE,
        },
      ),

      supabase.rpc(
        "get_user_test_statistics",
        {
          p_user_id: null,
          p_test_id:
            selectedTestId,
        },
      ),
    ]);

    if (
      testLeaderboardResult.error
    ) {
      throw new Error(
        `Test reytingi yuklanmadi: ${testLeaderboardResult.error.message}`,
      );
    }

    if (userTestResult.error) {
      throw new Error(
        `Test statistikangiz yuklanmadi: ${userTestResult.error.message}`,
      );
    }

    testRows =
      (
        testLeaderboardResult.data ??
        []
      ) as TestLeaderboardRpcRow[];

    const userTestRows =
      (
        userTestResult.data ??
        []
      ) as UserTestStatisticsRpcRow[];

    currentTestStatistics =
      userTestRows[0] ?? null;
  }

  /*
   * Jami qatnashchilar soni har bir qatorda qaytadi. Sahifa bo'sh
   * bo'lsa (masalan qo'lda katta raqam yozilsa) hozirgi holatdan
   * kelib chiqib hisoblaymiz — sahifalash yashiriladi.
   */
  const overallTotal = toNumber(
    overallRows[0]?.participants,
  );

  const overallTotalPages = Math.max(
    1,
    Math.ceil(
      overallTotal /
        LEADERBOARD_PAGE_SIZE,
    ),
  );

  const testTotal = toNumber(
    testRows[0]?.participants,
  );

  const testTotalPages = Math.max(
    1,
    Math.ceil(
      testTotal /
        LEADERBOARD_PAGE_SIZE,
    ),
  );

  /* Sovrindorlar faqat birinchi sahifada — ular umumiy TOP 3 */
  const topThree =
    overallPage === 1
      ? overallRows.slice(0, 3)
      : [];

  const isAdmin =
    currentProfile.role === "admin";

  const isRanked =
    Boolean(
      currentSummary?.is_ranked,
    );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        title="Reyting"
        action={
          <Link href="/results" className={headerButton}>
            Natijalarim
          </Link>
        }
      />

      <section className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        {/* Sizning o'rningiz */}
        <div className="relative overflow-hidden rounded-3xl bg-mb-brand p-5 text-white shadow-lg sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-100">
                <Trophy
                  className="h-4 w-4"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                Sizning örningiz
              </p>

              {isAdmin ? (
                <p className="mt-1.5 text-xl font-bold">
                  Admin reytingga kirmaydi
                </p>
              ) : isRanked ? (
                <>
                  <p className="mt-1 text-4xl font-bold leading-none sm:text-5xl">
                    {formatNumber(currentSummary?.overall_rank)}
                    <span className="text-2xl font-bold">-örin</span>
                  </p>

                  <p className="mt-1.5 text-sm text-blue-100">
                    {formatNumber(
                      currentSummary?.overall_participants,
                    )}{" "}
                    öquvçi içida ·{" "}
                    {formatNumber(currentSummary?.rating_points)} ball
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-bold sm:text-3xl">
                    Hali reytingda emassiz
                  </p>

                  <p className="mt-1.5 text-sm text-blue-100">
                    Testlar bölimidan bitta test işlang — örningiz
                    şu yerda çiqadi.
                  </p>
                </>
              )}
            </div>

            <Link
              href="/tests"
              className="inline-flex min-h-11 items-center rounded-2xl bg-white px-5 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              Test işlaş
            </Link>
          </div>
        </div>

        {topThree.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {topThree.map((row) => {
              const rank =
                toNumber(
                  row.overall_rank,
                );

              return (
                <article
                  key={row.user_id}
                  className={
                    rank === 1
                      ? "rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
                      : rank === 2
                        ? "rounded-3xl border border-slate-300 bg-white p-5 shadow-sm"
                        : "rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <Medal
                      rank={rank}
                    />

                    <span className="text-sm font-bold text-slate-500">
                      {formatNumber(
                        row.rating_points,
                      )}{" "}
                      ball
                    </span>
                  </div>

                  <h2 className="mt-4 break-words text-xl font-bold text-slate-950">
                    {row.full_name}
                  </h2>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-500">
                        Testlar
                      </p>

                      <p className="mt-1 font-bold">
                        {formatNumber(
                          row.tests_completed,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-500">
                        Örtaça
                      </p>

                      <p className="mt-1 font-bold">
                        {formatNumber(
                          row.average_percentage,
                        )}
                        %
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {isRanked && (
          <article className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-bold text-blue-700">
                  Sizning umumiy
                  natijangiz
                </p>

                <h2 className="mt-1 text-2xl font-bold text-blue-950">
                  {formatNumber(
                    currentSummary
                      ?.overall_rank,
                  )}
                  -örin
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase text-slate-500">
                    Ball
                  </p>

                  <p className="mt-1 font-bold text-blue-700">
                    {formatNumber(
                      currentSummary
                        ?.rating_points,
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase text-slate-500">
                    Test
                  </p>

                  <p className="mt-1 font-bold text-blue-700">
                    {formatNumber(
                      currentSummary
                        ?.tests_completed,
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase text-slate-500">
                    90%+
                  </p>

                  <p className="mt-1 font-bold text-emerald-700">
                    {formatNumber(
                      currentSummary
                        ?.excellent_tests,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </article>
        )}

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <h2 className="text-2xl font-bold">
                Umumiy reyting
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Har testdagi eng
                yaxşi foizlar
                yiğindisi
              </p>
            </div>

            {overallRows.length ===
            0 ? (
              <div className="px-5 py-14 text-center text-sm font-medium text-slate-500">
                Hozirça reyting
                natijasi yöq.
              </div>
            ) : (
              <>
              {/* Mobil: jadval o‘rniga karta ro‘yxati */}
              <div className="divide-y divide-slate-100 md:hidden">
                {overallRows.map((row) => {
                  const rank = toNumber(
                    row.overall_rank,
                  );

                  const isCurrentUser =
                    row.user_id === user.id;

                  return (
                    <div
                      key={row.user_id}
                      className={
                        isCurrentUser
                          ? "flex items-center gap-3 bg-blue-50 px-4 py-3"
                          : "flex items-center gap-3 px-4 py-3"
                      }
                    >
                      <Medal rank={rank} />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-950">
                          {row.full_name}
                          {isCurrentUser && (
                            <span className="ml-2 inline-flex rounded-full bg-mb-brand px-2 py-0.5 text-[10px] font-bold text-white">
                              Siz
                            </span>
                          )}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatNumber(
                            row.tests_completed,
                          )}{" "}
                          ta test ·{" "}
                          {formatNumber(
                            row.average_percentage,
                          )}
                          % örtaça
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-base font-bold text-blue-700">
                          {formatNumber(
                            row.rating_points,
                          )}
                        </p>
                        <p className="text-[10px] font-semibold uppercase text-mb-muted">
                          ball
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-bold">
                        Örin
                      </th>

                      <th className="px-5 py-4 font-bold">
                        Öquvçi
                      </th>

                      <th className="px-5 py-4 text-center font-bold">
                        Test
                      </th>

                      <th className="px-5 py-4 text-center font-bold">
                        Örtaça
                      </th>

                      <th className="px-5 py-4 text-right font-bold">
                        Ball
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {overallRows.map(
                      (row) => {
                        const rank =
                          toNumber(
                            row.overall_rank,
                          );

                        return (
                          <tr
                            key={row.user_id}
                            className={
                              row.user_id ===
                              user.id
                                ? "bg-blue-50"
                                : "hover:bg-slate-50"
                            }
                          >
                            <td className="px-5 py-4">
                              <Medal
                                rank={rank}
                              />
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-bold text-slate-950">
                                {
                                  row.full_name
                                }
                              </p>

                              {row.user_id ===
                                user.id && (
                                <span className="mt-1 inline-flex rounded-full bg-mb-brand px-2.5 py-1 text-[10px] font-bold text-white">
                                  Siz
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-center font-bold text-blue-700">
                              {formatNumber(
                                row.tests_completed,
                              )}
                            </td>

                            <td className="px-5 py-4 text-center font-bold text-emerald-700">
                              {formatNumber(
                                row.average_percentage,
                              )}
                              %
                            </td>

                            <td className="px-5 py-4 text-right text-lg font-bold text-blue-700">
                              {formatNumber(
                                row.rating_points,
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-5 pb-5 sm:px-6">
                <Pagination
                  currentPage={overallPage}
                  totalPages={overallTotalPages}
                  totalItems={overallTotal}
                  pageSize={LEADERBOARD_PAGE_SIZE}
                  hrefFor={(page) => hrefWith({ page })}
                />
              </div>
              </>
            )}
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-2xl font-bold">
                    Test reytingi
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Testni tanlab TOP
                    natijalarni köring
                  </p>
                </div>

                {rankingTests.length >
                  0 && (
                  <form
                    method="get"
                    className="flex gap-2"
                  >
                    {/* Umumiy reyting sahifasi saqlansin */}
                    {overallPage > 1 && (
                      <input
                        type="hidden"
                        name="page"
                        value={overallPage}
                      />
                    )}

                    <select
                      name="testId"
                      aria-label="Testni tanlang"
                      defaultValue={
                        selectedTest
                          ? toNumber(
                              selectedTest.test_id,
                            )
                          : undefined
                      }
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-mb-brand sm:w-56"
                    >
                      {rankingTests.map(
                        (test) => (
                          <option
                            key={
                              test.test_id
                            }
                            value={
                              test.test_id
                            }
                          >
                            {test.title}
                          </option>
                        ),
                      )}
                    </select>

                    <button
                      type="submit"
                      className="min-h-11 rounded-xl bg-mb-brand px-4 py-2 text-sm font-bold text-white hover:bg-mb-brandDark"
                    >
                      Köriş
                    </button>
                  </form>
                )}
              </div>
            </div>

            {!selectedTest ? (
              <div className="px-5 py-14 text-center">
                <p className="font-bold text-slate-800">
                  Faol reyting testi
                  yöq
                </p>
              </div>
            ) : testRows.length ===
              0 ? (
              <div className="px-5 py-14 text-center">
                <p className="font-bold text-slate-800">
                  {selectedTest.title}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Bu testni hali heç
                  kim tugatmagan.
                </p>
              </div>
            ) : (
              <>
                {currentTestStatistics &&
                  toNumber(
                    currentTestStatistics
                      .test_rank,
                  ) > 0 && (
                    <div className="border-b border-blue-200 bg-blue-50 px-5 py-4 sm:px-6">
                      <p className="text-sm font-bold text-blue-700">
                        Siz:{" "}
                        {formatNumber(
                          currentTestStatistics
                            .test_rank,
                        )}
                        -örin ·{" "}
                        {formatNumber(
                          currentTestStatistics
                            .best_percentage,
                        )}
                        % ·{" "}
                        {formatDuration(
                          currentTestStatistics
                            .best_duration_seconds,
                        )}
                      </p>
                    </div>
                  )}

                {/* Mobil: jadval o‘rniga karta ro‘yxati */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {testRows.map((row) => {
                    const rank = toNumber(
                      row.test_rank,
                    );

                    const isCurrentUser =
                      row.user_id === user.id;

                    return (
                      <div
                        key={row.user_id}
                        className={
                          isCurrentUser
                            ? "flex items-center gap-3 bg-blue-50 px-4 py-3"
                            : "flex items-center gap-3 px-4 py-3"
                        }
                      >
                        <Medal rank={rank} />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-950">
                            {row.full_name}
                            {isCurrentUser && (
                              <span className="ml-2 inline-flex rounded-full bg-mb-brand px-2 py-0.5 text-[10px] font-bold text-white">
                                Siz
                              </span>
                            )}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            <span className="font-mono tabular-nums">
                              {formatDuration(
                                row.duration_seconds,
                              )}
                            </span>{" "}
                            ·{" "}
                            {formatNumber(
                              row.attempts_count,
                            )}{" "}
                            uriniş ·{" "}
                            {formatDate(
                              row.completed_at,
                            )}
                          </p>
                        </div>

                        <p className="shrink-0 text-base font-bold text-emerald-700">
                          {formatNumber(
                            row.percentage,
                          )}
                          %
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[680px] text-left">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-4 font-bold">
                          Örin
                        </th>

                        <th className="px-5 py-4 font-bold">
                          Öquvçi
                        </th>

                        <th className="px-5 py-4 text-center font-bold">
                          Foiz
                        </th>

                        <th className="px-5 py-4 text-center font-bold">
                          Vaqt
                        </th>

                        <th className="px-5 py-4 text-center font-bold">
                          Uriniş
                        </th>

                        <th className="px-5 py-4 text-right font-bold">
                          Sana
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {testRows.map(
                        (row) => {
                          const rank =
                            toNumber(
                              row.test_rank,
                            );

                          return (
                            <tr
                              key={row.user_id}
                              className={
                                row.user_id ===
                                user.id
                                  ? "bg-blue-50"
                                  : "hover:bg-slate-50"
                              }
                            >
                              <td className="px-5 py-4">
                                <Medal
                                  rank={rank}
                                />
                              </td>

                              <td className="px-5 py-4">
                                <p className="font-bold text-slate-950">
                                  {
                                    row.full_name
                                  }
                                </p>

                                {row.user_id ===
                                  user.id && (
                                  <span className="mt-1 inline-flex rounded-full bg-mb-brand px-2.5 py-1 text-[10px] font-bold text-white">
                                    Siz
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-4 text-center text-lg font-bold text-emerald-700">
                                {formatNumber(
                                  row.percentage,
                                )}
                                %
                              </td>

                              <td className="px-5 py-4 text-center font-mono font-bold tabular-nums text-slate-700">
                                {formatDuration(
                                  row.duration_seconds,
                                )}
                              </td>

                              <td className="px-5 py-4 text-center font-bold text-blue-700">
                                {formatNumber(
                                  row.attempts_count,
                                )}
                              </td>

                              <td className="px-5 py-4 text-right text-xs font-medium text-slate-500">
                                {formatDate(
                                  row.completed_at,
                                )}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 pb-5 sm:px-6">
                  <Pagination
                    currentPage={testPage}
                    totalPages={testTotalPages}
                    totalItems={testTotal}
                    pageSize={LEADERBOARD_PAGE_SIZE}
                    hrefFor={(page) =>
                      hrefWith({ testPage: page })
                    }
                  />
                </div>
              </>
            )}
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-blue-950">
            Reyting qoidasi
          </h2>

          <p className="mt-2 text-sm leading-6 text-blue-900">
            Har bir testda faqat
            eng yaxşi uriniş
            olinadi. Teng foizda
            testni tezroq tugatgan
            öquvçi yuqorida
            turadi. Umumiy
            reytingda barça
            reyting testlaridagi
            eng yaxşi foizlar
            qöşiladi.
          </p>

          <p className="mt-2 text-sm font-bold leading-6 text-blue-950">
            Dars testlari reytingga
            mutlaqo qöşilmaydi.
          </p>
        </section>
      </section>
    </main>
  );
}
