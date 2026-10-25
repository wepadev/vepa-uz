import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Coins,
  KeyRound,
  Link2,
  Merge,
  Settings2,
  Trash2,
  TrendingUp,
  Trophy,
  UserPlus,
} from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import SubmitButton from "@/components/ui/submit-button";
import { remainingLabel } from "@/lib/due-label";
import { parentReportUrl } from "@/lib/parent-link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import {
  addCrmStudent,
  deleteCrmGroup,
  mergeCrmStudents,
  removeCrmStudent,
  saveCrmRules,
  updateCrmGroup,
  updateCrmStudent,
} from "../actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guruh",
  description: "O‘quvchilar, ballar reytingi va ball qoidalari.",
};

type PageProps = {
  searchParams: Promise<{
    id?: string | string[];
    xato?: string | string[];
  }>;
};

type RankingRow = {
  student_id: number;
  full_name: string;
  has_account: boolean;
  total_points: number;
  earned_coins: number;
  lessons_count: number;
  present_count: number;
  homework_done: number;
  homework_total: number;
  avg_behavior: number | string | null;
};

/**
 * Tanga balansi — do'kon sahifasi bilan bitta manbadan.
 *
 * Reytingdagi `earned_coins` faqat yig'ilgan tangani ko'rsatardi:
 * sovg'a berilsa ham kamaymasdi. Shuning uchun reytingda ham
 * do'kondagi "mavjud" tangani ko'rsatamiz.
 */
type BalanceRow = {
  student_id: number;
  earned_coins: number;
  spent_coins: number;
  available_coins: number;
};

type StudentRow = {
  id: number;
  full_name: string;
  phone: string | null;
  user_id: string | null;
};

type RulesRow = {
  present_points: number;
  late_points: number;
  excused_points: number;
  absent_points: number;
  behavior_points: number;
  homework_item_points: number;
  coins_per_points: number;
};

const DEFAULT_RULES: RulesRow = {
  present_points: 10,
  late_points: 5,
  excused_points: 2,
  absent_points: 0,
  behavior_points: 2,
  homework_item_points: 2,
  coins_per_points: 10,
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Bugungi sana — Toshkent vaqti bo'yicha, YYYY-MM-DD */
function todayInTashkent() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
  }).format(new Date());
}

function medal(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";

  return String(index + 1);
}

/** Bitta qoida maydoni */
function RuleField({
  name,
  label,
  value,
  hint,
}: {
  name: string;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-semibold text-slate-600"
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type="number"
        defaultValue={value}
        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
      />

      {hint && (
        <p className="mt-1 text-[11px] leading-4 text-mb-muted">{hint}</p>
      )}
    </div>
  );
}

