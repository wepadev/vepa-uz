import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { ChevronDown, Play } from "@/components/ui/icons";
import { Tag } from "@/components/ui/row";
import { btnGhost } from "@/lib/ui";
import { cn } from "@/lib/utils";
import Pagination from "@/components/ui/pagination";
import { formatDate, getSingleValue, toNumber } from "@/lib/stats-format";
import type {
  RankingTestRpcRow,
  UserSummaryRpcRow,
  UserTestStatisticsRpcRow,
} from "@/lib/stats-types";
import PageHeader, { headerButton } from "@/components/ui/page-header";
import AutoSubmitSelect from "@/components/auto-submit-select";
import {
  loadRankingTestGroups,
  topicLabel,
  type RankingTopicGroup,
} from "@/lib/ranking-test-groups";

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
    tab?: string | string[];
    topic?: string | string[];
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

/**
 * Örin plitkasi. Emoji medallar olib taşlandi: ular telefonlarda har
 * xil çiqardi va sahifadagi yagona rangli narsa bölib qolardi. Endi
 * 1-örin — sariq urğu, 2–3-örin — oçiq kök, qolganlari kulrang.
 */
function Rank({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "num grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold",
        rank === 1
          ? "bg-vp-accent text-vp-on-accent"
          : rank <= 3
            ? "bg-mb-tint text-mb-brandDark"
            : "bg-slate-100 text-slate-600",
      )}
      aria-label={`${rank}-örin`}
    >
      {rank}
    </span>
  );
}

function initialOf(name: string | null | undefined) {
  return (name ?? "").trim().charAt(0).toUpperCase() || "?";
}

/** Sahifa manzildagi raqam — noto'g'ri qiymatda 1 */
function readPage(value: string | string[] | undefined) {
  const number = Number(getSingleValue(value));

  return Number.isInteger(number) && number > 0 ? number : 1;
}

/** Ketma-ket kelgan bir bölim mavzularini `<optgroup>` ga yiğadi */
function bySection(groups: RankingTopicGroup[]) {
  const result: { section: string; groups: RankingTopicGroup[] }[] = [];

  for (const group of groups) {
    const last = result[result.length - 1];

    if (last && last.section === group.section) {
      last.groups.push(group);
    } else {
      result.push({ section: group.section, groups: [group] });
    }
  }

  return result;
}

