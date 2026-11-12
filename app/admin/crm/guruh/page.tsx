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
  Users,
} from "@/components/ui/icons";

import AdminTabs from "@/components/admin/admin-tabs";
import GroupAssignments from "@/components/admin/group-assignments";
import AppAlert from "@/components/ui/app-alert";
import SubmitButton from "@/components/ui/submit-button";
import { parentReportUrl } from "@/lib/parent-link";
import { getCurrentUser } from "@/lib/supabase/current-user";
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
import BackLink from "@/components/ui/back-link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guruh",
  description: "Öquvçilar, ballar reytingi va ball qoidalari.",
};

/**
 * Guruh sahifasi — to'rtta tab.
 *
 *   · Bugun       — dars varaqasi, reyting va qo'shimcha sahifalar
 *   · O'quvchilar — qo'shish, tahrirlash, birlashtirish
 *   · Vazifalar   — uy vazifasi berish va natijalar
 *   · Sozlamalar  — ball qoidalari, guruh nomi, o'chirish
 *
 * Ilgari hammasi bitta uzun sahifada edi: oltita katta tugma va
 * to'rtta yig'iladigan bo'lim. Kerakli narsani topish qiyin edi,
 * uy vazifasi esa umuman boshqa sahifada turardi.
 */
type Tab = "bugun" | "oquvchilar" | "vazifalar" | "sozlamalar";

const TABS: Tab[] = ["bugun", "oquvchilar", "vazifalar", "sozlamalar"];

