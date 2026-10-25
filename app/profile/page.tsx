import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import ProfileForm from "@/components/profile-form";
import {
  buildLessonTestMap,
  isLessonPassed,
} from "@/lib/lesson-progress";
import { createClient } from "@/lib/supabase/server";
import { formatDate, toNumber } from "@/lib/stats-format";
import type {
  RankingTestRpcRow,
  UserSummaryRpcRow,
  UserTestStatisticsRpcRow,
} from "@/lib/stats-types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profil",
  description:
    "Shaxsiy ma’lumotlar, obuna holati va yutuqlar.",
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  auth_provider: string | null;
  can_access_textbooks: boolean;
  can_access_lessons: boolean;
  can_access_tests: boolean;
  premium_until: string | null;
};

type PremiumEntitlementRow = {
  expires_at: string;
  revoked_at: string | null;
  payment_plans:
    | {
        name: string;
        code: string;
        duration_months: number;
      }
    | Array<{
        name: string;
        code: string;
        duration_months: number;
      }>
    | null;
};

type LessonRow = {
  id: number;
};

type LessonTestRow = {
  lesson_id: number;
  test_id: number;
};

type RecentAttemptRow = {
  id: string;
  test_id: number;
  score: number;
  total_questions: number;
  percentage: number | string;
  started_at: string;
  completed_at: string | null;
};

type LessonAttemptRow = {
  test_id: number;
  percentage: number | string;
};