export default async function CrmGroupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groupId = Number(single(params.id));
  const errorMessage = single(params.xato);

  if (!Number.isInteger(groupId) || groupId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: group } = await supabase
    .from("crm_groups")
    .select("id, title, is_active, join_code, study_group_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) notFound();

  const [
    rankingResult,
    balanceResult,
    studentsResult,
    rulesResult,
    assignmentsResult,
  ] =
    await Promise.all([
      supabase.rpc("crm_group_ranking", { p_group_id: groupId }),

      supabase.rpc("crm_group_balances", { p_group_id: groupId }),

      supabase
        .from("crm_students")
        .select("id, full_name, phone, user_id")
        .eq("group_id", groupId)
        .eq("is_active", true)
        .order("full_name", { ascending: true }),

      supabase
        .from("crm_point_rules")
        .select("*")
        .eq("group_id", groupId)
        .maybeSingle(),

      /*
       * Uy vazifalari ham shu sahifada ko'rinsin: ilgari ular faqat
       * alohida sahifada edi va guruh ikki joyga bo'linib qolgandi.
       */
      group.study_group_id
        ? supabase
            .from("assignments")
            .select("id, due_at, is_active, tests(title)")
            .eq("group_id", group.study_group_id)
            .eq("is_active", true)
            .order("due_at", { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const ranking = (rankingResult.data ?? []) as RankingRow[];
  const students = (studentsResult.data ?? []) as StudentRow[];
  const rules = (rulesResult.data as RulesRow | null) ?? DEFAULT_RULES;

  /*
   * O'quvchi id -> mavjud tanga. Do'kon RPC'si ishlamasa (masalan
   * eski ma'lumotlar bazasi) reyting hamon chiqadi: bunda yig'ilgan
   * tangani ko'rsatamiz, sahifa xato bermaydi.
   */
  const availableCoins = new Map<number, number>(
    ((balanceResult.data ?? []) as BalanceRow[]).map(
      (row) => [row.student_id, row.available_coins] as const,
    ),
  );

  const today = todayInTashkent();

  const assignments = (assignmentsResult.data ?? []) as unknown as {
    id: number;
    due_at: string;
    tests: { title: string } | null;
  }[];

  const parentLinks = new Map(
    students.map((student) => [
      student.id,
      parentReportUrl(student.id),
    ] as const),
  );

  const totalPoints = ranking.reduce(
    (sum, row) => sum + row.total_points,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
        <Link
          href="/admin/crm"
          className="inline-flex min-h-8 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
        >
          ← Guruhlarga qaytish
        </Link>

        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          {group.title}
        </h1>

        {errorMessage && (
          <AppAlert variant="error" title="Diqqat" className="mt-4">
            {errorMessage}
          </AppAlert>
        )}

        {/* Qo'shilish kodi */}
        {group.join_code && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-mb-line bg-white px-4 py-3 shadow-sm">
            <KeyRound
              className="h-5 w-5 shrink-0 text-mb-muted"
              strokeWidth={2}
              aria-hidden="true"
            />

            <span className="rounded-lg bg-mb-tintSoft px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-mb-brand">
              {group.join_code}
            </span>

            <span className="text-xs leading-5 text-mb-muted">
              O‘quvchi <b>Guruhim</b> bo‘limida shu kodni kiritsa
              o‘zi qo‘shiladi. Bitta kod bilan uy vazifalari ham,
              dars ballari ham ochiladi.
            </span>
          </div>
        )}

        {/* Asosiy amallar */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/admin/crm/dars?guruh=${groupId}&sana=${today}`}
            className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 transition sm:hover:bg-blue-100"
          >
            <CalendarDays
              className="h-8 w-8 shrink-0 text-blue-600"
              strokeWidth={1.8}
              aria-hidden="true"
            />

            <span>
              <span className="block font-bold text-blue-900">
                Bugungi dars varaqasi
              </span>
              <span className="mt-0.5 block text-sm text-blue-700">
                Davomat, xulq, uy vazifasi
              </span>
            </span>
          </Link>

          {group.study_group_id && (
            <Link
              href={`/admin/groups/view?groupId=${group.study_group_id}`}
              className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 transition sm:hover:bg-blue-100"
            >
              <ClipboardList
                className="h-8 w-8 shrink-0 text-blue-600"
                strokeWidth={1.8}
                aria-hidden="true"
              />

              <span>
                <span className="block font-bold text-blue-900">
                  Vazifa berish
                </span>
                <span className="mt-0.5 block text-sm text-blue-700">
                  Saytdagi testni uy vazifasiga berish
                </span>
              </span>
            </Link>
          )}

          <Link
            href={`/admin/crm/tahlil?guruh=${groupId}`}
            className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 transition sm:hover:bg-emerald-100"
          >
            <TrendingUp
              className="h-8 w-8 shrink-0 text-emerald-600"
              strokeWidth={1.8}
              aria-hidden="true"
            />

            <span>
              <span className="block font-bold text-emerald-900">
                Ball tahlili
              </span>
              <span className="mt-0.5 block text-sm text-emerald-700">
                Qaysi kuni ball ko‘p bo‘lgan
              </span>
            </span>
          </Link>

          <Link
            href={`/admin/crm/dokon?guruh=${groupId}`}
            className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 transition sm:hover:bg-amber-100"
          >
            <Coins
              className="h-8 w-8 shrink-0 text-amber-600"
              strokeWidth={1.8}
              aria-hidden="true"
            />

            <span>
              <span className="block font-bold text-amber-900">
                Sovg‘a do‘koni
              </span>
              <span className="mt-0.5 block text-sm text-amber-700">
                Tangani sovg‘aga almashtirish
              </span>
            </span>
          </Link>

          {group.study_group_id && (
            <Link
              href={`/admin/groups/report?groupId=${group.study_group_id}`}
              className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 transition sm:hover:bg-emerald-100"
            >
              <BarChart3
                className="h-8 w-8 shrink-0 text-emerald-600"
                strokeWidth={1.8}
                aria-hidden="true"
              />

              <span>
                <span className="block font-bold text-emerald-900">
                  Hisobot va natijalar
                </span>
                <span className="mt-0.5 block text-sm text-emerald-700">
                  O‘quvchilar bo‘yicha yakun
                </span>
              </span>
            </Link>
          )}
        </div>

        {/* Uy vazifalari */}
        {group.study_group_id && (
          <>
            <div className="mt-8 flex items-center justify-between gap-3">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold">
                <ClipboardList
                  className="h-5 w-5 text-mb-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Uy vazifalari
              </h2>

              <Link
                href={`/admin/groups/view?groupId=${group.study_group_id}`}
                className="inline-flex min-h-10 items-center rounded-xl bg-mb-brand px-4 text-sm font-semibold text-white transition hover:bg-mb-brandDark"
              >
                Vazifa berish
              </Link>
            </div>

            {assignments.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-mb-line bg-white px-4 py-3 text-sm text-mb-muted">
                Faol vazifa yo‘q.
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
                {assignments.map((item, index) => {
                  const overdue = new Date(item.due_at).getTime() < Date.now();

                  return (
                    <Link
                      key={item.id}
                      href={`/admin/assignments/view?id=${item.id}`}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50",
                        index > 0 && "border-t border-mb-line",
                      )}
                    >
                      <span className="min-w-0 truncate text-[15px] font-semibold text-mb-ink">
                        {item.tests?.title ?? "Test"}
                      </span>

                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                          overdue
                            ? "bg-slate-100 text-slate-500"
                            : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {overdue ? "Tugagan" : remainingLabel(item.due_at)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Reyting */}
        <h2 className="mt-8 inline-flex items-center gap-2 text-lg font-bold">
          <Trophy
            className="h-5 w-5 text-mb-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          Reyting
        </h2>

        {ranking.length === 0 ? (
          <AppAlert variant="info" title="O‘quvchi yo‘q" className="mt-3">
            Pastdagi shakl orqali o‘quvchilarni qo‘shing.
          </AppAlert>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
            {ranking.map((row, index) => {
              const attendanceRate =
                row.lessons_count > 0
                  ? Math.round(
                      (row.present_count / row.lessons_count) * 100,
                    )
                  : 0;

              const share =
                totalPoints > 0
                  ? Math.round((row.total_points / totalPoints) * 100)
                  : 0;

              return (
                <div
                  key={row.student_id}
                  className={cn(
                    "px-4 py-3",
                    index > 0 && "border-t border-mb-line",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 shrink-0 text-center text-lg font-bold">
                      {medal(index)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-mb-ink">
                        {row.full_name}

                        {row.has_account && (
                          <Link2
                            className="ml-1.5 inline h-3.5 w-3.5 text-mb-brand"
                            strokeWidth={2.2}
                            aria-label="Sayt hisobiga bog‘langan"
                          />
                        )}
                      </p>

                      <p className="mt-0.5 text-xs text-mb-muted">
                        {row.lessons_count} dars · davomat{" "}
                        {attendanceRate}% · vazifa {row.homework_done}/
                        {row.homework_total}
                        {row.avg_behavior !== null && (
                          <> · xulq {row.avg_behavior}</>
                        )}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="whitespace-nowrap text-lg font-bold text-mb-brand">
                        {row.total_points}
                      </p>

                      <p className="whitespace-nowrap text-[11px] font-semibold text-amber-600">
                        {availableCoins.get(row.student_id) ??
                          row.earned_coins}{" "}
                        tanga
                      </p>
                    </div>
                  </div>

                  {row.total_points > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-mb-brand"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* O'quvchi qo'shish */}
        <h2 className="mt-8 inline-flex items-center gap-2 text-lg font-bold">
          <UserPlus
            className="h-5 w-5 text-mb-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          O‘quvchi qo‘shish
        </h2>

        <form
          action={addCrmStudent}
          className="mt-3 rounded-2xl border border-mb-line bg-white p-4 shadow-sm"
        >
          <input type="hidden" name="groupId" value={groupId} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="fullName"
              required
              maxLength={80}
              placeholder="Ism familiya"
              aria-label="Ism familiya"
              className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
            />

            <input
              name="phone"
              maxLength={30}
              placeholder="Telefon (ixtiyoriy)"
              aria-label="Telefon"
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100 sm:w-52"
            />

            <SubmitButton className="min-h-12 rounded-xl bg-mb-brand px-6 font-semibold text-white transition hover:bg-mb-brandDark">
              Qo‘shish
            </SubmitButton>
          </div>
        </form>

        {/* O'quvchilar ro'yxati */}
        {students.length > 0 && (
          <div className="mt-3 space-y-2">
            {students.map((student) => (
              <details
                key={student.id}
                className="overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm"
              >
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-mb-ink">
                  {student.full_name}

                  {student.user_id ? (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      sayt hisobi bor
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      faqat ro‘yxatda
                    </span>
                  )}
                </summary>

                <div className="border-t border-mb-line px-4 py-4">
                  <form action={updateCrmStudent} className="space-y-3">
                    <input type="hidden" name="groupId" value={groupId} />
                    <input
                      type="hidden"
                      name="studentId"
                      value={student.id}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`ism-${student.id}`}
                          className="block text-xs font-semibold text-slate-600"
                        >
                          Ism familiya
                        </label>

                        <input
                          id={`ism-${student.id}`}
                          name="fullName"
                          defaultValue={student.full_name}
                          required
                          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`tel-${student.id}`}
                          className="block text-xs font-semibold text-slate-600"
                        >
                          Telefon
                        </label>

                        <input
                          id={`tel-${student.id}`}
                          name="phone"
                          defaultValue={student.phone ?? ""}
                          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`email-${student.id}`}
                        className="block text-xs font-semibold text-slate-600"
                      >
                        Sayt hisobiga bog‘lash (email)
                      </label>

                      <input
                        id={`email-${student.id}`}
                        name="email"
                        type="email"
                        placeholder={
                          student.user_id
                            ? "Bog‘langan — o‘zgartirish uchun yangi email yozing"
                            : "O‘quvchining vepa.uz dagi emaili"
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                      />

                      <p className="mt-1 text-[11px] leading-4 text-mb-muted">
                        Bo‘sh qoldirsangiz bog‘lanish o‘zgarmaydi.
                        O‘quvchining saytda hisobi bo‘lmasa, bu joyni
                        umuman tashlab keting.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SubmitButton className="min-h-11 rounded-xl bg-mb-brand px-5 text-sm font-semibold text-white transition hover:bg-mb-brandDark">
                        Saqlash
                      </SubmitButton>
                    </div>
                  </form>

                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <label
                      htmlFor={`ota-ona-${student.id}`}
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Ota-onaga hisobot havolasi
                    </label>

                    <input
                      id={`ota-ona-${student.id}`}
                      readOnly
                      value={parentLinks.get(student.id) ?? ""}
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-700"
                    />

                    <p className="mt-1 text-[11px] leading-4 text-mb-muted">
                      Nusxalab Telegram&apos;da yuboring. Ota-ona kirishsiz
                      davomat, ball va uy vazifasi natijalarini ko‘radi.
                    </p>

                    <a
                      href={parentLinks.get(student.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex min-h-8 items-center text-xs font-semibold text-mb-brand hover:text-mb-brandDark"
                    >
                      Hisobotni ochish ›
                    </a>
                  </div>

                  <form action={removeCrmStudent} className="mt-3">
                    <input type="hidden" name="groupId" value={groupId} />
                    <input
                      type="hidden"
                      name="studentId"
                      value={student.id}
                    />

                    <SubmitButton className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                      <Trash2
                        className="h-3.5 w-3.5"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      Guruhdan chiqarish
                    </SubmitButton>

                    <p className="mt-1.5 text-[11px] leading-4 text-mb-muted">
                      Ballar tarixi saqlanadi — o‘quvchi shunchaki
                      ro‘yxatdan yashiriladi.
                    </p>
                  </form>
                </div>
              </details>
            ))}
          </div>
        )}

        {/* Dublikatlarni birlashtirish */}
        {students.length > 1 && (
          <details className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-mb-ink">
              <span className="inline-flex items-center gap-2">
                <Merge
                  className="h-4 w-4 text-mb-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Ikkita yozuvni birlashtirish
              </span>
            </summary>

            <div className="border-t border-mb-line px-4 py-4">
              <p className="text-sm leading-6 text-mb-muted">
                O‘quvchini qo‘lda kiritgan bo‘lsangiz va u keyin kod
                bilan o‘zi qo‘shilgan bo‘lsa, ikkita yozuv paydo
                bo‘ladi. Bu yerda ularni bittaga qo‘shasiz: darslar,
                ballar va sovg‘alar saqlanadigan yozuvga ko‘chadi.
              </p>

              <form action={mergeCrmStudents} className="mt-3">
                <input type="hidden" name="groupId" value={groupId} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="keepId"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Qaysi yozuv qolsin
                    </label>

                    <select
                      id="keepId"
                      name="keepId"
                      required
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Tanlang</option>

                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.full_name}
                          {student.user_id ? " (sayt hisobi bor)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="removeId"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Qaysi biri unga qo‘shilsin
                    </label>

                    <select
                      id="removeId"
                      name="removeId"
                      required
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Tanlang</option>

                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.full_name}
                          {student.user_id ? " (sayt hisobi bor)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="mt-2 text-[11px] leading-4 text-mb-muted">
                  Ikkinchi yozuv butunlay o‘chadi. Bir kunda ikkalasida
                  ham yozuv bo‘lsa, qoladiganiniki ustun turadi.
                </p>

                <SubmitButton className="mt-3 min-h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Birlashtirish
                </SubmitButton>
              </form>
            </div>
          </details>
        )}

        {/* Ball qoidalari */}
        <details className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-mb-ink">
            <span className="inline-flex items-center gap-2">
              <Settings2
                className="h-4 w-4 text-mb-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              Ball qoidalari
            </span>
          </summary>

          <div className="border-t border-mb-line px-4 py-4">
            <p className="text-sm leading-6 text-mb-muted">
              Qoida o‘zgartirilsa faqat <b>keyingi</b> darslarga
              qo‘llanadi. O‘tgan kunlarning ballari o‘zgarmaydi — aks
              holda reyting to‘satdan qayta hisoblanib ketardi.
            </p>

            <form action={saveCrmRules} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} />

              <div className="grid gap-3 sm:grid-cols-4">
                <RuleField
                  name="presentPoints"
                  label="Keldi"
                  value={rules.present_points}
                />
                <RuleField
                  name="latePoints"
                  label="Kechikdi"
                  value={rules.late_points}
                />
                <RuleField
                  name="excusedPoints"
                  label="Sababli"
                  value={rules.excused_points}
                />
                <RuleField
                  name="absentPoints"
                  label="Kelmadi"
                  value={rules.absent_points}
                />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <RuleField
                  name="behaviorPoints"
                  label="Xulq"
                  value={rules.behavior_points}
                  hint="Baho shu songa ko‘paytiriladi"
                />
                <RuleField
                  name="homeworkItemPoints"
                  label="Har bir masala"
                  value={rules.homework_item_points}
                />
                <RuleField
                  name="coinsPerPoints"
                  label="1 tanga = ball"
                  value={rules.coins_per_points}
                  hint="Necha ballga bitta tanga"
                />
              </div>

              <SubmitButton className="mt-4 min-h-11 rounded-xl bg-mb-brand px-5 text-sm font-semibold text-white transition hover:bg-mb-brandDark">
                Qoidalarni saqlash
              </SubmitButton>
            </form>
          </div>
        </details>

        {/* Guruh sozlamalari */}
        <details className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-mb-ink">
            Guruh ma’lumotlari
          </summary>

          <div className="border-t border-mb-line px-4 py-4">
            <form action={updateCrmGroup} className="space-y-3">
              <input type="hidden" name="groupId" value={groupId} />

              <div>
                <label
                  htmlFor="guruh-nomi"
                  className="block text-xs font-semibold text-slate-600"
                >
                  Guruh nomi
                </label>

                <input
                  id="guruh-nomi"
                  name="title"
                  defaultValue={group.title}
                  required
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="isActive"
                  value="1"
                  defaultChecked={group.is_active}
                  className="h-4 w-4 accent-blue-600"
                />
                Guruh faol
              </label>

              <SubmitButton className="min-h-11 rounded-xl bg-mb-brand px-5 text-sm font-semibold text-white transition hover:bg-mb-brandDark">
                Saqlash
              </SubmitButton>
            </form>

            <form
              action={deleteCrmGroup}
              className="mt-6 border-t border-dashed border-slate-300 pt-4"
            >
              <input type="hidden" name="groupId" value={groupId} />

              <p className="text-sm font-semibold text-red-700">
                Guruhni butunlay o‘chirish
              </p>

              <p className="mt-1 text-xs leading-5 text-mb-muted">
                O‘quvchilar, darslar va barcha ballar birga o‘chadi.
                Tasdiqlash uchun guruh nomini aynan yozing.
              </p>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  name="confirmTitle"
                  placeholder={group.title}
                  aria-label="Tasdiqlash uchun guruh nomi"
                  className="min-h-11 flex-1 rounded-xl border border-red-200 bg-white px-3 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
                />

                <SubmitButton className="min-h-11 rounded-xl border border-red-300 bg-white px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                  O‘chirish
                </SubmitButton>
              </div>
            </form>
          </div>
        </details>
      </section>
    </main>
  );
}