type PageProps = {
  searchParams: Promise<{
    id?: string | string[];
    tab?: string | string[];
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

/** Örin belgisi: 1-örin — sariq urğu, 2–3 — oçiq kök, qolgani kulrang */
function Rank({ index }: { index: number }) {
  return (
    <span
      className={cn(
        "num grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-bold",
        index === 0
          ? "bg-vp-accent text-vp-on-accent"
          : index <= 2
            ? "bg-mb-tint text-mb-brandDark"
            : "bg-slate-100 text-slate-600",
      )}
      aria-label={`${index + 1}-örin`}
    >
      {index + 1}
    </span>
  );
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


/** Kichik ikkinchi darajali havola (tahlil, do'kon, hisobot) */
function SideLink({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string;
  icon: typeof BarChart3;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-mb-line bg-white px-4 py-3 transition hover:border-mb-brand"
    >
      <Icon
        className="h-5 w-5 shrink-0 text-mb-muted"
        strokeWidth={2}
        aria-hidden="true"
      />

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-mb-ink">
          {title}
        </span>
        <span className="block truncate text-xs text-mb-muted">{hint}</span>
      </span>
    </Link>
  );
}

export default async function CrmGroupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groupId = Number(single(params.id));
  const errorMessage = single(params.xato);
  const rawTab = single(params.tab) as Tab | undefined;
  const tab: Tab = rawTab && TABS.includes(rawTab) ? rawTab : "bugun";

  if (!Number.isInteger(groupId) || groupId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const user = await getCurrentUser();

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
    activeAssignmentsResult,
  ] = await Promise.all([
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

    /* Tab yorlig'idagi son uchun — faqat faol vazifalar */
    group.study_group_id
      ? supabase
          .from("assignments")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.study_group_id)
          .eq("is_active", true)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  const ranking = (rankingResult.data ?? []) as RankingRow[];
  const students = (studentsResult.data ?? []) as StudentRow[];
  const rules = (rulesResult.data as RulesRow | null) ?? DEFAULT_RULES;
  const activeAssignments = activeAssignmentsResult.count ?? 0;

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

  const base = `/admin/crm/guruh?id=${groupId}`;
  const tabHref = (value: Tab) =>
    value === "bugun" ? base : `${base}&tab=${value}`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
        <BackLink
          href="/admin/crm"
          label="Guruhlar"
        />

        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          {group.title}
        </h1>

        <AdminTabs
          className="mt-4"
          active={tabHref(tab)}
          tabs={[
            { href: tabHref("bugun"), label: "Bugun", icon: CalendarDays },
            {
              href: tabHref("oquvchilar"),
              label: "Öquvçilar",
              icon: Users,
              count: students.length,
            },
            ...(group.study_group_id
              ? [
                  {
                    href: tabHref("vazifalar"),
                    label: "Vazifalar",
                    icon: ClipboardList,
                    count: activeAssignments,
                  },
                ]
              : []),
            {
              href: tabHref("sozlamalar"),
              label: "Sozlamalar",
              icon: Settings2,
            },
          ]}
        />

        {errorMessage && (
          <AppAlert variant="error" title="Diqqat" className="mt-4">
            {errorMessage}
          </AppAlert>
        )}

        {tab === "bugun" && (
          <>
            <Link
              href={`/admin/crm/dars?guruh=${groupId}&sana=${today}`}
              className="mt-5 flex items-center gap-4 rounded-xl bg-mb-brand px-5 py-5 text-white shadow-sm transition hover:bg-mb-brandDark"
            >
              <CalendarDays
                className="h-9 w-9 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />

              <span>
                <span className="block text-lg font-bold">
                  Bugungi dars varaqasi
                </span>
                <span className="mt-0.5 block text-sm text-blue-100">
                  Davomat, xulq, uy vazifasi
                </span>
              </span>
            </Link>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <SideLink
                href={`/admin/crm/tahlil?guruh=${groupId}`}
                icon={TrendingUp}
                title="Ball tahlili"
                hint="Qaysi kuni ball köp bölgan"
              />

              <SideLink
                href={`/admin/crm/dokon?guruh=${groupId}`}
                icon={Coins}
                title="Sovğa dökoni"
                hint="Tangani sovğaga almaştiriş"
              />

              {group.study_group_id && (
                <SideLink
                  href={`/admin/groups/report?groupId=${group.study_group_id}`}
                  icon={BarChart3}
                  title="Hisobot"
                  hint="Öquvçilar böyiça yakun"
                />
              )}
            </div>

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
              <AppAlert variant="info" title="Öquvçi yöq" className="mt-3">
                “Öquvçilar” tabida öquvçilarni qöşing.
              </AppAlert>
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white">
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
                        <Rank index={index} />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-mb-ink">
                            {row.full_name}

                            {row.has_account && (
                              <Link2
                                className="ml-1.5 inline h-3.5 w-3.5 text-mb-brand"
                                strokeWidth={2.2}
                                aria-label="Sayt hisobiga boğlangan"
                              />
                            )}
                          </p>

                          <p className="mt-0.5 text-xs text-mb-muted">
                            {row.lessons_count} dars · davomat{" "}
                            {attendanceRate}% · vazifa {row.homework_done}
                            {row.homework_total > 0 && <>/{row.homework_total}</>}
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
          </>
        )}

        {tab === "oquvchilar" && (
          <div className="mt-6">
            {/* Qo'shilish kodi */}
            {group.join_code && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-mb-line bg-white px-4 py-3">
                <KeyRound
                  className="h-5 w-5 shrink-0 text-mb-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />

                <span className="rounded-lg bg-mb-tintSoft px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-mb-brand">
                  {group.join_code}
                </span>

                <span className="text-xs leading-5 text-mb-muted">
                  Öquvçi <b>Guruhim</b> bölimida şu kodni kiritsa
                  özi qöşiladi. Bitta kod bilan uy vazifalari ham,
                  dars ballari ham oçiladi.
                </span>
              </div>
            )}

            <div className="mt-6">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold">
                <UserPlus
                  className="h-5 w-5 text-mb-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Öquvçi qöşiş
              </h2>

              <form
                action={addCrmStudent}
                className="mt-3 rounded-2xl border border-mb-line bg-white p-4"
              >
                <input type="hidden" name="groupId" value={groupId} />
                <input type="hidden" name="tab" value="oquvchilar" />

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
                    Qöşiş
                  </SubmitButton>
                </div>
              </form>
            </div>

            {/* O'quvchilar ro'yxati */}
            {students.length > 0 && (
              <div className="mt-3 space-y-2">
                {students.map((student) => (
                  <details
                    key={student.id}
                    className="overflow-hidden rounded-2xl border border-mb-line bg-white"
                  >
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-mb-ink">
                      {student.full_name}

                      {student.user_id ? (
                        <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          sayt hisobi bor
                        </span>
                      ) : (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          faqat röyxatda
                        </span>
                      )}
                    </summary>

                    <div className="border-t border-mb-line px-4 py-4">
                      <form action={updateCrmStudent} className="space-y-3">
                        <input type="hidden" name="groupId" value={groupId} />
                        <input type="hidden" name="tab" value="oquvchilar" />
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
                            Sayt hisobiga boğlaş (email)
                          </label>

                          <input
                            id={`email-${student.id}`}
                            name="email"
                            type="email"
                            placeholder={
                              student.user_id
                                ? "Boğlangan — özgartiriş uçun yangi email yozing"
                                : "Öquvçining vepa.uz dagi emaili"
                            }
                            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                          />

                          <p className="mt-1 text-[11px] leading-4 text-mb-muted">
                            Böş qoldirsangiz boğlaniş özgarmaydi.
                            Öquvçining saytda hisobi bölmasa, bu joyni
                            umuman taşlab keting.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <SubmitButton className="min-h-11 rounded-xl bg-mb-brand px-5 text-sm font-semibold text-white transition hover:bg-mb-brandDark">
                            Saqlaş
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
                          Nusxalab Telegram&apos;da yuboring. Ota-ona kirişsiz
                          davomat, ball va uy vazifasi natijalarini köradi.
                        </p>

                        <a
                          href={parentLinks.get(student.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex min-h-8 items-center text-xs font-semibold text-mb-brand hover:text-mb-brandDark"
                        >
                          Hisobotni oçiş ›
                        </a>
                      </div>

                      <form action={removeCrmStudent} className="mt-3">
                        <input type="hidden" name="groupId" value={groupId} />
                        <input type="hidden" name="tab" value="oquvchilar" />
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
                          Guruhdan çiqariş
                        </SubmitButton>

                        <p className="mt-1.5 text-[11px] leading-4 text-mb-muted">
                          Ballar tarixi saqlanadi — öquvçi şunçaki
                          röyxatdan yaşiriladi.
                        </p>
                      </form>
                    </div>
                  </details>
                ))}
              </div>
            )}

            {/* Dublikatlarni birlashtirish */}
            {students.length > 1 && (
              <details className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-mb-ink">
                  <span className="inline-flex items-center gap-2">
                    <Merge
                      className="h-4 w-4 text-mb-muted"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    Ikkita yozuvni birlaştiriş
                  </span>
                </summary>

                <div className="border-t border-mb-line px-4 py-4">
                  <p className="text-sm leading-6 text-mb-muted">
                    Öquvçini qölda kiritgan bölsangiz va u keyin kod
                    bilan özi qöşilgan bölsa, ikkita yozuv paydo
                    böladi. Bu yerda ularni bittaga qöşasiz: darslar,
                    ballar va sovğalar saqlanadigan yozuvga köçadi.
                  </p>

                  <form action={mergeCrmStudents} className="mt-3">
                    <input type="hidden" name="groupId" value={groupId} />
                    <input type="hidden" name="tab" value="oquvchilar" />

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
                          Qaysi biri unga qöşilsin
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
                      Ikkinçi yozuv butunlay öçadi. Bir kunda ikkalasida
                      ham yozuv bölsa, qoladiganiniki ustun turadi.
                    </p>

                    <SubmitButton className="mt-3 min-h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Birlaştiriş
                    </SubmitButton>
                  </form>
                </div>
              </details>
            )}
          </div>
        )}

        {tab === "vazifalar" && group.study_group_id && (
          <GroupAssignments
            crmGroupId={groupId}
            studyGroupId={group.study_group_id}
          />
        )}

        {tab === "sozlamalar" && (
          <>
            {/* Ball qoidalari */}
            <h2 className="mt-6 inline-flex items-center gap-2 text-lg font-bold">
              <Settings2
                className="h-5 w-5 text-mb-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              Ball qoidalari
            </h2>

            <div className="mt-3 rounded-2xl border border-mb-line bg-white px-4 py-4">
              <div className="border-t border-mb-line px-4 py-4">
                <p className="text-sm leading-6 text-mb-muted">
                  Qoida özgartirilsa faqat <b>keyingi</b> darslarga
                  qöllanadi. Ötgan kunlarning ballari özgarmaydi — aks
                  holda reyting tösatdan qayta hisoblanib ketardi.
                </p>

                <form action={saveCrmRules} className="mt-4">
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="hidden" name="tab" value="sozlamalar" />

                  <div className="grid gap-3 sm:grid-cols-4">
                    <RuleField
                      name="presentPoints"
                      label="Keldi"
                      value={rules.present_points}
                    />
                    <RuleField
                      name="latePoints"
                      label="Keçikdi"
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
                      hint="Baho şu songa köpaytiriladi"
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
                      hint="Neça ballga bitta tanga"
                    />
                  </div>

                  <SubmitButton className="mt-4 min-h-11 rounded-xl bg-mb-brand px-5 text-sm font-semibold text-white transition hover:bg-mb-brandDark">
                    Qoidalarni saqlaş
                  </SubmitButton>
                </form>
              </div>
            </div>

            {/* Guruh ma'lumotlari */}
            <h2 className="mt-8 text-lg font-bold">Guruh ma’lumotlari</h2>

            <div className="mt-3 rounded-2xl border border-mb-line bg-white px-4 py-4">
              <div className="border-t border-mb-line px-4 py-4">
                <form action={updateCrmGroup} className="space-y-3">
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="hidden" name="tab" value="sozlamalar" />

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
                      className="h-4 w-4 accent-mb-brand"
                    />
                    Guruh faol
                  </label>

                  <SubmitButton className="min-h-11 rounded-xl bg-mb-brand px-5 text-sm font-semibold text-white transition hover:bg-mb-brandDark">
                    Saqlaş
                  </SubmitButton>
                </form>

                <form
                  action={deleteCrmGroup}
                  className="mt-6 border-t border-dashed border-slate-300 pt-4"
                >
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="hidden" name="tab" value="sozlamalar" />

                  <p className="text-sm font-semibold text-red-700">
                    Guruhni butunlay öçiriş
                  </p>

                  <p className="mt-1 text-xs leading-5 text-mb-muted">
                    Öquvçilar, darslar va barça ballar birga öçadi.
                    Tasdiqlaş uçun guruh nomini aynan yozing.
                  </p>

                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      name="confirmTitle"
                      placeholder={group.title}
                      aria-label="Tasdiqlaş uçun guruh nomi"
                      className="min-h-11 flex-1 rounded-xl border border-red-200 bg-white px-3 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
                    />

                    <SubmitButton className="min-h-11 rounded-xl border border-red-300 bg-white px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                      Öçiriş
                    </SubmitButton>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
