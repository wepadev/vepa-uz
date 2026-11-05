import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, CheckCircle2 } from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import SubmitButton from "@/components/ui/submit-button";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { saveCrmDay } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dars varaqasi",
  description: "Davomat, xulq bahosi va uy vazifasi — bitta ekranda.",
};

type PageProps = {
  searchParams: Promise<{
    guruh?: string | string[];
    sana?: string | string[];
    xato?: string | string[];
    saqlandi?: string | string[];
  }>;
};

type SheetRow = {
  student_id: number;
  full_name: string;
  has_account: boolean;
  attendance: string;
  behavior: number | null;
  homework_done: number;
  bonus_points: number;
  note: string | null;
  points: number;
  coins: number;
};

const ATTENDANCE = [
  { value: "keldi", label: "Keldi" },
  { value: "kechikdi", label: "Keçikdi" },
  { value: "sababli", label: "Sababli" },
  { value: "kelmadi", label: "Kelmadi" },
] as const;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function todayInTashkent() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
  }).format(new Date());
}

/** YYYY-MM-DD ko'rinishidami? */
function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Sanani bir kun oldinga/orqaga surish */
function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export default async function CrmLessonPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groupId = Number(single(params.guruh));
  const errorMessage = single(params.xato);
  const justSaved = single(params.saqlandi) === "1";

  if (!Number.isInteger(groupId) || groupId <= 0) {
    notFound();
  }

  const requestedDate = single(params.sana) ?? "";

  const date = isValidDate(requestedDate)
    ? requestedDate
    : todayInTashkent();

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) redirect("/auth/login");

  const { data: group } = await supabase
    .from("crm_groups")
    .select("id, title")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) notFound();

  const [sheetResult, lessonResult, historyResult] = await Promise.all([
    supabase.rpc("crm_day_sheet", {
      p_group_id: groupId,
      p_date: date,
    }),

    supabase
      .from("crm_lessons")
      .select("topic")
      .eq("group_id", groupId)
      .eq("lesson_date", date)
      .maybeSingle(),

    /*
     * Guruhning o'tgan darslari. Guruh har kuni yig'ilmaydi,
     * shuning uchun "oldingi kun" tugmasi bo'sh kunga emas,
     * aynan oldingi DARSGA olib boradi.
     */
    supabase
      .from("crm_lessons")
      .select("lesson_date")
      .eq("group_id", groupId)
      .order("lesson_date", { ascending: false })
      .limit(60),
  ]);

  const rows = (sheetResult.data ?? []) as SheetRow[];
  const topic = (lessonResult.data?.topic as string | null) ?? "";

  const savedCount = rows.filter((row) => row.points > 0).length;

  const lessonDates = (
    (historyResult.data ?? []) as Array<{ lesson_date: string }>
  ).map((row) => String(row.lesson_date).slice(0, 10));

  /* Shu kunga ball yozilganmi */
  const dayIsSaved = lessonDates.includes(date);

  const previousLesson =
    lessonDates.find((value) => value < date) ?? shiftDate(date, -1);

  const nextLesson =
    [...lessonDates].reverse().find((value) => value > date) ??
    shiftDate(date, 1);

  const dayHref = (nextDate: string) =>
    `/admin/crm/dars?guruh=${groupId}&sana=${nextDate}`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
        <Link
          href={`/admin/crm/guruh?id=${groupId}`}
          className="inline-flex min-h-8 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
        >
          ← {group.title}
        </Link>

        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <CalendarDays
            className="h-6 w-6 text-mb-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          Dars varaqasi
        </h1>

        {/* Sana tanlash */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={dayHref(previousLesson)}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ← Oldingi kun
          </Link>

          <form method="get" className="flex items-center gap-2">
            <input type="hidden" name="guruh" value={groupId} />

            <label htmlFor="sana" className="sr-only">
              Dars sanasi
            </label>

            <input
              id="sana"
              name="sana"
              type="date"
              defaultValue={date}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-semibold outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
            />

            <SubmitButton className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Oçiş
            </SubmitButton>
          </form>

          <Link
            href={dayHref(nextLesson)}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Keyingi kun →
          </Link>
        </div>

        {/* Oxirgi darslar — bir bosishda o'tish uchun */}
        {lessonDates.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lessonDates.slice(0, 8).map((value) => (
              <Link
                key={value}
                href={dayHref(value)}
                className={
                  value === date
                    ? "rounded-lg bg-mb-brand px-2.5 py-1 text-xs font-bold text-white"
                    : "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                }
              >
                {value.slice(8, 10)}.{value.slice(5, 7)}
              </Link>
            ))}
          </div>
        )}

        {dayIsSaved && !justSaved && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            Bu kunga ball yozilgan. Saqlasangiz ustiga yoziladi —
            ball qöşilib ketmaydi.
          </p>
        )}

        {justSaved && (
          <AppAlert variant="success" title="Saqlandi" className="mt-4">
            {savedCount} ta öquvçining ballari yozildi.
          </AppAlert>
        )}

        {errorMessage && (
          <AppAlert variant="error" title="Bajarilmadi" className="mt-4">
            {errorMessage}
          </AppAlert>
        )}

        {rows.length === 0 ? (
          <AppAlert variant="info" title="Öquvçi yöq" className="mt-5">
            Bu guruhda faol öquvçi yöq.{" "}
            <Link
              href={`/admin/crm/guruh?id=${groupId}`}
              className="font-semibold text-mb-brand hover:underline"
            >
              Öquvçi qöşiş
            </Link>
          </AppAlert>
        ) : (
          <form action={saveCrmDay} className="mt-5">
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="date" value={date} />
            <input
              type="hidden"
              name="studentIds"
              value={rows.map((row) => row.student_id).join(",")}
            />

            <div className="rounded-2xl border border-mb-line bg-white p-4 shadow-sm">
              <label
                htmlFor="topic"
                className="block text-xs font-semibold text-slate-600"
              >
                Dars mavzusi (ixtiyoriy)
              </label>

              <input
                id="topic"
                name="topic"
                defaultValue={topic}
                maxLength={120}
                placeholder="Masalan: Kvadrat tenglamalar"
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="mt-3 space-y-3">
              {rows.map((row) => (
                <div
                  key={row.student_id}
                  className="rounded-2xl border border-mb-line bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[15px] font-bold text-mb-ink">
                      {row.full_name}
                    </p>

                    {row.points > 0 && (
                      <p className="shrink-0 whitespace-nowrap text-sm font-bold text-mb-brand">
                        {row.points} ball
                        <span className="ml-1.5 font-semibold text-amber-600">
                          {row.coins} tanga
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Davomat */}
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {ATTENDANCE.map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-xs font-semibold transition",
                          "border-slate-200 bg-white text-slate-600",
                          "has-[:checked]:border-mb-brand has-[:checked]:bg-mb-tintSoft has-[:checked]:text-mb-brand",
                        )}
                      >
                        <input
                          type="radio"
                          name={`holat_${row.student_id}`}
                          value={option.value}
                          defaultChecked={row.attendance === option.value}
                          className="sr-only"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>

                  {/* Xulq va uy vazifasi */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`xulq_${row.student_id}`}
                        className="block text-xs font-semibold text-slate-600"
                      >
                        Xulq (1–5)
                      </label>

                      <select
                        id={`xulq_${row.student_id}`}
                        name={`xulq_${row.student_id}`}
                        defaultValue={
                          row.behavior === null ? "" : String(row.behavior)
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="">—</option>
                        <option value="5">5 — a’lo</option>
                        <option value="4">4 — yaxşi</option>
                        <option value="3">3 — örtaça</option>
                        <option value="2">2 — sust</option>
                        <option value="1">1 — yomon</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`vazifa_${row.student_id}`}
                        className="block text-xs font-semibold text-slate-600"
                      >
                        Uy vazifasi — neçta işladi
                      </label>

                      <input
                        id={`vazifa_${row.student_id}`}
                        name={`vazifa_${row.student_id}`}
                        type="number"
                        min={0}
                        max={300}
                        inputMode="numeric"
                        defaultValue={row.homework_done}
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer list-none text-xs font-semibold text-mb-brand">
                      Qöşimça ball va izoh
                    </summary>

                    <div className="mt-2 grid gap-3 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor={`bonus_${row.student_id}`}
                          className="block text-xs font-semibold text-slate-600"
                        >
                          Qöşimça ball
                        </label>

                        <input
                          id={`bonus_${row.student_id}`}
                          name={`bonus_${row.student_id}`}
                          type="number"
                          min={-50}
                          max={50}
                          defaultValue={row.bonus_points}
                          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`izoh_${row.student_id}`}
                          className="block text-xs font-semibold text-slate-600"
                        >
                          Izoh
                        </label>

                        <input
                          id={`izoh_${row.student_id}`}
                          name={`izoh_${row.student_id}`}
                          defaultValue={row.note ?? ""}
                          maxLength={200}
                          placeholder="Doskaga çiqdi, yordam berdi..."
                          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>

            {/*
              Saqlash tugmasi pastda "yopishib" turadi — 20 ta o'quvchi
              bo'lganda har safar pastga tushish shart emas.
            */}
            <div className="sticky bottom-16 z-20 mt-4 rounded-2xl border border-mb-line bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-4">
              <SubmitButton
                pendingLabel="Saqlanmoqda..."
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark"
              >
                <CheckCircle2
                  className="h-5 w-5"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                Kunni saqlaş ({rows.length} öquvçi)
              </SubmitButton>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
