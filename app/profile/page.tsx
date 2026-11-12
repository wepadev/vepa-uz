import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import ProfileForm from "@/components/profile-form";
import {
  buildLastScoreMap,
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
import { ChevronRight } from "@/components/ui/icons";
import EmptyState from "@/components/ui/empty-state";
import { GlyphTile } from "@/components/ui/glyph";
import PageHeader from "@/components/ui/page-header";
import ProgressRing from "@/components/ui/progress-ring";
import { Tag } from "@/components/ui/row";
import { btnAccent, btnGhost, btnPrimary } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profil",
  description:
    "Şaxsiy ma’lumotlar, obuna holati va yutuqlar.",
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
  completed_at: string | null;
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
    "Öquvçi";

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
      `Şaxsiy reyting yuklanmadi: ${summaryResult.error.message}`,
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
            percentage,
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
            lessonTestIds,
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (recentAttemptsResult.error) {
    throw new Error(
      `Sönggi natijalar yuklanmadi: ${recentAttemptsResult.error.message}`,
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

  /* Har testdan oxirgi urinish — eng yaxşisi emas */
  const lessonLastScoreMap =
    buildLastScoreMap(lessonAttempts);

  const testsByLesson = buildLessonTestMap(lessonProgress);

  const completedLessons = lessons.filter((lesson) =>
    isLessonPassed(
      testsByLesson.get(lesson.id) ?? [],
      lessonLastScoreMap,
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
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        title="Profilim"
        glyph="profile"
        width="3xl"
        action={<LogoutButton />}
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Kim ekaningiz */}
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-mb-brand text-xl font-extrabold text-white ring-4 ring-mb-tint">
            {initials || "O"}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold text-mb-ink sm:text-2xl">
              {fullName}
            </h2>

            <p className="truncate text-sm text-mb-muted">
              {user.email ?? "Email körsatilmagan"}
            </p>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Tag tone={hasPremium && !isAdmin ? "accent" : "neutral"}>
                {isAdmin
                  ? "Administrator"
                  : hasPremium
                    ? "Premium"
                    : "Bepul tarif"}
              </Tag>

              {!isAdmin && isRanked && (
                <Tag tone="brand">
                  Reytingda {overallRank}-örin · {overallParticipants} içida
                </Tag>
              )}
            </div>
          </div>
        </div>

        {/* Tarif */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-mb-line bg-white p-3.5">
          <GlyphTile name="premium" size="sm" />

          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-5 text-mb-ink">
              {isAdmin
                ? "Barça materiallar oçiq"
                : hasPremium
                  ? latestPlan?.name ?? "Premium tarif"
                  : "Bepul dars va testlar oçiq"}
            </p>

            <p className="num mt-0.5 text-sm text-mb-muted">
              {isAdmin
                ? "Admin hisobida muddat talab qilinmaydi."
                : hasPremium
                  ? `${formatDate(profile.premium_until)} gaça · ${premiumDaysRemaining} kun qoldi`
                  : "Qolganini Premium oçadi."}
            </p>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            {!isAdmin && (
              <Link href="/pricing" className={`${btnAccent} flex-1`}>
                {hasPremium ? "Uzaytiriş" : "Premium oliş"}
              </Link>
            )}

            <Link href="/profile/payments" className={`${btnGhost} flex-1`}>
              Tölovlarim
            </Link>
          </div>
        </div>

        {/* Statistika: halqa — örtaça, yonida uçta son */}
        <div className="mt-3 rounded-2xl border border-mb-line bg-white p-4">
          <div className="flex items-center gap-4">
            <ProgressRing
              value={averagePercentage}
              size={76}
              stroke={8}
              tone={averagePercentage >= 90 ? "success" : "brand"}
            >
              <span className="num text-base font-extrabold text-mb-ink">
                {formatPercentage(averagePercentage)}%
              </span>
            </ProgressRing>

            <div className="min-w-0 flex-1">
              <p className="eyebrow">Örtaça natija</p>
              <p className="num mt-1 text-sm leading-5 text-mb-muted">
                {testsCompleted} / {rankingTestsTotal} reyting testi işlangan
                {excellentTests > 0 ? ` · ${excellentTests} tasi 90%+` : ""}
              </p>
            </div>
          </div>

          <dl className="num mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Işlangan test", String(testsCompleted)],
              ["Eng yuqori", `${formatPercentage(highestPercentage)}%`],
              ["Reyting bali", formatPercentage(ratingPoints)],
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

        {/* Darslar progressi */}
        <Link
          href="/lessons"
          className="edge group mt-3 flex items-center gap-3 rounded-2xl border border-mb-line bg-white p-3.5"
        >
          <GlyphTile name="lessons" size="sm" />

          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-bold text-mb-ink">
                Darslar
              </span>
              <span className="num text-[13px] text-mb-muted">
                {completedLessons} / {lessons.length}
              </span>
            </span>

            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full bg-mb-brand"
                style={{ width: `${lessonPercentage}%` }}
              />
            </span>
          </span>

          <ChevronRight
            className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>

        {/* Testlar bo'yicha o'rin */}
        <h2 className="eyebrow mt-7">Testlardagi örningiz</h2>

        {testRankingRows.length === 0 ? (
          <EmptyState
            glyph="ranking"
            title="Hali reyting natijasi yöq"
            className="mt-3"
            action={
              <Link href="/tests" className={btnPrimary}>
                Test işlaş
              </Link>
            }
          >
            Reyting testini işlasangiz, har bir testdagi örningiz şu yerda
            çiqadi.
          </EmptyState>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white">
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
                  <p className="truncate text-[15px] font-bold text-mb-ink">
                    {row.title}
                  </p>

                  <p className="num mt-0.5 text-[13px] text-mb-muted">
                    {formatPercentage(row.attempts_count)} uriniş ·
                    oxirgi vaqt{" "}
                    {formatDuration(row.best_duration_seconds)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="num text-base font-extrabold text-mb-ink">
                    {formatPercentage(row.best_percentage)}%
                  </span>

                  <Tag tone="brand">
                    {formatPercentage(row.test_rank)}-örin ·{" "}
                    {formatPercentage(row.test_participants)}
                  </Tag>

                  {row.best_attempt_id && (
                    <Link
                      href={`/results/view?attemptId=${row.best_attempt_id}`}
                      className="inline-flex min-h-10 items-center rounded-lg px-2.5 text-sm font-semibold text-mb-brandDark hover:bg-mb-tintSoft"
                    >
                      Tahlil
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
              <h2 className="eyebrow">Sönggi natijalar</h2>

              <Link
                href="/results"
                className="text-sm font-semibold text-mb-brandDark hover:underline"
              >
                Barçasi
              </Link>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white">
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
                      <span className="block truncate text-[15px] font-bold text-mb-ink">
                        {rankingTestTitleMap.get(attempt.test_id) ??
                          "Noma’lum test"}
                      </span>

                      <span className="num mt-0.5 block text-[13px] text-mb-muted">
                        {formatDate(attempt.completed_at)} ·{" "}
                        {attempt.score}/{attempt.total_questions} ball
                      </span>
                    </span>

                    <span
                      className={
                        percentage >= 90
                          ? "num shrink-0 text-base font-extrabold text-vp-success"
                          : percentage >= 60
                            ? "num shrink-0 text-base font-extrabold text-mb-ink"
                            : "num shrink-0 text-base font-extrabold text-vp-danger"
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
        <details className="mt-4 rounded-2xl border border-mb-line bg-white px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-bold text-mb-ink [&::-webkit-details-marker]:hidden">
            Reyting qanday hisoblanadi?
          </summary>

          <p className="mt-2 text-sm leading-6 text-mb-muted">
            Har testda oxirgi urinişingiz natijasi olinadi va ular
            qöşiladi; işlanmagan test 0 ball. Foiz teng bölsa
            testni tezroq tugatgan yuqorida turadi. Dars testlari va
            uy vazifalari reytingga kirmaydi.
          </p>
        </details>

        {/* Sozlamalar */}
        <h2 className="eyebrow mt-7">Sozlamalar</h2>

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
