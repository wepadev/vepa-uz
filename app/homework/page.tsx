import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Coins,
  ListChecks,
  Lock,
  Users,
} from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import { formatDue, remainingLabel } from "@/lib/due-label";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Uy vazifalarim",
  description:
    "Guruhingizga berilgan vazifalar va muddatlari.",
};

type PageProps = {
  searchParams: Promise<{
    xato?: string | string[];
  }>;
};

type MembershipRow = {
  group_id: number;
  study_groups: {
    id: number;
    title: string;
    is_active: boolean;
  } | null;
};

type AssignmentRow = {
  assignment_id: number;
  group_id: number;
  group_title: string;
  test_id: number;
  test_title: string;
  time_limit_minutes: number | null;
  question_count: number;
  due_at: string;
  is_overdue: boolean;
  attempt_id: string | null;
  completed_at: string | null;
  percentage: number | string | null;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomeworkPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const errorMessage = single(params.xato);

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  /*
   * Tashlab ketilgan sessiyalarni yopamiz: o'quvchi testni boshlab,
   * brauzerni yopgan bo'lsa — 0 ballik urinish yoziladi va vazifa
   * "bajarilgan" deb ko'rinadi. Aks holda savollarni ko'rib, qaytadan
   * boshlash mumkin bo'lardi.
   */
  await supabase.rpc("close_abandoned_sessions");

  /*
   * Bajarilgan vazifalar uchun tanga yozamiz va balansni o'qiymiz.
   *
   * db/20 hali ishga tushirilmagan bo'lsa xato qaytadi — u holda
   * karta umuman ko'rsatilmaydi va sahifa avvalgidek ishlaydi.
   */
  await supabase.rpc("award_online_coins");

  const { data: balanceData } = await supabase.rpc("my_coin_balance");

  const balance = (
    Array.isArray(balanceData) ? balanceData[0] : balanceData
  ) as { available_coins: number | string } | null;

  const availableCoins = Number(balance?.available_coins) || 0;

  const [membershipResult, assignmentResult] = await Promise.all([
    supabase
      .from("study_group_members")
      .select("group_id, study_groups(id, title, is_active)")
      .eq("user_id", user.id),

    supabase.rpc("my_assignments"),
  ]);

  if (membershipResult.error) {
    throw new Error(
      `Guruhlar yuklanmadi: ${membershipResult.error.message}`,
    );
  }

  if (assignmentResult.error) {
    throw new Error(
      `Vazifalar yuklanmadi: ${assignmentResult.error.message}`,
    );
  }

  const memberships = (membershipResult.data ??
    []) as unknown as MembershipRow[];

  const assignments = (assignmentResult.data ??
    []) as AssignmentRow[];

  const pending = assignments.filter((a) => !a.completed_at);
  const done = assignments.filter((a) => a.completed_at);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader backHref="/" backLabel="Boş sahifa" title="Uy vazifalarim" width="3xl" />

      <section className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-10">
        {errorMessage && (
          <AppAlert variant="error" title="Xatolik" className="mb-5">
            {errorMessage}
          </AppAlert>
        )}

        {/*
          Tanga balansi.

          Vazifa bajarilgach tanga yig'iladi, shuning uchun karta shu
          sahifada turgani mantiqiy. Nol bo'lsa ham ko'rsatiladi —
          o'quvchi tanga borligini bilib qo'ysin.
        */}
        <Link
          href="/guruhim"
          className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 transition sm:hover:bg-amber-100"
        >
          <Coins
            className="h-8 w-8 shrink-0 text-amber-600"
            strokeWidth={1.9}
            aria-hidden="true"
          />

          <span className="min-w-0 flex-1">
            <span className="block font-bold text-amber-900">
              {availableCoins} tanga
            </span>

            <span className="mt-0.5 block text-sm leading-5 text-amber-700">
              Vazifani bajarsangiz tanga yiğasiz — sovğaga
              almaştiring
            </span>
          </span>

          <span aria-hidden="true" className="shrink-0 text-amber-600">
            ›
          </span>
        </Link>

        {/* Bajarilmagan vazifalar */}
        {pending.length > 0 && (
          <div className="mb-6 grid gap-3">
            {pending.map((item) => {
              const locked = item.is_overdue;

              return (
                <article
                  key={item.assignment_id}
                  className={cn(
                    "rounded-2xl border bg-white p-4 shadow-sm",
                    locked
                      ? "border-slate-200 opacity-80"
                      : "border-mb-line",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-mb-tintSoft px-2.5 py-1 text-xs font-semibold text-mb-brand">
                      {item.group_title}
                    </span>

                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        locked
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700",
                      )}
                    >
                      <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      {remainingLabel(item.due_at)}
                    </span>
                  </div>

                  <h2 className="mt-2.5 text-[17px] font-bold leading-snug text-mb-ink">
                    {item.test_title}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-mb-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <ListChecks className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden="true" />
                      {item.question_count} ta savol
                    </span>

                    {item.time_limit_minutes ? (
                      <span>{item.time_limit_minutes} daqiqa</span>
                    ) : null}

                    <span>Muddat: {formatDue(item.due_at)}</span>
                  </div>

                  <div className="mt-3 border-t border-mb-line pt-3">
                    {locked ? (
                      <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-500">
                        <Lock className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                        Muddat tugagan
                      </span>
                    ) : (
                      <Link
                        href={`/tests/take?testId=${item.test_id}&assignmentId=${item.assignment_id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mb-brand px-5 text-sm font-bold text-white transition hover:bg-mb-brandDark"
                      >
                        Boşlaş
                      </Link>
                    )}
                  </div>

                  {!locked && (
                    <p className="mt-2 text-xs text-mb-muted">
                      Diqqat: vazifa faqat bir marta işlanadi.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Bajarilganlar */}
        {done.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-mb-muted">
              Bajarilgan
            </h2>

            <div className="mt-2 grid gap-2">
              {done.map((item) => (
                <Link
                  key={item.assignment_id}
                  href={`/results/view?attemptId=${item.attempt_id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-mb-line bg-white px-4 py-3 shadow-sm transition sm:hover:shadow-[0_6px_20px_rgba(16,24,40,0.08)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-mb-ink">
                      {item.test_title}
                    </p>
                    <p className="text-xs text-mb-muted">
                      {item.group_title}
                    </p>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                    {Math.round(Number(item.percentage ?? 0))}%
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {memberships.length > 0 && assignments.length === 0 && (
          <AppAlert
            variant="info"
            title="Hozirça vazifa yöq"
            className="mb-6"
          >
            Ustozingiz vazifa berganda şu yerda körinadi.
          </AppAlert>
        )}

        {/*
          Guruhga qo'shilish bu yerda emas.

          Ilgari ikkita joyda kod so'ralardi — bu sahifada va
          "Guruhim" da. O'quvchi bir marta qo'shilsa yetarli, shuning
          uchun kod maydoni bitta joyda qoldi.
        */}
        {memberships.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center sm:px-6">
            <Users
              className="mx-auto h-10 w-10 text-mb-muted"
              strokeWidth={1.6}
              aria-hidden="true"
            />

            <h2 className="mt-4 text-lg font-bold">
              Hali guruhga qöşilmagansiz
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-mb-muted">
              Ustozingiz bergan kodni bir marta kiritsangiz yetarli —
              uy vazifalari ham, ballaringiz ham oçiladi.
            </p>

            <Link
              href="/guruhim"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark"
            >
              Guruhga qöşiliş
            </Link>
          </div>
        )}

        {memberships.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-mb-muted">
              <Users className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Guruhlarim:
            </span>

            {memberships.map((membership) => {
              const group = membership.study_groups;

              if (!group) return null;

              return (
                <span
                  key={membership.group_id}
                  className="rounded-full border border-mb-line bg-white px-3 py-1.5 text-sm font-semibold text-mb-ink"
                >
                  {group.title}
                </span>
              );
            })}
          </div>
        )}

      </section>
    </main>
  );
}