type Tab = "overall" | "test";

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const rawTab = getSingleValue(params.tab);
  const rawTestId = getSingleValue(params.testId);
  const rawTopic = getSingleValue(params.topic);

  /*
   * Eski havolalar (`?testId=12`) ham test böyiça reytingni oçsin.
   */
  const tab: Tab =
    rawTab === "test" || (rawTab !== "umumiy" && (rawTestId || rawTopic))
      ? "test"
      : "overall";

  const overallPage = readPage(params.page);
  const testPage = readPage(params.testPage);

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: currentProfileData, error: currentProfileError } =
    await supabase
      .from("profiles")
      .select("full_name, role, is_active")
      .eq("id", user.id)
      .single();

  if (
    currentProfileError ||
    !currentProfileData ||
    currentProfileData.is_active !== true
  ) {
    redirect("/");
  }

  const currentProfile = currentProfileData as CurrentProfileRow;

  const [summaryResult, overallResult, rankingTestsResult] = await Promise.all([
    supabase.rpc("get_user_ranking_summary", { p_user_id: null }),

    tab === "overall"
      ? supabase.rpc("get_overall_leaderboard", {
          p_limit: LEADERBOARD_PAGE_SIZE,
          p_offset: (overallPage - 1) * LEADERBOARD_PAGE_SIZE,
        })
      : null,

    tab === "test" ? supabase.rpc("get_ranking_tests") : null,
  ]);

  if (summaryResult.error) {
    throw new Error(
      `Şaxsiy reyting yuklanmadi: ${summaryResult.error.message}`,
    );
  }

  if (overallResult?.error) {
    throw new Error(
      `Umumiy reyting yuklanmadi: ${overallResult.error.message}`,
    );
  }

  if (rankingTestsResult?.error) {
    throw new Error(
      `Reyting testlari yuklanmadi: ${rankingTestsResult.error.message}`,
    );
  }

  const currentSummary = (summaryResult.data ?? [])[0] as
    | UserSummaryRpcRow
    | undefined;

  const overallRows = (overallResult?.data ?? []) as OverallRpcRow[];

  const rankingTests = (rankingTestsResult?.data ??
    []) as RankingTestRpcRow[];

  /* ---------------- Test böyiça: mavzu va test tanlaş ---------------- */

  const groups =
    tab === "test" ? await loadRankingTestGroups(supabase, rankingTests) : [];

  const requestedTestId = Number(rawTestId);

  /*
   * Mavzu almaşsa (`topic` kelsa) — şu mavzuning birinçi testi.
   * Faqat test tanlansa — şu test va uning mavzusi.
   */
  const selectedGroup =
    (rawTopic && groups.find((group) => group.key === rawTopic)) ||
    groups.find((group) =>
      group.tests.some((test) => test.id === requestedTestId),
    ) ||
    groups[0] ||
    null;

  const selectedTest =
    selectedGroup?.tests.find((test) => test.id === requestedTestId) ??
    selectedGroup?.tests[0] ??
    null;

  let testRows: TestLeaderboardRpcRow[] = [];
  let currentTestStatistics: UserTestStatisticsRpcRow | null = null;

  if (selectedTest) {
    const [testLeaderboardResult, userTestResult] = await Promise.all([
      supabase.rpc("get_test_leaderboard", {
        p_test_id: selectedTest.id,
        p_limit: LEADERBOARD_PAGE_SIZE,
        p_offset: (testPage - 1) * LEADERBOARD_PAGE_SIZE,
      }),

      supabase.rpc("get_user_test_statistics", {
        p_user_id: null,
        p_test_id: selectedTest.id,
      }),
    ]);

    if (testLeaderboardResult.error) {
      throw new Error(
        `Test reytingi yuklanmadi: ${testLeaderboardResult.error.message}`,
      );
    }

    if (userTestResult.error) {
      throw new Error(
        `Test statistikangiz yuklanmadi: ${userTestResult.error.message}`,
      );
    }

    testRows = (testLeaderboardResult.data ?? []) as TestLeaderboardRpcRow[];

    currentTestStatistics =
      ((userTestResult.data ?? []) as UserTestStatisticsRpcRow[])[0] ?? null;
  }

  /** Sahifa manzili — tanlangan bölim, test va sahifa saqlanadi */
  function hrefWith(overrides: {
    tab?: Tab;
    testId?: number;
    page?: number;
    testPage?: number;
  }) {
    const search = new URLSearchParams();
    const nextTab = overrides.tab ?? tab;

    if (nextTab === "test") {
      search.set("tab", "test");

      const testId = overrides.testId ?? selectedTest?.id;
      if (testId) search.set("testId", String(testId));

      const nextTestPage =
        overrides.testPage ?? (overrides.testId ? 1 : testPage);
      if (nextTestPage > 1) search.set("testPage", String(nextTestPage));
    } else {
      const nextPage = overrides.page ?? (overrides.tab ? 1 : overallPage);
      if (nextPage > 1) search.set("page", String(nextPage));
    }

    const text = search.toString();

    return text ? `/leaderboard?${text}` : "/leaderboard";
  }

  /*
   * Jami qatnashchilar soni har bir qatorda qaytadi. Sahifa bo'sh
   * bo'lsa (masalan qo'lda katta raqam yozilsa) sahifalash yashiriladi.
   */
  const overallTotal = toNumber(overallRows[0]?.participants);
  const overallTotalPages = Math.max(
    1,
    Math.ceil(overallTotal / LEADERBOARD_PAGE_SIZE),
  );

  const testTotal = toNumber(testRows[0]?.participants);
  const testTotalPages = Math.max(
    1,
    Math.ceil(testTotal / LEADERBOARD_PAGE_SIZE),
  );

  const participants =
    toNumber(currentSummary?.overall_participants) || overallTotal;

  const isAdmin = currentProfile.role === "admin";
  const isRanked = Boolean(currentSummary?.is_ranked);

  /* Şohsupa faqat birinçi sahifada — ular umumiy TOP 3 */
  const topThree = overallPage === 1 ? overallRows.slice(0, 3) : [];
  const showPodium = topThree.length === 3;
  const listRows = showPodium ? overallRows.slice(3) : overallRows;

  /* Şohsupa tartibi: 2 — 1 — 3 */
  const podium = showPodium
    ? [
        { row: topThree[1], height: "h-16", tone: "bg-mb-tint text-mb-brandDark" },
        { row: topThree[0], height: "h-24", tone: "bg-vp-accent text-vp-on-accent" },
        { row: topThree[2], height: "h-12", tone: "bg-mb-tint text-mb-brandDark" },
      ]
    : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "overall", label: "Umumiy" },
    { id: "test", label: "Test böyiça" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        glyph="ranking"
        title="Reyting"
        subtitle={
          participants > 0 ? `${formatNumber(participants)} öquvçi` : undefined
        }
        action={
          <Link href="/results" className={headerButton}>
            Natijalarim
          </Link>
        }
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* 1. Holat — sizning örningiz (sahifadagi yagona kök karta) */}
        {isAdmin ? (
          <p className="rounded-2xl border border-mb-line bg-white px-4 py-3 text-sm text-mb-muted">
            Admin hisobi reytingga kirmaydi.
          </p>
        ) : isRanked ? (
          <div className="spotlight rounded-2xl p-5 sm:p-6">
            <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div>
                <p className="eyebrow !text-white/80">Sizning örningiz</p>

                <p className="num mt-1 text-5xl font-extrabold leading-none">
                  {formatNumber(currentSummary?.overall_rank)}
                  <span className="text-2xl font-bold">-örin</span>
                </p>

                <p className="num mt-2 text-sm text-white/80">
                  {formatNumber(currentSummary?.overall_participants)} öquvçi
                  içida
                </p>
              </div>

              <dl className="num grid grid-cols-3 gap-2 text-center">
                {[
                  ["Ball", formatNumber(currentSummary?.rating_points)],
                  ["Test", formatNumber(currentSummary?.tests_completed)],
                  ["90%+", formatNumber(currentSummary?.excellent_tests)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-[76px] rounded-xl bg-white/10 px-3 py-2.5"
                  >
                    <dt className="text-xs font-semibold text-white/80">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-lg font-extrabold">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : (
          <div className="spotlight rounded-2xl p-5 sm:p-6">
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow !text-white/80">Sizning örningiz</p>

                <p className="mt-1 text-2xl font-extrabold leading-tight">
                  Hali reytingda emassiz
                </p>

                <p className="mt-1.5 max-w-md text-sm leading-5 text-white/80">
                  Bitta test işlang — örningiz şu yerda çiqadi.
                </p>
              </div>

              <Link
                href="/tests"
                className="press inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-blue-700 shadow-[inset_0_-3px_0_rgb(3_22_80/0.14)]"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Test işlaş
              </Link>
            </div>
          </div>
        )}

        {/* 2. Qaysi reyting — ikki bölim, bir vaqtda bittasi */}
        <nav
          aria-label="Reyting turi"
          className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-mb-line bg-white p-1"
        >
          {tabs.map((item) => {
            const active = item.id === tab;

            return (
              <Link
                key={item.id}
                href={hrefWith({ tab: item.id })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press grid min-h-11 place-items-center rounded-xl text-sm font-bold transition-colors",
                  active
                    ? "bg-mb-brand text-white"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 3. Röyxat */}
        {tab === "overall" ? (
          <>
            {showPodium && (
              <div className="mt-4 rounded-2xl border border-mb-line bg-white px-3 pt-5 sm:px-6">
                <p className="eyebrow text-center">Eng yuqori uç örin</p>

                <ol className="mx-auto mt-4 grid max-w-lg grid-cols-3 items-end gap-2 sm:gap-4">
                  {podium.map(({ row, height, tone }) => {
                    const rank = toNumber(row.overall_rank);
                    const isCurrentUser = row.user_id === user.id;

                    return (
                      <li
                        key={row.user_id}
                        className="flex min-w-0 flex-col items-center text-center"
                      >
                        <span
                          className={cn(
                            "grid place-items-center rounded-full bg-slate-100 font-extrabold text-slate-700",
                            rank === 1
                              ? "h-16 w-16 text-2xl ring-4 ring-vp-accent"
                              : "h-12 w-12 text-lg ring-2 ring-mb-tint",
                            isCurrentUser && "bg-mb-brand text-white",
                          )}
                          aria-hidden="true"
                        >
                          {initialOf(row.full_name)}
                        </span>

                        <p className="mt-2 line-clamp-2 w-full break-words text-[13px] font-bold leading-4 text-mb-ink sm:text-sm">
                          {row.full_name}
                        </p>

                        <p className="num mt-0.5 text-[13px] font-semibold text-mb-muted">
                          {formatNumber(row.rating_points)} ball
                        </p>

                        <span
                          className={cn(
                            "num mt-2 grid w-full place-items-center rounded-t-xl text-2xl font-extrabold",
                            height,
                            tone,
                          )}
                        >
                          {rank}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            <section className="mt-4 overflow-hidden rounded-2xl border border-mb-line bg-white">
              <div className="border-b border-mb-line px-4 py-3.5 sm:px-5">
                <h2 className="text-lg font-bold text-mb-ink">Umumiy reyting</h2>

                <p className="mt-0.5 text-sm text-mb-muted">
                  Hamma reyting testlaridagi foizlar yiğindisi
                </p>
              </div>

              {overallRows.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-mb-muted">
                  Hozirça reyting natijasi yöq.
                </p>
              ) : (
                <>
                  {listRows.length > 0 && (
                    <ol className="divide-y divide-mb-line">
                      {listRows.map((row) => {
                        const isCurrentUser = row.user_id === user.id;

                        return (
                          <li
                            key={row.user_id}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 sm:px-5",
                              isCurrentUser && "bg-mb-tintSoft",
                            )}
                          >
                            <Rank rank={toNumber(row.overall_rank)} />

                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 text-[15px] font-bold text-mb-ink">
                                <span className="truncate">{row.full_name}</span>
                                {isCurrentUser && <Tag tone="brand">Siz</Tag>}
                              </p>

                              <p className="num mt-0.5 text-[13px] text-mb-muted">
                                {formatNumber(row.tests_completed)} test ·{" "}
                                {formatNumber(row.average_percentage)}% örtaça
                              </p>
                            </div>

                            <p className="num shrink-0 text-right text-base font-extrabold text-mb-ink">
                              {formatNumber(row.rating_points)}
                              <span className="ml-1 text-xs font-semibold text-mb-muted">
                                ball
                              </span>
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  <div className="px-4 pb-4 sm:px-5">
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
          </>
        ) : groups.length === 0 || !selectedGroup ? (
          <p className="mt-4 rounded-2xl border border-mb-line bg-white px-5 py-12 text-center text-sm text-mb-muted">
            Hozirça reyting testi yöq.
          </p>
        ) : (
          <>
            {/* Mavzu, keyin uning testi */}
            <div className="mt-4 rounded-2xl border border-mb-line bg-white p-4 sm:p-5">
              <form method="get" className="flex gap-2">
                <input type="hidden" name="tab" value="test" />

                <label className="min-w-0 flex-1">
                  <span className="eyebrow">Mavzu</span>

                  <AutoSubmitSelect
                    name="topic"
                    defaultValue={selectedGroup.key}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-mb-ink outline-none focus:border-mb-brand"
                  >
                    {bySection(groups).map((section) => (
                      <optgroup key={section.section} label={section.section}>
                        {section.groups.map((group) => (
                          <option key={group.key} value={group.key}>
                            {topicLabel(group)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </AutoSubmitSelect>
                </label>

                <noscript>
                  <button type="submit" className={cn(btnGhost, "mt-6")}>
                    Köriş
                  </button>
                </noscript>
              </form>

              {selectedGroup.tests.length > 1 && (
                <div
                  role="list"
                  aria-label="Testlar"
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {selectedGroup.tests.map((test) => {
                    const active = test.id === selectedTest?.id;

                    return (
                      <Link
                        key={test.id}
                        role="listitem"
                        href={hrefWith({ testId: test.id })}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "press inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-bold",
                          active
                            ? "border-mb-brand bg-mb-brand text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        {test.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedTest && (
              <section className="mt-4 overflow-hidden rounded-2xl border border-mb-line bg-white">
                <div className="border-b border-mb-line px-4 py-3.5 sm:px-5">
                  <p className="eyebrow truncate">{selectedGroup.section}</p>

                  <h2 className="mt-1 text-lg font-bold leading-snug text-mb-ink">
                    {topicLabel(selectedGroup)}
                    <span className="text-mb-muted"> · {selectedTest.title}</span>
                  </h2>

                  <p className="num mt-0.5 text-sm text-mb-muted">
                    {formatNumber(testTotal || selectedTest.participants)}{" "}
                    qatnaşçi
                  </p>
                </div>

                {testRows.length === 0 ? (
                  <p className="px-5 py-12 text-center text-sm text-mb-muted">
                    Bu testni hali heç kim tugatmagan.
                  </p>
                ) : (
                  <>
                    {currentTestStatistics &&
                      toNumber(currentTestStatistics.test_rank) > 0 && (
                        <p className="num border-b border-mb-line bg-mb-tintSoft px-4 py-3 text-sm font-semibold text-mb-brandDark sm:px-5">
                          Siz: {formatNumber(currentTestStatistics.test_rank)}
                          -örin ·{" "}
                          {formatNumber(currentTestStatistics.best_percentage)}% ·{" "}
                          {formatDuration(
                            currentTestStatistics.best_duration_seconds,
                          )}
                        </p>
                      )}

                    <ol className="divide-y divide-mb-line">
                      {testRows.map((row) => {
                        const isCurrentUser = row.user_id === user.id;

                        return (
                          <li
                            key={row.user_id}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 sm:px-5",
                              isCurrentUser && "bg-mb-tintSoft",
                            )}
                          >
                            <Rank rank={toNumber(row.test_rank)} />

                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 text-[15px] font-bold text-mb-ink">
                                <span className="truncate">{row.full_name}</span>
                                {isCurrentUser && <Tag tone="brand">Siz</Tag>}
                              </p>

                              <p className="num mt-0.5 truncate text-[13px] text-mb-muted">
                                {formatDuration(row.duration_seconds)} ·{" "}
                                {formatNumber(row.attempts_count)} uriniş
                                <span className="hidden sm:inline">
                                  {" "}
                                  · {formatDate(row.completed_at)}
                                </span>
                              </p>
                            </div>

                            <p
                              className={cn(
                                "num shrink-0 text-base font-extrabold",
                                toNumber(row.percentage) >= 90
                                  ? "text-vp-success"
                                  : "text-mb-ink",
                              )}
                            >
                              {formatNumber(row.percentage)}%
                            </p>
                          </li>
                        );
                      })}
                    </ol>

                    <div className="px-4 pb-4 sm:px-5">
                      <Pagination
                        currentPage={testPage}
                        totalPages={testTotalPages}
                        totalItems={testTotal}
                        pageSize={LEADERBOARD_PAGE_SIZE}
                        hrefFor={(page) => hrefWith({ testPage: page })}
                      />
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}

        <details className="group mt-6 rounded-2xl border border-mb-line bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-bold text-mb-ink sm:px-5 [&::-webkit-details-marker]:hidden">
            Reyting qanday hisoblanadi?
            <ChevronDown
              className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>

          <div className="border-t border-mb-line px-4 py-3.5 text-sm leading-6 text-slate-700 sm:px-5">
            <p>
              Har bir testda faqat eng yaxşi uriniş olinadi. Teng foizda
              testni tezroq tugatgan öquvçi yuqorida turadi. Umumiy reytingda
              barça reyting testlaridagi eng yaxşi foizlar qöşiladi.
            </p>

            <p className="mt-2 font-semibold text-mb-ink">
              Dars testlari reytingga qöşilmaydi.
            </p>
          </div>
        </details>
      </section>
    </main>
  );
}
