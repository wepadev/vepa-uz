import Link from "next/link";

import { signOutAction } from "@/app/actions/sign-out";
import GoogleSignInButton from "@/components/google-sign-in-button";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarClock,
  ClipboardCheck,
  Coins,
  Crown,
  ListChecks,
  MonitorPlay,
  Play,
  Send,
  Trophy,
  Users,
} from "lucide-react";

import BrandMark from "@/components/ui/brand-mark";
import WorkedExample from "@/components/ui/worked-example";
import { accents } from "@/components/ui/section-visual";
import { TELEGRAM_CHANNEL_USERNAME } from "@/lib/contacts";
import { formatDue, remainingLabel } from "@/lib/due-label";
import {
  getBasicProfile,
  getCurrentUser,
  getIsGroupStudent,
} from "@/lib/supabase/current-user";
import { getPublicCatalog } from "@/lib/public-catalog";
import { createClient } from "@/lib/supabase/server";

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

  if (isAuthenticated && user) {
    /*
     * Uchala so'rov bir vaqtda ketadi. `my_assignments` guruhda
     * bo'lmagan o'quvchiga bo'sh ro'yxat qaytaradi, shuning uchun
     * guruh tekshiruvini kutib turish shart emas.
     */
    const [reviewResult, inGroup, assignmentsResult] = await Promise.all([
      supabase.rpc("due_review_count"),
      getIsGroupStudent(user.id),
      supabase.rpc("my_assignments"),
    ]);

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

  /* Tezkor havolalar — kirgan o'quvchi uchun keyingi qadamlar */
  /* Tezkor havolalar — bitta qatorda, telefonda ham */
  /*
   * Tezkor havolalar. `tone` — bo'lim guruhining ohangi
   * (components/ui/section-visual.ts): reyting va natijalar
   * binafsha, odamlar yashil, o'quv materiallari sariq, testlar ko'k.
   */
  const quickLinks = [
    {
      href: "/leaderboard",
      icon: Trophy,
      label: "Reyting",
      tone: accents.insight.tile,
    },
    {
      href: "/guruhim",
      icon: Users,
      label: "Guruhim",
      tone: accents.people.tile,
    },
    ...(isInGroup
      ? [
          {
            href: "/dokon",
            icon: Coins,
            label: "Dökon",
            tone: accents.content.tile,
          },
        ]
      : []),
    {
      href: "/pricing",
      icon: Crown,
      label: "Premium",
      tone: accents.tests.tile,
    },
  ];

  /*
   * Asosiy bölimlar — kitobning mundarijasi kabi: raqam, nom,
   * nuqtali çiziq va son. Mehmonga katalogdagi son körinadi.
   */
  const sections = [
    {
      href: testsHref,
      icon: ClipboardCheck,
      title: "Testlar",
      text: "Attestatsiya, Milliy sertifikat, SAT — natija darrov çiqadi.",
      count: catalog ? `${catalog.testCount} ta` : null,
    },
    {
      href: lessonsHref,
      icon: MonitorPlay,
      title: "Videodarslar",
      text: "Mavzular böyiça ketma-ket, ustozning özi tuşuntiradi.",
      count: catalog ? `${catalog.lessonCount} ta` : null,
    },
    {
      href: textbooksHref,
      icon: BookOpen,
      title: "Darslik yeçimlari",
      text: "5–11-sinf va TOP kitoblar, qadam-baqadam.",
      count: catalog ? `${catalog.textbookCount} ta` : null,
    },
  ];

  /* Oq, ramkali ikkilamçi tugma */
  const ghostButton =
    "press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 font-semibold text-mb-ink transition hover:border-slate-400 hover:bg-slate-50";

  /* Asosiy tugma — logo köki, pastki "qalinlik" bilan */
  const solidButton =
    "press btn-solid inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark";

  return (
    <main className="min-h-screen text-mb-ink">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-slate-50/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <BrandMark size={36} className="h-9 w-9" />

            <p className="truncate font-serif text-[19px] font-bold tracking-tight">
              Vepa Ustoz
            </p>
          </Link>

          {isAuthenticated ? (
            <div className="flex shrink-0 items-center gap-2">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden min-h-10 items-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 sm:inline-flex"
                >
                  Admin
                </Link>
              )}

              <Link
                href="/profile"
                className="inline-flex min-h-10 max-w-40 items-center truncate rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {fullName}
              </Link>

              <form action={signOutAction} className="hidden sm:block">
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  Çiqiş
                </button>
              </form>
            </div>
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

      {/* ── Boş qism ─────────────────────────────────────────── */}
      {isAuthenticated ? (
        <section className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-10">
          <p className="eyebrow">Salom, {fullName}</p>

          {nextAssignment ? (
            <div className="paper-grid paper-margin mt-3 overflow-hidden rounded-2xl border border-slate-300/70 shadow-md">
              <div className="py-5 pl-10 pr-5 sm:py-7 sm:pl-14 sm:pr-8">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-pen">
                  Uy vazifasi
                </p>

                <h1 className="mt-1.5 text-[26px] font-bold leading-tight sm:text-[34px]">
                  {nextAssignment.test_title}
                </h1>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm font-medium text-mb-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    {remainingLabel(nextAssignment.due_at)} · {formatDue(nextAssignment.due_at)}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    {nextAssignment.question_count} ta savol
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  <Link
                    href={`/tests/take?testId=${nextAssignment.test_id}&assignmentId=${nextAssignment.assignment_id}`}
                    className={solidButton}
                  >
                    <Play className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
                    Vazifani boşlaş
                  </Link>

                  <Link href="/homework" className={ghostButton}>
                    {pendingCount > 1
                      ? `Barça vazifalar (${pendingCount})`
                      : "Vazifalarim"}
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <h1 className="max-w-2xl text-[30px] font-bold leading-[1.15] sm:text-[44px]">
                {isInGroup ? (
                  <>
                    Hozirça <span className="marker">uy vazifasi</span> yöq
                  </>
                ) : (
                  <>
                    Bugun nimadan <span className="marker">boşlaymiz</span>?
                  </>
                )}
              </h1>

              <p className="mt-3 max-w-lg text-[15px] leading-7 text-mb-muted sm:text-base">
                {isInGroup
                  ? "Yangi vazifa berilsa şu yerda çiqadi. Böş vaqtda test işlab, maşq qiling."
                  : "Test işlang yoki ustozingiz bergan kod bilan guruhga qöşiling."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link href="/tests" className={solidButton}>
                  <Play className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
                  Test işlaş
                </Link>

                {!isInGroup && (
                  <Link href="/guruhim" className={ghostButton}>
                    Guruhga qöşiliş
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="border-b border-mb-line">
          <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-14 md:grid-cols-[1.1fr_0.9fr] md:gap-12">
            <div>
              <p className="eyebrow">Vepa Kurbankliçev · matematika ustozi</p>

              <h1 className="mt-3 text-[38px] font-bold leading-[1.08] sm:text-[54px]">
                Matematikani <span className="marker">tuşunib</span> örganing
              </h1>

              <p className="mt-4 max-w-md text-base leading-7 text-mb-muted sm:text-[17px]">
                Videodarslar, onlayn testlar va darslik masalalarining
                batafsil yeçimlari — bitta ustozdan, bir joyda.
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <Link href="/auth/login" className={solidButton}>
                  Bepul boşlaş
                  <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                </Link>

                <div className="sm:w-64">
                  <GoogleSignInButton compact className="min-h-12 w-full rounded-xl" />
                </div>
              </div>
            </div>

            <WorkedExample className="md:translate-y-2 md:rotate-[0.6deg]" />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
        {/*
          Takrorlash eslatmasi — faqat bugun kutayotgan savol
          bölsa çiqadi: böş karta ekranni band qilib turmasin.
        */}
        {dueReviewCount > 0 && (
          <Link
            href="/takrorlash"
            className="press group mt-6 flex items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 transition sm:p-5 sm:hover:border-amber-400"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-500 text-white">
              <BrainCircuit className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-[0.08em] text-amber-700">
                Haftalik takrorlaş
              </span>

              <span className="mt-0.5 block font-serif text-lg font-bold leading-6 text-amber-950 sm:text-xl">
                {dueReviewCount} ta savol sizni kutyapti
              </span>

              <span className="mt-1 block text-sm text-amber-800">
                Xato qilgan savollaringiz — 5 daqiqada ulgurasiz.
              </span>
            </span>

            <ArrowRight
              className="h-5 w-5 shrink-0 text-amber-700 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2.4}
              aria-hidden="true"
            />
          </Link>
        )}

        {/* Tezkor havolalar */}
        {isAuthenticated && (
          <div
            className={
              quickLinks.length === 4
                ? "mt-6 grid grid-cols-4 gap-2 sm:gap-3"
                : "mt-6 grid grid-cols-3 gap-2 sm:gap-3"
            }
          >
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="press flex flex-col items-center gap-2 rounded-xl border border-mb-line bg-white px-2 py-3.5 text-center transition sm:flex-row sm:justify-start sm:gap-3 sm:px-4 sm:text-left sm:hover:border-slate-400"
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${link.tone}`}>
                  <link.icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>

                <span className="text-xs font-semibold leading-4 text-mb-ink sm:text-sm">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* ── Mundarija ───────────────────────────────────────── */}
        <div className="mt-10 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-bold sm:text-[28px]">Mundarija</h2>

          {!isAuthenticated && (
            <Link
              href="/katalog"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              Barça mavzular
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="ruler mt-3" aria-hidden="true" />

        <ol className="divide-y divide-mb-line">
          {sections.map((item, index) => (
            <li key={item.title}>
              <Link
                href={item.href}
                className="press group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 py-5 sm:gap-x-6 sm:py-6"
              >
                <span className="font-serif text-[28px] font-semibold tabular-nums leading-none text-slate-400 transition-colors group-hover:text-mb-brand sm:text-[36px]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="min-w-0">
                  <span className="flex items-baseline gap-3">
                    <span className="font-serif text-xl font-bold leading-tight text-mb-ink transition-colors group-hover:text-mb-brand sm:text-[24px]">
                      {item.title}
                    </span>

                    <span
                      aria-hidden="true"
                      className="hidden flex-1 translate-y-[-4px] border-b-2 border-dotted border-slate-300 sm:block"
                    />

                    {item.count && (
                      <span className="hidden shrink-0 text-sm font-semibold tabular-nums text-mb-muted sm:inline">
                        {item.count}
                      </span>
                    )}
                  </span>

                  <span className="mt-1 block text-sm leading-6 text-mb-muted">
                    {item.text}
                  </span>
                </span>

                <span className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 text-mb-ink transition group-hover:border-mb-brand group-hover:bg-mb-brand group-hover:text-white">
                  <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {/*
          Mehmon uçun: kimning platformasi. Öquvçi ustoz uçun keladi,
          şuning uçun avval ustoz, keyin bölim nomlari (Google uçun
          ham foydali: sahifada haqiqiy matn bor).
        */}
        {!isAuthenticated && (
          <div className="mt-10 grid gap-6 border-t border-mb-line pt-10 md:grid-cols-[1.2fr_1fr] md:gap-10">
            <div>
              <p className="eyebrow">Ustoz haqida</p>

              <blockquote className="mt-3 font-serif text-[21px] leading-[1.45] text-mb-ink sm:text-[24px]">
                Platformadagi har bir videodars, test va yeçimni ustozning
                özi tayyorlaydi. Guruh öquvçilari şu yerda uy vazifasini
                bajaradi, xatolarini köradi va reytingda bellaşadi.
              </blockquote>

              <div className="mt-5 flex items-center gap-3">
                <BrandMark size={44} priority={false} className="h-11 w-11" />

                <div className="min-w-0">
                  <p className="font-hand text-[26px] leading-none text-mb-brand">
                    Vepa Kurbankliçev
                  </p>
                  <p className="mt-1 text-sm text-mb-muted">Matematika ustozi</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-mb-line bg-white p-5">
              {catalog && catalog.examTypes.length > 0 && (
                <p className="text-sm leading-6 text-slate-600">
                  <b className="text-mb-ink">Testlar:</b>{" "}
                  {catalog.examTypes.join(", ")}.
                </p>
              )}

              {catalog && catalog.lessonCategories.length > 0 && (
                <p className="text-sm leading-6 text-slate-600">
                  <b className="text-mb-ink">Videodarslar:</b>{" "}
                  {catalog.lessonCategories.slice(0, 8).join(", ")}
                  {catalog.lessonCategories.length > 8 ? " va boşqalar" : ""}.
                </p>
              )}

              <a
                href={`https://t.me/${TELEGRAM_CHANNEL_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="press inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-mb-ink transition hover:border-slate-400 hover:bg-slate-50"
              >
                <Send className="h-4 w-4 text-mb-brand" strokeWidth={2.2} aria-hidden="true" />
                Telegram: @{TELEGRAM_CHANNEL_USERNAME}
              </a>

              <Link
                href="/pricing"
                className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
              >
                Tariflar va narxlar
                <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {isAdmin && (
          <Link
            href="/admin"
            className="press mt-8 flex items-center justify-between gap-3 rounded-2xl bg-mb-ink px-5 py-4 text-white transition sm:hover:bg-slate-800"
          >
            <span>
              <span className="block font-serif text-lg font-bold">Admin panel</span>
              <span className="mt-0.5 block text-sm text-slate-300">
                Testlar, darslar, guruhlar va yeçimlarni boşqariş.
              </span>
            </span>

            <ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        )}
      </section>

      <footer className="border-t border-mb-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-sm text-mb-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="font-serif font-semibold text-mb-ink">Vepa Ustoz</span>
          </p>
          <p>Matematika — tuşunib örganiladi.</p>
        </div>
      </footer>
    </main>
  );
}
