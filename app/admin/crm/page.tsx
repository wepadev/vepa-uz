import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Clock,
  Coins,
  Users,
} from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import SubmitButton from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { createCrmGroup } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guruhlar",
  description:
    "Uy vazifasi, davomat, ball va sovg'a do'koni — bitta joyda.",
};

type PageProps = {
  searchParams: Promise<{
    xato?: string | string[];
  }>;
};

type GroupRow = {
  crm_group_id: number;
  study_group_id: number | null;
  title: string;
  is_active: boolean;
  join_code: string | null;
  student_count: number;
  lesson_count: number;
  assignment_count: number;
  last_lesson: string | null;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "hali dars yo‘q";

  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default async function CrmPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMessage = single(params.xato);

  const supabase = await createClient();

  const [overviewResult, pendingResult] = await Promise.all([
    supabase.rpc("group_overview"),
    supabase.rpc("pending_redemption_count"),
  ]);

  const { data, error } = overviewResult;

  /* Kutayotgan sovg'a so'rovlari — ustoz ko'zdan qochirmasin */
  const pendingCount = Number(pendingResult.data) || 0;

  /* db/17 hali ishga tushirilmagan bo'lsa sahifa buzilmasin */
  const migrationMissing = Boolean(error);

  const groups = (data ?? []) as GroupRow[];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold sm:text-3xl">Guruhlar</h1>

        <p className="mt-2 text-sm leading-6 text-mb-muted sm:text-base">
          Har bir guruh bitta joyda: saytdagi uy vazifalari, darsdagi
          davomat va xulq, ball va sovg‘a do‘koni. O‘quvchi bitta kod
          bilan qo‘shiladi.
        </p>

        {migrationMissing && (
          <AppAlert
            variant="warning"
            title="Bo‘lim tayyor emas"
            className="mt-5"
          >
            Supabase’da <b>db/17</b> dan <b>db/21</b> gacha bo‘lgan
            fayllarni ishga tushiring.
          </AppAlert>
        )}

        {errorMessage && (
          <AppAlert
            variant="error"
            title="Bajarilmadi"
            className="mt-4"
          >
            {errorMessage}
          </AppAlert>
        )}

        {/*
          Sovg'a so'rovlari.

          O'quvchi do'kondan sovg'a tanlaganda tangasi darhol ushlab
          qolinadi va so'rov shu yerda paydo bo'ladi. Telegramga ham
          xabar ketadi — ikkalasi bir-birini to'ldiradi.
        */}
        {pendingCount > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="inline-flex items-center gap-2 font-bold text-amber-900">
              <Clock
                className="h-5 w-5"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              {pendingCount} ta sovg‘a so‘rovi topshirishni kutmoqda
            </p>

            <span className="text-xs text-amber-700">
              Guruhni ochib, <b>Sovg‘a do‘koni</b> bo‘limida
              tasdiqlang.
            </span>
          </div>
        )}

        <form
          action={createCrmGroup}
          className="mt-6 rounded-2xl border border-mb-line bg-white p-4 shadow-sm sm:p-5"
        >
          <label
            htmlFor="title"
            className="text-sm font-semibold text-slate-700"
          >
            Yangi guruh nomi
          </label>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="title"
              name="title"
              required
              maxLength={80}
              placeholder="Masalan: Toq kunlar 18:00"
              className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
            />

            <SubmitButton className="min-h-12 rounded-xl bg-mb-brand px-6 font-semibold text-white transition hover:bg-mb-brandDark">
              Yaratish
            </SubmitButton>
          </div>
        </form>

        {groups.length === 0 ? (
          !migrationMissing && (
            <AppAlert
              variant="info"
              title="Hozircha guruh yo‘q"
              className="mt-6"
            >
              Birinchi guruhni yuqoridagi shakl orqali yarating, keyin
              o‘quvchilarni qo‘shasiz.
            </AppAlert>
          )
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <Link
                key={group.crm_group_id}
                href={`/admin/crm/guruh?id=${group.crm_group_id}`}
                className={cn(
                  "rounded-2xl border bg-white p-4 shadow-sm transition sm:hover:shadow-[0_8px_24px_rgba(16,24,40,0.10)]",
                  group.is_active
                    ? "border-mb-line"
                    : "border-slate-200 opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[17px] font-bold text-mb-ink">
                    {group.title}
                  </h2>

                  {!group.is_active && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                      Faol emas
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-mb-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Users
                      className="h-[15px] w-[15px]"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {group.student_count} ta o‘quvchi
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays
                      className="h-[15px] w-[15px]"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {group.lesson_count} ta dars
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <ClipboardList
                      className="h-[15px] w-[15px]"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {group.assignment_count} ta vazifa
                  </span>
                </div>

                <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-mb-muted">
                  <span>Oxirgi dars: {formatDate(group.last_lesson)}</span>

                  {group.join_code && (
                    <span className="rounded bg-mb-tintSoft px-2 py-0.5 font-mono font-bold tracking-widest text-mb-brand">
                      {group.join_code}
                    </span>
                  )}
                </p>
              </Link>
            ))}
          </div>
        )}

        {groups.length > 0 && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-mb-muted">
            <Coins className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Sovg‘a do‘koni har bir guruh sahifasidan ochiladi.
          </p>
        )}
      </section>
    </main>
  );
}