function formatPercentage(
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
  if (value === null || value === undefined) {
    return "—";
  }

  const totalSeconds = Math.max(
    0,
    Math.floor(toNumber(value)),
  );

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

export default async function ProfilePage() {
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
      id,
      full_name,
      role,
      is_active,
      auth_provider,
      can_access_textbooks,
      can_access_lessons,
      can_access_tests,
      premium_until
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

  const provider =
    profile.auth_provider === "google"
      ? "google"
      : "email";

  const fullName =
    profile.full_name?.trim() ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Oʼquvchi";

  const [
    summaryResult,
    testStatisticsResult,
    rankingTestsResult,
    lessonsResult,
    lessonProgressResult,
    premiumEntitlementResult,
  ] = await Promise.all([
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

    supabase.rpc(
      "get_ranking_tests",
    ),

    supabase
      .from("lessons")
      .select(`
        id
      `)
      .eq("is_published", true)
      .order("order_number", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      }),

    supabase
      .from("lesson_tests")
      .select("lesson_id, test_id"),

    (
      // Bu jadval Supabase tiplarida yo'q
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any
    )
      .from("premium_entitlements")
      .select(`
        expires_at,
        revoked_at,
        payment_plans (
          name,
          code,
          duration_months
        )
      `)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),
  ]);

  if (summaryResult.error) {
    throw new Error(
      `Shaxsiy reyting yuklanmadi: ${summaryResult.error.message}`,
    );
  }

  if (testStatisticsResult.error) {
    throw new Error(
      `Test reytinglari yuklanmadi: ${testStatisticsResult.error.message}`,
    );
  }

  if (rankingTestsResult.error) {
    throw new Error(
      `Reyting testlari yuklanmadi: ${rankingTestsResult.error.message}`,
    );
  }

  if (lessonsResult.error) {
    throw new Error(
      `Darslar yuklanmadi: ${lessonsResult.error.message}`,
    );
  }

  if (lessonProgressResult.error) {
    throw new Error(
      `Dars testlari yuklanmadi: ${lessonProgressResult.error.message}`,
    );
  }

  if (premiumEntitlementResult.error) {
    throw new Error(
      `Premium tarixi yuklanmadi: ${premiumEntitlementResult.error.message}`,
    );
  }

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

  const rankingTests =
    (
      rankingTestsResult.data ??
      []
    ) as RankingTestRpcRow[];

  const lessons =
    (
      lessonsResult.data ??
      []
    ) as LessonRow[];

  const lessonProgress =
    (
      lessonProgressResult.data ??
      []
    ) as LessonTestRow[];

  const rankingTestIds =
    rankingTests.map(
      (test) =>
        toNumber(test.test_id),
    );

  const rankingTestTitleMap =
    new Map(
      rankingTests.map((test) => [
        toNumber(test.test_id),
        test.title,
      ]),
    );

  const lessonTestIds = [
    ...new Set(lessonProgress.map((row) => row.test_id)),
  ];

  let recentAttempts:
    RecentAttemptRow[] = [];

  let lessonAttempts:
    LessonAttemptRow[] = [];

  const [
    recentAttemptsResult,
    lessonAttemptsResult,
  ] = await Promise.all([
    rankingTestIds.length > 0
      ? supabase
          .from("attempts")
          .select(`
            id,
            test_id,
            score,
            total_questions,
            percentage,
            started_at,
            completed_at
          `)
          .eq("user_id", user.id)
          .not(
            "completed_at",
            "is",
            null,
          )
          .in(
            "test_id",
            rankingTestIds,
          )
          .order("completed_at", {
            ascending: false,
          })
          .limit(6)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    lessonTestIds.length > 0
      ? supabase
          .from("attempts")
          .select(`
            test_id,
            percentage
          `)
          .eq("user_id", user.id)
          .not(
            "completed_at",
            "is",
            null,
          )
          .in(
            "test_id",
            lessonTestIds,
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (recentAttemptsResult.error) {
    throw new Error(
      `Soʼnggi natijalar yuklanmadi: ${recentAttemptsResult.error.message}`,
    );
  }

  if (lessonAttemptsResult.error) {
    throw new Error(
      `Dars testlari yuklanmadi: ${lessonAttemptsResult.error.message}`,
    );
  }

  recentAttempts =
    (
      recentAttemptsResult.data ??
      []
    ) as RecentAttemptRow[];

  lessonAttempts =
    (
      lessonAttemptsResult.data ??
      []
    ) as LessonAttemptRow[];

  const testRankingRows =
    testStatistics
      .filter(
        (row) =>
          Boolean(
            row.best_attempt_id,
          ),
      )
      .sort(
        (first, second) =>
          toNumber(
            second.best_percentage,
          ) -
            toNumber(
              first.best_percentage,
            ) ||
          first.title.localeCompare(
            second.title,
            "uz",
          ),
      );

  const lessonBestScoreMap =
    new Map<number, number>();

  for (const attempt of lessonAttempts) {
    lessonBestScoreMap.set(
      attempt.test_id,
      Math.max(
        lessonBestScoreMap.get(
          attempt.test_id,
        ) ?? 0,
        toNumber(
          attempt.percentage,
        ),
      ),
    );
  }

  const testsByLesson = buildLessonTestMap(lessonProgress);

  const completedLessons = lessons.filter((lesson) =>
    isLessonPassed(
      testsByLesson.get(lesson.id) ?? [],
      lessonBestScoreMap,
    ),
  ).length;

  const lessonPercentage =
    lessons.length > 0
      ? Math.round(
          (completedLessons /
            lessons.length) *
            100,
        )
      : 0;

  const isAdmin =
    profile.role === "admin";

  const isRanked =
    Boolean(summary?.is_ranked);

  const rankingTestsTotal =
    toNumber(
      summary?.ranking_tests_total,
    );

  const testsCompleted =
    toNumber(
      summary?.tests_completed,
    );

  const overallRank =
    toNumber(
      summary?.overall_rank,
    );

  const overallParticipants =
    toNumber(
      summary?.overall_participants,
    );

  const ratingPoints =
    toNumber(
      summary?.rating_points,
    );

  const averagePercentage =
    toNumber(
      summary?.average_percentage,
    );

  const highestPercentage =
    toNumber(
      summary?.highest_percentage,
    );

  const excellentTests =
    toNumber(
      summary?.excellent_tests,
    );

  const maximumRatingPoints =
    rankingTestsTotal * 100;


const premiumTimestamp =
  profile.premium_until
    ? new Date(
        profile.premium_until,
      ).getTime()
    : 0;

const hasPremium =
  isAdmin ||
  (
    Number.isFinite(
      premiumTimestamp,
    ) &&
    premiumTimestamp >
      Date.now()
  );

const premiumDaysRemaining =
  hasPremium && !isAdmin
    ? Math.max(
        1,
        Math.ceil(
          (
            premiumTimestamp -
            Date.now()
          ) /
            86400000,
        ),
      )
    : 0;

const latestEntitlement =
  premiumEntitlementResult.data as
    | PremiumEntitlementRow
    | null;

const latestPlan =
  latestEntitlement
    ? (
        Array.isArray(
          latestEntitlement
            .payment_plans,
        )
          ? latestEntitlement
              .payment_plans[0]
          : latestEntitlement
              .payment_plans
      )
    : null;

  /* Avatar uchun bosh harflar */
  const initials = String(fullName)
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← Bosh sahifa
            </Link>

            <p className="truncate text-lg font-bold sm:text-xl">
              Profilim
            </p>
          </div>

          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
        {/* Kim ekaningiz va o'rningiz */}
        <div className="relative overflow-hidden rounded-3xl bg-mb-brand p-5 text-white shadow-lg sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10"
          />

          <div className="relative flex flex-wrap items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-xl font-bold ring-1 ring-white/25 sm:h-20 sm:w-20 sm:text-2xl">
              {initials || "O"}
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold sm:text-2xl">
                {fullName}
              </h1>

              <p className="mt-0.5 truncate text-sm text-blue-100">
                {user.email ?? "Email ko‘rsatilmagan"}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/20">
                  {isAdmin
                    ? "Administrator"
                    : hasPremium
                      ? "Premium"
                      : "Bepul tarif"}
                </span>

                {!isAdmin && isRanked && (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/20">
                    Reytingda {overallRank}-o‘rin
                    <span className="font-medium text-blue-100">
                      {" "}
                      / {overallParticipants}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tarif */}
        <div
          className={
            hasPremium
              ? "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
              : "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mb-line bg-white p-4 shadow-sm"
          }
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-mb-ink">
              {isAdmin
                ? "Barcha materiallar ochiq"
                : hasPremium
                  ? latestPlan?.name ?? "Premium tarif"
                  : "3 ta dars va 3 ta test bepul"}
            </p>

            <p className="mt-0.5 text-sm text-mb-muted">
              {isAdmin
                ? "Admin hisobida muddat talab qilinmaydi."
                : hasPremium
                  ? `${formatDate(profile.premium_until)} gacha · ${premiumDaysRemaining} kun qoldi`
                  : "Qolgan dars va testlarni Premium ochadi."}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            {!isAdmin && (
              <Link
                href="/pricing"
                className={
                  hasPremium
                    ? "inline-flex min-h-11 items-center rounded-xl bg-amber-500 px-4 text-sm font-bold text-white hover:bg-amber-600"
                    : "inline-flex min-h-11 items-center rounded-xl bg-mb-brand px-4 text-sm font-bold text-white hover:bg-mb-brandDark"
                }
              >
                {hasPremium ? "Uzaytirish" : "Premium olish"}
              </Link>
            )}

            <Link
              href="/profile/payments"
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              To‘lovlarim
            </Link>
          </div>
        </div>

        {/* Statistika */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {[
            {
              label: "Ishlangan test",
              value: String(testsCompleted),
              hint: `${rankingTestsTotal} tadan`,
              tone: "text-blue-600",
            },
            {
              label: "O‘rtacha",
              value: `${formatPercentage(averagePercentage)}%`,
              hint: "eng yaxshi natijalar",
              tone: "text-blue-600",
            },
            {
              label: "Eng yuqori",
              value: `${formatPercentage(highestPercentage)}%`,
              hint: `${excellentTests} ta test 90%+`,
              tone: "text-emerald-600",
            },
            {
              label: "Reyting bali",
              value: formatPercentage(ratingPoints),
              hint: `maksimal ${maximumRatingPoints}`,
              tone: "text-red-600",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-mb-line bg-white px-3 py-3 text-center shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mb-muted">
                {card.label}
              </p>

              <p className={`mt-1 text-2xl font-bold ${card.tone}`}>
                {card.value}
              </p>

              <p className="mt-0.5 text-[11px] text-mb-muted">
                {card.hint}
              </p>
            </div>
          ))}
        </div>

        {/* Darslar progressi */}
        <div className="mt-4 rounded-2xl border border-mb-line bg-white p-4 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-mb-ink">
                Darslar progressi
              </p>

              <p className="mt-0.5 text-sm text-mb-muted">
                {completedLessons} / {lessons.length} dars tugallangan
              </p>
            </div>

            <Link
              href="/lessons"
              className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
            >
              Davom etish
            </Link>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${lessonPercentage}%` }}
            />
          </div>
        </div>

        {/* Testlar bo'yicha o'rin */}
        <h2 className="mt-7 text-lg font-bold">Testlardagi o‘rningiz</h2>

        {testRankingRows.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
            <p className="font-bold text-slate-800">
              Hali reyting natijasi yo‘q
            </p>

            <Link
              href="/tests"
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-mb-brand px-5 text-sm font-bold text-white hover:bg-mb-brandDark"
            >
              Test ishlash
            </Link>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
            {testRankingRows.map((row, index) => (
              <div
                key={row.test_id}
                className={
                  index > 0
                    ? "flex flex-wrap items-center gap-3 border-t border-mb-line px-4 py-3"
                    : "flex flex-wrap items-center gap-3 px-4 py-3"
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-mb-ink">
                    {row.title}
                  </p>

                  <p className="mt-0.5 text-xs text-mb-muted">
                    {formatPercentage(row.attempts_count)} urinish ·
                    eng yaxshi vaqt{" "}
                    {formatDuration(row.best_duration_seconds)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-xl bg-emerald-50 px-2.5 py-1.5 text-sm font-bold text-emerald-700">
                    {formatPercentage(row.best_percentage)}%
                  </span>

                  <span className="rounded-xl bg-mb-tintSoft px-2.5 py-1.5 text-sm font-bold text-mb-brand">
                    {formatPercentage(row.test_rank)}/
                    {formatPercentage(row.test_participants)}
                  </span>

                  {row.best_attempt_id && (
                    <Link
                      href={`/results/view?attemptId=${row.best_attempt_id}`}
                      className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Ko‘rish
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* So'nggi natijalar */}
        {recentAttempts.length > 0 && (
          <>
            <div className="mt-7 flex items-end justify-between gap-3">
              <h2 className="text-lg font-bold">So‘nggi natijalar</h2>

              <Link
                href="/results"
                className="text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
              >
                Barchasi
              </Link>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              {recentAttempts.map((attempt, index) => {
                const percentage = toNumber(attempt.percentage);

                return (
                  <Link
                    key={attempt.id}
                    href={`/results/view?attemptId=${attempt.id}`}
                    className={
                      index > 0
                        ? "flex items-center gap-3 border-t border-mb-line px-4 py-3 transition sm:hover:bg-slate-50"
                        : "flex items-center gap-3 px-4 py-3 transition sm:hover:bg-slate-50"
                    }
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-mb-ink">
                        {rankingTestTitleMap.get(attempt.test_id) ??
                          "Noma’lum test"}
                      </span>

                      <span className="mt-0.5 block text-xs text-mb-muted">
                        {formatDate(attempt.completed_at)} ·{" "}
                        {attempt.score}/{attempt.total_questions} ball
                      </span>
                    </span>

                    <span
                      className={
                        percentage >= 80
                          ? "shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700"
                          : percentage >= 60
                            ? "shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-sm font-bold text-blue-700"
                            : "shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-sm font-bold text-red-700"
                      }
                    >
                      {formatPercentage(attempt.percentage)}%
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Reyting qoidasi — kerak bo'lsa ochiladi */}
        <details className="mt-4 rounded-2xl border border-mb-line bg-white px-4 py-3 shadow-sm">
          <summary className="cursor-pointer list-none text-sm font-semibold text-mb-brand">
            Reyting qanday hisoblanadi?
          </summary>

          <p className="mt-2 text-sm leading-6 text-mb-muted">
            Har testda eng yaxshi natijangiz olinadi va ular
            qo‘shiladi; ishlanmagan test 0 ball. Foiz teng bo‘lsa
            testni tezroq tugatgan yuqorida turadi. Dars testlari va
            uy vazifalari reytingga kirmaydi.
          </p>
        </details>

        {/* Sozlamalar */}
        <h2 className="mt-7 text-lg font-bold">Sozlamalar</h2>

        <div className="mt-3">
          <ProfileForm
            initialFullName={fullName}
            email={user.email ?? ""}
            provider={provider}
            role={profile.role}
            access={{
              textbooks: profile.can_access_textbooks,
              lessons: profile.can_access_lessons,
              tests: profile.can_access_tests,
            }}
          />
        </div>
      </section>
    </main>
  );
}
