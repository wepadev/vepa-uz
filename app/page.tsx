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
import { accents } from "@/components/ui/section-visual";
import { TELEGRAM_CHANNEL_USERNAME } from "@/lib/contacts";
import { formatDue, remainingLabel } from "@/lib/due-label";
import { isGroupStudent } from "@/lib/group-membership";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;

  if (user) {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        full_name,
        role,
        is_active
      `)
      .eq("id", user.id)
      .maybeSingle();

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

  const testsHref = isAuthenticated
    ? "/tests"
    : "/auth/login";

  const lessonsHref = isAuthenticated
    ? "/lessons"
    : "/auth/login";

  const textbooksHref = isAuthenticated
    ? "/textbooks"
    : "/auth/login";

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
    const [reviewResult, inGroup] = await Promise.all([
      supabase.rpc("due_review_count"),
      isGroupStudent(supabase, user.id),
    ]);

    dueReviewCount = Number(reviewResult.data) || 0;
    isInGroup = inGroup;

    if (isInGroup) {
      const { data } = await supabase.rpc("my_assignments");

      const open = ((data ?? []) as AssignmentRow[])
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark size={40} className="h-9 w-9 sm:h-10 sm:w-10" />

            <p className="truncate text-lg font-bold">Vepa Ustoz</p>
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
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-mb-brand px-4 text-sm font-semibold text-white hover:bg-mb-brandDark"
            >
              Kiriş
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        {/* Salomlashuv va asosiy harakat */}
        <div className="relative overflow-hidden rounded-3xl bg-mb-brand p-5 text-white shadow-lg sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-white/5"
          />

          <div className="relative">
            {isAuthenticated ? (
              <>
                <p className="text-sm font-semibold text-blue-100">
                  Salom, {fullName}
                </p>

                {nextAssignment ? (
                  <>
                    <h1 className="mt-1.5 text-2xl font-bold leading-tight sm:text-4xl">
                      {nextAssignment.test_title}
                    </h1>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-blue-100">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        {remainingLabel(nextAssignment.due_at)} · {formatDue(nextAssignment.due_at)}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        {nextAssignment.question_count} ta savol
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2.5">
                      <Link
                        href={`/tests/take?testId=${nextAssignment.test_id}&assignmentId=${nextAssignment.assignment_id}`}
                        className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
                      >
                        <Play className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
                        Vazifani boşlaş
                      </Link>

                      <Link
                        href="/homework"
                        className="inline-flex min-h-12 items-center rounded-2xl bg-white/15 px-5 font-bold text-white ring-1 ring-white/25 transition hover:bg-white/25"
                      >
                        {pendingCount > 1
                          ? `Barça vazifalar (${pendingCount})`
                          : "Vazifalarim"}
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h1 className="mt-1.5 text-2xl font-bold leading-tight sm:text-4xl">
                      {isInGroup
                        ? "Hozirça uy vazifasi yöq"
                        : "Bugun nimadan boşlaymiz?"}
                    </h1>

                    <p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">
                      {isInGroup
                        ? "Yangi vazifa berilsa şu yerda çiqadi. Böş vaqtda test işlab, maşq qiling."
                        : "Test işlang yoki ustozingiz bergan kod bilan guruhga qöşiling."}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      <Link
                        href="/tests"
                        className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
                      >
                        <Play className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
                        Test işlaş
                      </Link>

                      {!isInGroup && (
                        <Link
                          href="/guruhim"
                          className="inline-flex min-h-12 items-center rounded-2xl bg-white/15 px-5 font-bold text-white ring-1 ring-white/25 transition hover:bg-white/25"
                        >
                          Guruhga qöşiliş
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-blue-100">
                  Vepa Ustoz platformasi
                </p>

                <h1 className="mt-1.5 text-2xl font-bold leading-tight sm:text-4xl">
                  Matematikani tuşunib örganing
                </h1>

                <p className="mt-2 max-w-lg text-sm leading-6 text-blue-100 sm:text-base">
                  Videodarslar, onlayn testlar va darslik masalalarining
                  batafsil yeçimlari — bir joyda.
                </p>

                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                  <Link
                    href="/auth/login"
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-6 font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
                  >
                    Bepul boşlaş
                  </Link>

                  <div className="sm:w-64">
                    <GoogleSignInButton compact className="w-full" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/*
          Takrorlash eslatmasi.

          Faqat bugun kutayotgan savol bo'lsa chiqadi — bo'sh
          karta ekranni band qilib turmasin.
        */}
        {dueReviewCount > 0 && (
          <Link
            href="/takrorlash"
            className="group relative mt-3 flex items-center gap-4 overflow-hidden rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm transition sm:p-5 sm:hover:-translate-y-0.5 sm:hover:shadow-md"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm sm:h-16 sm:w-16">
              <BrainCircuit
                className="h-7 w-7 sm:h-8 sm:w-8"
                strokeWidth={1.9}
                aria-hidden="true"
              />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-wide text-amber-700">
                Haftalik takrorlaş
              </span>

              <span className="mt-0.5 block text-lg font-bold leading-6 text-amber-950 sm:text-xl">
                {dueReviewCount} ta savol sizni kutyapti
              </span>

              <span className="mt-1 block text-sm text-amber-800">
                Xato qilgan savollaringiz — 5 daqiqada ulgurasiz.
              </span>
            </span>

            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white transition group-hover:bg-amber-600">
              <ArrowRight
                className="h-5 w-5"
                strokeWidth={2.4}
                aria-hidden="true"
              />
            </span>
          </Link>
        )}

        {/* Tezkor havolalar */}
        {isAuthenticated && (
          <div
            className={
              quickLinks.length === 4
                ? "mt-4 grid grid-cols-4 gap-2 sm:mt-5 sm:gap-3"
                : "mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3"
            }
          >
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center gap-2 rounded-2xl border border-mb-line bg-white px-2 py-3.5 text-center shadow-sm transition sm:hover:-translate-y-0.5 sm:hover:shadow-md"
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${link.tone}`}
                >
                  <link.icon
                    className="h-5 w-5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </span>

                <span className="text-xs font-semibold leading-4 text-mb-ink">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/*
          Asosiy bo'limlar.

          Ohang guruhdan keladi: testlar ko'k, o'quv materiallari
          (videodars va darslik) sariq. Shu sababli ikkita material
          bo'limi bir-biriga yaqin turganini ko'rish mumkin.
        */}
        <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3">
          {[
            {
              href: testsHref,
              icon: ClipboardCheck,
              title: "Testlar",
              text: "Işlang — natija darrov çiqadi.",
              tone: accents.tests.tile,
              hover: "sm:hover:border-blue-300",
            },
            {
              href: lessonsHref,
              icon: MonitorPlay,
              title: "Videodarslar",
              text: "Mavzular böyiça ketma-ket.",
              tone: accents.content.tile,
              hover: "sm:hover:border-amber-300",
            },
            {
              href: textbooksHref,
              icon: BookOpen,
              title: "Darslik yeçimlari",
              text: "5–11-sinf va TOP kitoblar.",
              tone: accents.content.tile,
              hover: "sm:hover:border-amber-300",
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className={`group flex items-center gap-3.5 rounded-2xl border border-mb-line bg-white p-3.5 shadow-sm transition sm:p-4 sm:hover:-translate-y-0.5 sm:hover:shadow-md ${item.hover}`}
            >
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${item.tone}`}
              >
                <item.icon
                  className="h-6 w-6"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold leading-6 text-mb-ink">
                  {item.title}
                </span>

                <span className="mt-0.5 block text-sm text-mb-muted">
                  {item.text}
                </span>
              </span>

              <ArrowRight
                className="h-5 w-5 shrink-0 text-mb-muted transition-transform group-hover:translate-x-0.5"
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>

        {/*
          Mehmon uchun: kimning platformasi va ichida nima bor.

          O'quvchi ustoz uchun keladi, shuning uchun avval ustoz,
          keyin raqamlar va bo'lim nomlari. Bo'lim nomlari Google
          uchun ham foydali: sahifada haqiqiy matn paydo bo'ladi.
        */}
        {!isAuthenticated && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-mb-line bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-3">
                <BrandMark size={48} priority={false} className="h-12 w-12" />

                <div className="min-w-0">
                  <h2 className="text-[17px] font-bold text-mb-ink">
                    Vepa Kurbankliçev
                  </h2>
                  <p className="text-sm text-mb-muted">Matematika ustozi</p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Platformadagi har bir videodars, test va yeçimni ustozning
                özi tayyorlaydi. Guruh öquvçilari şu yerda uy vazifasini
                bajaradi, xatolarini köradi va reytingda bellaşadi.
              </p>

              <a
                href={`https://t.me/${TELEGRAM_CHANNEL_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <Send className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                Telegram kanal: @{TELEGRAM_CHANNEL_USERNAME}
              </a>
            </div>

            {catalog && (
              <div className="rounded-2xl border border-mb-line bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-[17px] font-bold text-mb-ink">
                  Platformada nima bor
                </h2>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    [catalog.testCount, "test"],
                    [catalog.lessonCount, "videodars"],
                    [catalog.textbookCount, "darslik"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-2 py-3">
                      <dt className="sr-only">{label}</dt>
                      <dd className="text-xl font-bold text-mb-brand">{value}</dd>
                      <dd className="text-xs font-semibold text-mb-muted">{label}</dd>
                    </div>
                  ))}
                </dl>

                {catalog.examTypes.length > 0 && (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    <b className="text-mb-ink">Testlar:</b>{" "}
                    {catalog.examTypes.join(", ")}.
                  </p>
                )}

                {catalog.lessonCategories.length > 0 && (
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    <b className="text-mb-ink">Videodarslar:</b>{" "}
                    {catalog.lessonCategories.slice(0, 8).join(", ")}
                    {catalog.lessonCategories.length > 8 ? " va boşqalar" : ""}.
                  </p>
                )}

                <Link
                  href="/pricing"
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
                >
                  Tariflar va narxlar
                  <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <Link
            href="/admin"
            className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3.5 transition sm:hover:bg-blue-100"
          >
            <span>
              <span className="block font-bold text-blue-900">
                Admin panel
              </span>

              <span className="mt-0.5 block text-sm text-blue-700">
                Testlar, darslar, guruhlar va yeçimlarni boşqariş.
              </span>
            </span>

            <ArrowRight
              className="h-5 w-5 shrink-0 text-blue-600"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </Link>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Vepa Ustoz</p>
          <p>Matematika ta’lim platformasi</p>
        </div>
      </footer>
    </main>
  );
}
