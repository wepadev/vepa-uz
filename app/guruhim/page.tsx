import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  Coins,
  ListChecks,
  ShoppingBag,
  Trophy,
  Users,
} from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import JoinGroupButton from "@/components/join-group-button";
import LessonHistory, {
  type LessonHistoryRow,
} from "@/components/lesson-history";
import PageHeader from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { joinGroupAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guruhim",
  description:
    "Ballaringiz, tangalaringiz, dars tarixi va guruh reytingi.",
};

type PageProps = {
  searchParams: Promise<{
    guruh?: string | string[];
    xato?: string | string[];
    xabar?: string | string[];
  }>;
};

type GroupRow = {
  crm_group_id: number;
  study_group_id: number | null;
  title: string;
  my_points: number;
  my_coins: number;
  my_rank: number;
  member_count: number;
  lesson_count: number;
};

type HistoryRow = LessonHistoryRow;

type LeaderRow = {
  student_id: number;
  full_name: string;
  points: number;
  coins: number;
  place: number;
  is_me: boolean;
};

type AssignmentRow = {
  assignment_id: number;
  group_id: number;
  test_title: string;
  due_at: string;
  is_overdue: boolean;
  completed_at: string | null;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

function medal(position: number) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";

  return String(position);
}

export default async function MyGroupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMessage = single(params.xato);
  const infoMessage = single(params.xabar);

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  /* Onlayn vazifalardan tanga yig'amiz, keyin balansni o'qiymiz */
  const awardResult = await supabase.rpc("award_online_coins");

  const migrationMissing = Boolean(awardResult.error);

  const [groupResult, balanceResult] = migrationMissing
    ? [{ data: null }, { data: null }]
    : await Promise.all([
        supabase.rpc("my_groups"),
        supabase.rpc("my_coin_balance"),
      ]);

  const groups = (groupResult.data ?? []) as GroupRow[];

  const balance = (
    Array.isArray(balanceResult.data)
      ? balanceResult.data[0]
      : balanceResult.data
  ) as { available_coins: number | string } | null;

  const availableCoins = toNumber(balance?.available_coins);

  /* Qaysi guruh ochilgan — birinchisi standart */
  const requested = Number(single(params.guruh));

  const active =
    groups.find((row) => row.crm_group_id === requested) ??
    groups[0] ??
    null;

  let history: HistoryRow[] = [];
  let leaderboard: LeaderRow[] = [];
  let assignments: AssignmentRow[] = [];

  if (active) {
    const [historyResult, leaderResult, assignmentResult] =
      await Promise.all([
        supabase.rpc("my_lesson_history", {
          p_group_id: active.crm_group_id,
        }),

        supabase.rpc("my_group_leaderboard", {
          p_group_id: active.crm_group_id,
        }),

        supabase.rpc("my_assignments"),
      ]);

    history = (historyResult.data ?? []) as HistoryRow[];
    leaderboard = (leaderResult.data ?? []) as LeaderRow[];

    /*
     * Uy vazifasi faqat shu guruhga tegishlisi va hali
     * bajarilmagani ko'rsatiladi. Bo'lmasa bo'lim umuman
     * chiqmaydi — bo'sh sarlavha ekranni band qilmasin.
     */
    assignments = ((assignmentResult.data ?? []) as AssignmentRow[]).filter(
      (row) =>
        !row.completed_at &&
        !row.is_overdue &&
        active.study_group_id !== null &&
        Number(row.group_id) === Number(active.study_group_id),
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        title="Guruhim"
        subtitle={active?.title ?? null}
      />

      <section className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">

        {migrationMissing && (
          <AppAlert
            variant="warning"
            title="Bölim tayyor emas"
            className="mt-5"
          >
            Bu bölim hali sozlanmoqda. Keyinroq qayta kiring.
          </AppAlert>
        )}

        {infoMessage && (
          <AppAlert variant="success" title="Bajarildi" className="mt-4">
            {infoMessage}
          </AppAlert>
        )}

        {errorMessage && (
          <AppAlert variant="error" title="Bajarilmadi" className="mt-4">
            {errorMessage}
          </AppAlert>
        )}

        {/* Guruhga qo'shilmagan holat */}
        {!migrationMissing && groups.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center sm:px-6">
            <Users
              className="mx-auto h-10 w-10 text-mb-muted"
              strokeWidth={1.6}
              aria-hidden="true"
            />

            <h2 className="mt-4 text-lg font-bold">
              Hali guruhga qöşilmagansiz
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-mb-muted">
              Ustozingiz bergan 6 belgili kodni kiriting. Şundan
              keyin uy vazifalari, ballaringiz va tangalaringiz şu
              yerda körinadi.
            </p>

            <div className="mx-auto mt-5 max-w-md text-left">
              <JoinGroupButton
                action={joinGroupAction}
                label="Kodni kiritiş"
              />
            </div>
          </div>
        )}

        {active && (
          <>
            {/* Tanga va do'kon */}
            <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Sizdagi tangalar
                </p>

                <p className="mt-1 flex items-center gap-2 text-4xl font-bold text-amber-600">
                  <Coins
                    className="h-9 w-9"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {availableCoins}
                </p>
              </div>

              <Link
                href="/dokon"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-6 font-bold text-white transition hover:bg-amber-700"
              >
                <ShoppingBag
                  className="h-5 w-5"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                Dökon
              </Link>
            </div>

            {/* Guruh tanlash — bir nechta guruhda bo'lsa */}
            {groups.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {groups.map((row) => (
                  <Link
                    key={row.crm_group_id}
                    href={`/guruhim?guruh=${row.crm_group_id}`}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-semibold transition",
                      row.crm_group_id === active.crm_group_id
                        ? "border-mb-brand bg-mb-tintSoft text-mb-brand"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {row.title}
                  </Link>
                ))}
              </div>
            )}

            {/* Mening o'rnim */}
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-muted sm:text-xs">
                  Örningiz
                </p>
                <p className="mt-1 text-lg font-bold text-mb-brand sm:text-2xl">
                  {active.my_rank}
                  <span className="text-sm font-semibold text-mb-muted">
                    /{active.member_count}
                  </span>
                </p>
              </div>

              <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-muted sm:text-xs">
                  Ballaringiz
                </p>
                <p className="mt-1 text-lg font-bold text-mb-ink sm:text-2xl">
                  {active.my_points}
                </p>
              </div>

              <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-muted sm:text-xs">
                  Yiğgan tanga
                </p>
                <p className="mt-1 text-lg font-bold text-amber-600 sm:text-2xl">
                  {active.my_coins}
                </p>
              </div>
            </div>

            {/* Uy vazifasi — faqat bo'lsa */}
            {assignments.length > 0 && (
              <>
                <h2 className="mt-8 flex items-center gap-2 text-lg font-bold">
                  <ListChecks
                    className="h-5 w-5 text-mb-muted"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  Bajarilmagan uy vazifalari
                </h2>

                <div className="mt-3 space-y-2">
                  {assignments.map((row) => (
                    <Link
                      key={row.assignment_id}
                      href={`/homework`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-mb-line bg-white px-4 py-3 shadow-sm transition sm:hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-mb-ink">
                          {row.test_title}
                        </p>

                        <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-mb-muted">
                          <CalendarClock
                            className="h-3.5 w-3.5"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          Muddat: {formatDate(row.due_at)}
                        </p>
                      </div>

                      <span
                        aria-hidden="true"
                        className="shrink-0 text-mb-muted"
                      >
                        ›
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* Guruh reytingi */}
            <h2 className="mt-8 flex items-center gap-2 text-lg font-bold">
              <Trophy
                className="h-5 w-5 text-mb-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              Guruh reytingi
            </h2>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              {leaderboard.map((row, index) => (
                <div
                  key={row.student_id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    index > 0 && "border-t border-mb-line",
                    row.is_me && "bg-mb-tintSoft",
                  )}
                >
                  <span className="w-7 shrink-0 text-center text-lg font-bold">
                    {medal(row.place)}
                  </span>

                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-mb-ink">
                    {row.full_name}

                    {row.is_me && (
                      <span className="ml-2 rounded-full bg-mb-brand px-2 py-0.5 text-[10px] font-bold text-white">
                        Siz
                      </span>
                    )}
                  </p>

                  <div className="shrink-0 text-right">
                    <p className="whitespace-nowrap text-[15px] font-bold text-mb-brand">
                      {row.points} ball
                    </p>

                    <p className="whitespace-nowrap text-xs font-semibold text-amber-600">
                      {row.coins} tanga
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Dars tarixim */}
            <h2 className="mt-8 flex items-center gap-2 text-lg font-bold">
              <CalendarDays
                className="h-5 w-5 text-mb-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              Dars tarixim
            </h2>

            {history.length === 0 ? (
              <AppAlert variant="info" title="Hali dars yöq" className="mt-3">
                Ustoz dars varaqasini töldirgaç, ballaringiz şu
                yerda paydo böladi.
              </AppAlert>
            ) : (
              <div className="mt-3">
                <LessonHistory rows={history} />
              </div>
            )}

            {/* Boshqa guruhga qo'shilish */}
            <div className="mt-6">
              <JoinGroupButton action={joinGroupAction} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
