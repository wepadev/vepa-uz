import Link from "next/link";

import GoogleSignInButton from "@/components/google-sign-in-button";
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  ListChecks,
  Play,
  Send,
} from "@/components/ui/icons";

import SampleQuiz from "@/components/home/sample-quiz";
import BrandMark from "@/components/ui/brand-mark";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import ProgressRing from "@/components/ui/progress-ring";
import { TELEGRAM_CHANNEL_USERNAME } from "@/lib/contacts";
import { formatDue, remainingLabel } from "@/lib/due-label";
import type { UserSummaryRpcRow } from "@/lib/stats-types";
import {
  getBasicProfile,
  getCurrentUser,
  getIsGroupStudent,
} from "@/lib/supabase/current-user";
import { getPublicCatalog } from "@/lib/public-catalog";
import { createClient } from "@/lib/supabase/server";
import { todayLabel } from "@/lib/uz-date";

export const dynamic = "force-dynamic";

type Profile = {
  full_name: string | null;
  role: string;
  is_active: boolean;
};

type AssignmentRow = {
  assignment_id: number;
  test_id: number;
  test_title: string;
  question_count: number;
  due_at: string;
  is_overdue: boolean;
  completed_at: string | null;
};

export default async function HomePage() {
  const supabase = await createClient();

  const user = await getCurrentUser();

  let profile: Profile | null = null;

  if (user) {
    const { profile: data, error } = await getBasicProfile(user.id);

    if (error) {
      throw new Error(
        `Profil yuklanmadi: ${error.message}`,
      );
    }

    profile = data as Profile | null;
  }

  const isAuthenticated = Boolean(
    user &&
      profile &&
      profile.is_active === true,
  );

  const isAdmin =
    isAuthenticated &&
    profile?.role === "admin";

  const fullName =
    profile?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "Öquvçi";

  /* Mehmon ochiq katalogga tushadi: avval nima borligini ko'radi */
  const testsHref = isAuthenticated ? "/tests" : "/katalog#testlar";
  const lessonsHref = isAuthenticated ? "/lessons" : "/katalog#darslar";
  const textbooksHref = isAuthenticated ? "/textbooks" : "/katalog#yecimlar";

  /*
   * Bugun takrorlash kutayotgan savollar soni.
   *
   * db/15 hali ishga tushirilmagan bo'lsa xato qaytadi — u holda
   * eslatma umuman ko'rsatilmaydi va bosh sahifa avvalgidek ishlaydi.
   */
  let dueReviewCount = 0;

  /* Do'kon faqat guruh o'quvchisiga ko'rinadi */
  let isInGroup = false;

  /*
   * Guruh o'quvchisi uchun navbatdagi uy vazifasi — bosh sahifadagi
   * eng muhim narsa: ochdi, ko'rdi, boshladi.
   */
  let nextAssignment: AssignmentRow | null = null;
  let pendingCount = 0;

  /* Öquvçining umumiy körsatkiçlari: örin, işlangan testlar, örtaça */
  let summary: UserSummaryRpcRow | null = null;

  if (isAuthenticated && user) {
    /*
     * Uchala so'rov bir vaqtda ketadi. `my_assignments` guruhda
     * bo'lmagan o'quvchiga bo'sh ro'yxat qaytaradi, shuning uchun
     * guruh tekshiruvini kutib turish shart emas.
     */
    const [reviewResult, inGroup, assignmentsResult, summaryResult] =
      await Promise.all([
        supabase.rpc("due_review_count"),
        getIsGroupStudent(user.id),
        supabase.rpc("my_assignments"),
        supabase.rpc("get_user_ranking_summary", { p_user_id: null }),
      ]);

    /* Xato bölsa körsatkiçlar şunçaki çiqmaydi — sahifa buzilmaydi */
    summary = summaryResult.error
      ? null
      : (((summaryResult.data ?? []) as UserSummaryRpcRow[])[0] ?? null);

    dueReviewCount = Number(reviewResult.data) || 0;
    isInGroup = inGroup;

    if (isInGroup) {
      const open = ((assignmentsResult.data ?? []) as AssignmentRow[])
        .filter((item) => !item.completed_at && !item.is_overdue)
        .sort((a, b) => a.due_at.localeCompare(b.due_at));

      nextAssignment = open[0] ?? null;
      pendingCount = open.length;
    }
  }

  /* Mehmon uchun: platformada nima borligi (xato bo'lsa — null) */
  const catalog = isAuthenticated ? null : await getPublicCatalog();

  const firstName = fullName.split(/\s+/)[0] || fullName;

  /* --- Öquvçi körsatkiçlari --- */
  const isRanked = Boolean(summary?.is_ranked);
  const testsDone = Number(summary?.tests_completed) || 0;
  const testsTotal = Number(summary?.ranking_tests_total) || 0;
  const average = Math.round(Number(summary?.average_percentage) || 0);
  const rank = Number(summary?.overall_rank) || 0;
  const participants = Number(summary?.overall_participants) || 0;

  /*
   * Asosiy bölimlar — 2×2 plitka. Törtinçi plitka öquvçiga qarab:
   * guruhda bölsa uy vazifasi, bölmasa reyting.
   */
  const tiles: {
    href: string;
    glyph: GlyphName;
    title: string;
    text: string;
  }[] = [
    {
      href: testsHref,
      glyph: "tests",
      title: "Testlar",
      text: "Natija darrov çiqadi",
    },
    {
      href: lessonsHref,
      glyph: "lessons",
      title: "Videodarslar",
      text: "Mavzular ketma-ket",
    },
    {
      href: textbooksHref,
      glyph: "solutions",
      title: "Yeçimlar",
      text: "5–11-sinf darsliklari",
    },
    isInGroup
      ? {
          href: "/homework",
          glyph: "homework",
          title: "Uy vazifasi",
          text:
            pendingCount > 0 ? `${pendingCount} ta kutyapti` : "Hammasi bajarilgan",
        }
      : {
          href: isAuthenticated ? "/leaderboard" : "/pricing",
          glyph: isAuthenticated ? "ranking" : "premium",
          title: isAuthenticated ? "Reyting" : "Premium",
          text: isAuthenticated ? "Eng faol öquvçilar" : "Tarif va narxlar",
        },
  ];

  /* Qolgan sahifalar — ixçam röyxat */
  const more: { href: string; glyph: GlyphName; title: string; text: string }[] =
    [
      ...(isInGroup
        ? [
            {
              href: "/leaderboard",
              glyph: "ranking" as const,
              title: "Reyting",
              text: "Eng faol öquvçilar",
            },
          ]
        : []),
      {
        href: "/guruhim",
        glyph: "group",
        title: "Guruhim",
        text: isInGroup
          ? "Ballar, tangalar va guruh reytingi"
          : "Ustoz bergan kod bilan qöşiliş",
      },
      ...(isInGroup
        ? [
            {
              href: "/dokon",
              glyph: "shop" as const,
              title: "Dökon",
              text: "Tangani sovğaga almaştiriş",
            },
          ]
        : []),
      {
        href: "/results",
        glyph: "results",
        title: "Natijalarim",
        text: "Işlangan testlar tahlili",
      },
      {
        href: "/takrorlash",
        glyph: "review",
        title: "Haftalik takrorlaş",
        text:
          dueReviewCount > 0
            ? `${dueReviewCount} ta savol kutyapti`
            : "Xato qilingan savollar",
      },
      {
        href: "/pricing",
        glyph: "premium",
        title: "Premium",
        text: "Hamma dars va testlar",
      },
    ];

  /* Hero ustidagi oq va şaffof tugmalar */
  const onBlueSolid =
    "press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-bold text-blue-700 shadow-[inset_0_-3px_0_rgb(3_22_80/0.16)] transition hover:bg-blue-50";
  const onBlueGhost =
    "press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/15 px-5 font-bold text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/25";

  const solidButton =
    "press btn-solid inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark";

  return (
    <main className="min-h-screen text-vp-ink">
      <header className="sticky top-0 z-30 border-b border-vp-line bg-vp-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <BrandMark size={36} className="h-9 w-9" />
            <p className="truncate text-lg font-extrabold tracking-tight">
              Vepa Ustoz
            </p>
          </Link>

          {isAuthenticated ? (
            <Link
              href="/profile"
              aria-label="Profilim"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-vp-tint text-base font-bold uppercase text-vp-brand-strong"
            >
              {firstName.slice(0, 1)}
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className="btn-solid inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-mb-brand px-4 text-sm font-bold text-white hover:bg-mb-brandDark"
            >
              Kiriş
            </Link>
          )}
        </div>
      </header>

      {isAuthenticated ? (
        /* ═════════════ ÖQUVÇI: "BUGUN" EKRANI ═════════════ */
        <section className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
          <p className="text-sm font-medium text-vp-muted">{todayLabel()}</p>

          <h1 className="mt-0.5 text-[28px] font-extrabold leading-tight sm:text-4xl">
            Salom, {firstName}
          </h1>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.65fr_1fr] lg:gap-4">
            {/* Navbatdagi qadam — ekrandagi yagona katta kök blok */}
            <div className="spotlight flex flex-col justify-between rounded-3xl p-5 sm:p-7">
              {nextAssignment ? (
                <>
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.07em] text-blue-100">
                      <span className="h-2 w-2 rounded-full bg-vp-accent" />
                      Uy vazifasi · {remainingLabel(nextAssignment.due_at)}
                    </p>

                    <h2 className="mt-2 max-w-[18ch] text-2xl font-extrabold leading-tight sm:text-[32px]">
                      {nextAssignment.test_title}
                    </h2>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-blue-100">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4" aria-hidden="true" />
                        {formatDue(nextAssignment.due_at)} gaça
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4" aria-hidden="true" />
                        {nextAssignment.question_count} ta savol
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <Link
                      href={`/tests/take?testId=${nextAssignment.test_id}&assignmentId=${nextAssignment.assignment_id}`}
                      className={onBlueSolid}
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Vazifani boşlaş
                    </Link>

                    <Link href="/homework" className={onBlueGhost}>
                      {pendingCount > 1
                        ? `Barça vazifalar (${pendingCount})`
                        : "Vazifalarim"}
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.07em] text-blue-100">
                      <span className="h-2 w-2 rounded-full bg-vp-accent" />
                      Navbatdagi qadam
                    </p>

                    <h2 className="mt-2 max-w-[16ch] text-2xl font-extrabold leading-tight sm:text-[32px]">
                      {isInGroup
                        ? "Uy vazifasi yöq — maşq qilamizmi?"
                        : testsDone > 0
                          ? "Keyingi testni işlaymizmi?"
                          : "Birinçi testingizni işlang"}
                    </h2>

                    <p className="mt-2 max-w-md text-sm leading-6 text-blue-100">
                      {isInGroup
                        ? "Yangi vazifa berilsa şu yerda çiqadi."
                        : "Natija va xatolar tahlili test tugaşi bilan çiqadi."}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <Link href="/tests" className={onBlueSolid}>
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Test işlaş
                    </Link>

                    {!isInGroup && (
                      <Link href="/guruhim" className={onBlueGhost}>
                        Guruhga qöşiliş
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Körsatkiçlar: örtaça ball halqada, yonida örin va testlar */}
            <Link
              href="/results"
              className="edge group flex items-center gap-4 rounded-3xl border border-vp-line bg-vp-surface p-5 lg:flex-col lg:items-stretch lg:justify-between lg:gap-5 lg:p-6"
            >
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={average}
                  size={76}
                  stroke={8}
                  tone={average >= 90 ? "success" : "brand"}
                >
                  <span className="num text-lg font-extrabold">{average}%</span>
                </ProgressRing>

                <div className="min-w-0 lg:flex-1">
                  <p className="eyebrow">Örtaça natija</p>
                  <p className="mt-0.5 text-sm leading-5 text-vp-muted">
                    {isRanked
                      ? "Reyting testlari böyiça"
                      : "Birinçi testdan keyin çiqadi"}
                  </p>
                </div>
              </div>

              <dl className="ml-auto grid shrink-0 grid-cols-1 gap-2 text-right lg:ml-0 lg:grid-cols-2 lg:gap-3 lg:text-left">
                <div className="lg:rounded-2xl lg:bg-vp-page lg:p-3">
                  <dt className="text-xs font-semibold text-vp-muted">Örin</dt>
                  <dd className="num text-xl font-extrabold">
                    {isRanked && rank > 0 ? rank : "—"}
                    {isRanked && participants > 0 && (
                      <span className="text-sm font-semibold text-vp-muted">
                        /{participants}
                      </span>
                    )}
                  </dd>
                </div>

                <div className="lg:rounded-2xl lg:bg-vp-page lg:p-3">
                  <dt className="text-xs font-semibold text-vp-muted">Testlar</dt>
                  <dd className="num text-xl font-extrabold">
                    {testsDone}
                    {testsTotal > 0 && (
                      <span className="text-sm font-semibold text-vp-muted">
                        /{testsTotal}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </Link>
          </div>

          {/* Takrorlaş — faqat bugun kutayotgan savol bölsa */}
          {dueReviewCount > 0 && (
            <Link
              href="/takrorlash"
              className="edge group mt-3 flex items-center gap-3.5 rounded-2xl border border-vp-warning-line bg-vp-accent-soft p-3.5 sm:p-4"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-vp-surface ring-1 ring-vp-warning-line">
                <Glyph name="review" className="h-8 w-8" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-6 text-vp-ink">
                  {dueReviewCount} ta savol takrorlaşni kutyapti
                </span>
                <span className="block text-sm text-vp-muted">
                  Xato qilgan savollaringiz — 5 daqiqada ulgurasiz.
                </span>
              </span>

              <ChevronRight
                className="h-5 w-5 shrink-0 text-vp-muted transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          )}

          {/* Bölimlar */}
          <h2 className="mt-8 text-lg font-bold sm:text-xl">Bölimlar</h2>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {tiles.map((tile) => (
              <Link
                key={tile.title}
                href={tile.href}
                className="edge group flex flex-col rounded-2xl border border-vp-line bg-vp-surface p-4"
              >
                <GlyphTile name={tile.glyph} size="md" />

                <span className="mt-4 block text-[17px] font-bold leading-6">
                  {tile.title}
                </span>
                <span className="mt-0.5 block text-[13px] leading-5 text-vp-muted">
                  {tile.text}
                </span>
              </Link>
            ))}
          </div>

          {/* Yana */}
          <h2 className="mt-8 text-lg font-bold sm:text-xl">Yana</h2>

          <div className="mt-3 grid overflow-hidden rounded-2xl border border-vp-line bg-vp-surface sm:grid-cols-2">
            {more.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 border-b border-vp-line p-3.5 transition-colors last:border-b-0 hover:bg-vp-page sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <GlyphTile name={item.glyph} size="sm" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {item.title}
                  </span>
                  <span className="block truncate text-[13px] text-vp-muted">
                    {item.text}
                  </span>
                </span>

                <ChevronRight
                  className="h-5 w-5 shrink-0 text-vp-line-strong transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>

          {isAdmin && (
            <Link
              href="/admin"
              className="edge mt-3 flex items-center justify-between gap-3 rounded-2xl border border-vp-line bg-vp-surface px-4 py-3.5"
            >
              <span>
                <span className="block font-bold">Admin panel</span>
                <span className="block text-sm text-vp-muted">
                  Testlar, darslar, guruhlar va yeçimlarni boşqariş.
                </span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-vp-brand" aria-hidden="true" />
            </Link>
          )}
        </section>
      ) : (
        /* ═════════════ MEHMON ═════════════ */
        <>
          <section className="border-b border-vp-line bg-vp-surface">
            <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 pb-10 pt-8 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-vp-surface-soft py-1 pl-1 pr-3 text-[13px] font-semibold text-vp-brand-strong ring-1 ring-inset ring-vp-tint">
                  <BrandMark size={24} className="h-6 w-6" />
                  Vepa Kurbankliçev · matematika ustozi
                </p>

                <h1 className="mt-4 text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[56px]">
                  Matematikani{" "}
                  <span className="text-vp-brand">tuşunib</span> örganing
                </h1>

                <p className="mt-4 max-w-md text-base leading-7 text-vp-muted sm:text-[17px]">
                  Videodars köring, test işlang, xatoyingizni darrov
                  tuşuning. Hammasi bitta ustozdan, bitta joyda.
                </p>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <Link href="/auth/login?mode=signup" className={solidButton}>
                    Bepul boşlaş
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>

                  <div className="tg-hide sm:w-60">
                    <GoogleSignInButton compact className="min-h-12 w-full rounded-xl" />
                  </div>
                </div>

                {catalog && (
                  <dl className="mt-8 flex max-w-md divide-x divide-vp-line border-t border-vp-line pt-5">
                    {[
                      [catalog.testCount, "test"],
                      [catalog.lessonCount, "videodars"],
                      [catalog.textbookCount, "darslik yeçimi"],
                    ].map(([value, label]) => (
                      <div key={label} className="flex-1 px-4 first:pl-0">
                        <dd className="num text-[26px] font-extrabold leading-none sm:text-3xl">
                          {value}
                        </dd>
                        <dt className="mt-1 text-[13px] font-medium text-vp-muted">
                          {label}
                        </dt>
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              <SampleQuiz />
            </div>
          </section>

          {/* Qanday işlaydi */}
          <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
            <p className="eyebrow">Qanday işlaydi</p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              Uç qadam — bitta mavzu
            </h2>

            <ol className="mt-6 grid gap-3 sm:grid-cols-3">
              {(
                [
                  [
                    "lessons",
                    "Videodarsni köring",
                    "Har mavzuni ustozning özi tuşuntiradi — qisqa va tartib bilan.",
                  ],
                  [
                    "tests",
                    "Testni işlang",
                    "Natija va har bir savolning tahlili test tugaşi bilan çiqadi.",
                  ],
                  [
                    "review",
                    "Xatoni takrorlang",
                    "Xato qilgan savollaringiz hafta oxirida yana oldingizga keladi.",
                  ],
                ] as [GlyphName, string, string][]
              ).map(([glyph, title, text], index) => (
                <li
                  key={title}
                  className="relative rounded-2xl border border-vp-line bg-vp-surface p-5"
                >
                  <span className="num absolute right-4 top-3 text-[44px] font-extrabold leading-none text-vp-raised">
                    {index + 1}
                  </span>

                  <GlyphTile name={glyph} size="md" />

                  <h3 className="mt-4 text-[17px] font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-vp-muted">{text}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Bölimlar: içida nima bor */}
          <section className="border-y border-vp-line bg-vp-surface">
            <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Platformada nima bor</p>
                  <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
                    Uçta bölim
                  </h2>
                </div>

                <Link
                  href="/katalog"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-vp-brand hover:text-vp-brand-strong"
                >
                  Barça mavzular
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {(
                  [
                    {
                      href: testsHref,
                      glyph: "tests",
                      title: "Testlar",
                      text: "Vaqt bilan işlanadi, javoblar saqlanib turadi. Tugatgaç — ball va har bir savol tahlili.",
                      tags: catalog?.examTypes ?? [],
                    },
                    {
                      href: lessonsHref,
                      glyph: "lessons",
                      title: "Videodarslar",
                      text: "Mavzular ketma-ket. Dars testini 90% ga işlasangiz, keyingi dars oçiladi.",
                      tags: catalog?.lessonCategories.slice(0, 4) ?? [],
                    },
                    {
                      href: textbooksHref,
                      glyph: "solutions",
                      title: "Darslik yeçimlari",
                      text: "Maktab darsliklari va maşhur töplamlardagi masalalarning qadam-baqadam yeçimi.",
                      tags: ["5–11-sinf", "TOP kitoblar"],
                    },
                  ] as const
                ).map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="edge group flex gap-4 rounded-2xl border border-vp-line bg-vp-surface p-4 lg:flex-col lg:p-5"
                  >
                    <GlyphTile name={item.glyph} size="lg" className="max-lg:h-14 max-lg:w-14 max-lg:rounded-2xl max-lg:[&>svg]:h-9 max-lg:[&>svg]:w-9" />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-lg font-bold">{item.title}</span>
                        <ArrowRight
                          className="h-5 w-5 shrink-0 text-vp-line-strong transition group-hover:translate-x-0.5 group-hover:text-vp-brand"
                          aria-hidden="true"
                        />
                      </span>

                      <span className="mt-1 block text-sm leading-6 text-vp-muted">
                        {item.text}
                      </span>

                      {item.tags.length > 0 && (
                        <span className="mt-3 flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-vp-page px-2 py-0.5 text-xs font-semibold text-vp-muted ring-1 ring-inset ring-vp-line"
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Ustoz */}
          <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-10">
              <div>
                <p className="eyebrow">Ustoz haqida</p>

                <p className="mt-2 text-[22px] font-bold leading-[1.35] tracking-[-0.015em] sm:text-[28px]">
                  Platformadagi har bir videodars, test va yeçimni ustozning
                  özi tayyorlaydi.
                </p>

                <p className="mt-3 max-w-xl text-[15px] leading-7 text-vp-muted">
                  Guruh öquvçilari şu yerda uy vazifasini bajaradi,
                  xatolarini köradi va reytingda bellaşadi.
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <BrandMark size={44} priority={false} className="h-11 w-11" />
                  <div>
                    <p className="font-bold leading-5">Vepa Kurbankliçev</p>
                    <p className="text-sm text-vp-muted">Matematika ustozi</p>
                  </div>
                </div>
              </div>

              <div className="spotlight rounded-3xl p-6">
                <h2 className="max-w-[16ch] text-2xl font-extrabold leading-tight">
                  Bugun birinçi testni işlab köring
                </h2>

                <p className="mt-2 text-sm leading-6 text-blue-100">
                  Bepul belgisi bor dars va testlar hammaga oçiq.
                </p>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link href="/auth/login?mode=signup" className={onBlueSolid}>
                    Bepul boşlaş
                  </Link>

                  <a
                    href={`https://t.me/${TELEGRAM_CHANNEL_USERNAME}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={onBlueGhost}
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Telegram kanal
                  </a>
                </div>

                <Link
                  href="/pricing"
                  className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
                >
                  Tariflar va narxlar
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

      <footer className="border-t border-vp-line bg-vp-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-sm text-vp-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="font-bold text-vp-ink">Vepa Ustoz</span>
          </p>
          <p>Matematika ta’lim platformasi</p>
        </div>
      </footer>
    </main>
  );
}
