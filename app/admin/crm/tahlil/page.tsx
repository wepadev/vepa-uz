import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { card, cardPad, chip, pageSection, sectionTitle } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ball tahlili",
  description: "Qaysi kuni ball köp bölgan va nega — bitta ekranda.",
};

type PageProps = {
  searchParams: Promise<{ guruh?: string | string[] }>;
};

type StudentRow = {
  id: number;
  full_name: string;
  is_active: boolean;
  user_id: string | null;
};

type LessonRow = {
  id: number;
  lesson_date: string;
  topic: string | null;
};

type DailyRow = {
  lesson_id: number;
  student_id: number;
  attendance: string;
  behavior: number | null;
  homework_done: number;
  bonus_points: number;
  points: number;
};

type Rules = {
  present_points: number;
  late_points: number;
  excused_points: number;
  absent_points: number;
  behavior_points: number;
  homework_item_points: number;
  coins_per_points: number;
};

const DEFAULT_RULES: Rules = {
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

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  return `${day}.${month}.${year}`;
}

/** O'rtacha emas, o'rta qiymat — bitta g'alati kun natijani buzmasin */
function median(values: number[]) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Ismlarni solishtirish uchun: bo'shliq va harf kattaligi hisobga olinmaydi */
function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-zа-яʻʼ']+/gi, "");
}

export default async function CrmAnalysisPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groupId = Number(single(params.guruh));

  if (!Number.isInteger(groupId) || groupId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) redirect("/auth/login");

  const { data: group } = await supabase
    .from("crm_groups")
    .select("id, title, study_group_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) notFound();

  const [studentResult, lessonResult, ruleResult] = await Promise.all([
    supabase
      .from("crm_students")
      .select("id, full_name, is_active, user_id")
      .eq("group_id", groupId),

    supabase
      .from("crm_lessons")
      .select("id, lesson_date, topic")
      .eq("group_id", groupId)
      .order("lesson_date", { ascending: false })
      .limit(200),

    supabase
      .from("crm_point_rules")
      .select(
        "present_points, late_points, excused_points, absent_points, behavior_points, homework_item_points, coins_per_points",
      )
      .eq("group_id", groupId)
      .maybeSingle(),
  ]);

  const students = (studentResult.data ?? []) as StudentRow[];
  const lessons = (lessonResult.data ?? []) as LessonRow[];
  const rules = (ruleResult.data as Rules | null) ?? DEFAULT_RULES;

  /*
   * Bitta onlayn guruhga ikkita CRM guruh bog'langan bo'lsa,
   * uy vazifasidan olingan ball har ikkalasida sanaladi — tanga
   * ikki barobar bo'lib ketadi.
   */
  const { data: twinGroups } = group.study_group_id
    ? await supabase
        .from("crm_groups")
        .select("id, title")
        .eq("study_group_id", group.study_group_id)
        .neq("id", groupId)
    : { data: [] };

  const twins = (twinGroups ?? []) as Array<{ id: number; title: string }>;

  const lessonIds = lessons.map((row) => row.id);

  const { data: dailyData } = lessonIds.length
    ? await supabase
        .from("crm_daily_records")
        .select(
          "lesson_id, student_id, attendance, behavior, homework_done, bonus_points, points",
        )
        .in("lesson_id", lessonIds)
    : { data: [] };

  const daily = (dailyData ?? []) as DailyRow[];

  const studentName = new Map(
    students.map((row) => [row.id, row.full_name]),
  );

  const lessonById = new Map(lessons.map((row) => [row.id, row]));

  /* ---------------- Kunlar bo'yicha yig'indi ---------------- */

  type DaySummary = {
    lessonId: number;
    date: string;
    topic: string | null;
    total: number;
    count: number;
    behaviorPoints: number;
    homeworkPoints: number;
    bonusPoints: number;
    basePoints: number;
    present: number;
    absent: number;
    homeworkItems: number;
    behaviorFilled: number;
  };

  const dayMap = new Map<number, DaySummary>();

  for (const row of daily) {
    const lesson = lessonById.get(row.lesson_id);

    if (!lesson) continue;

    const day =
      dayMap.get(row.lesson_id) ??
      ({
        lessonId: row.lesson_id,
        date: lesson.lesson_date.slice(0, 10),
        topic: lesson.topic,
        total: 0,
        count: 0,
        behaviorPoints: 0,
        homeworkPoints: 0,
        bonusPoints: 0,
        basePoints: 0,
        present: 0,
        absent: 0,
        homeworkItems: 0,
        behaviorFilled: 0,
      } satisfies DaySummary);

    const base =
      row.attendance === "keldi"
        ? rules.present_points
        : row.attendance === "kechikdi"
          ? rules.late_points
          : row.attendance === "sababli"
            ? rules.excused_points
            : rules.absent_points;

    day.total += row.points;
    day.count += 1;
    day.basePoints += base;
    day.behaviorPoints += (row.behavior ?? 0) * rules.behavior_points;
    day.homeworkPoints +=
      Math.max(0, row.homework_done) * rules.homework_item_points;
    day.bonusPoints += row.bonus_points;

    if (row.attendance === "kelmadi") {
      day.absent += 1;
    } else {
      day.present += 1;
    }

    day.homeworkItems += Math.max(0, row.homework_done);

    if (row.behavior !== null) {
      day.behaviorFilled += 1;
    }

    dayMap.set(row.lesson_id, day);
  }

  const days = [...dayMap.values()].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  const byTotal = [...days].sort((a, b) => b.total - a.total);
  const topDay = byTotal[0] ?? null;

  const dayMedian = median(days.map((row) => row.total));

  /*
   * Hamma kun bir xil ball berayotgan bo'lsa, bu ko'pincha
   * dasturning xatosi emas: dars varag'i faqat davomat bilan
   * saqlangan, xulq va uy vazifasi bo'sh qolgan. Shuni aytib
   * qo'ygan ma'qul — o'qituvchi behuda sabab qidirmasin.
   */
  const allSame =
    days.length > 2 &&
    days.every((row) => row.total === days[0].total);

  const nothingButAttendance = days.every(
    (row) => row.homeworkItems === 0 && row.behaviorFilled === 0,
  );

  /* ---------------- Shubhali yozuvlar ---------------- */

  /*
   * Bitta o'quvchining bitta kundagi balli. Odatdagisi — o'rta
   * qiymat. Undan ikki baravar oshgani ko'pincha xato yozuvdir:
   * "3" o'rniga "30" terilgan yoki qo'shimcha ballda nol ortiqcha.
   */
  const recordPoints = daily.map((row) => row.points);
  const recordMedian = median(recordPoints);
  const threshold = Math.max(recordMedian * 2, recordMedian + 20, 40);

  const suspicious = daily
    .filter((row) => row.points > threshold)
    .map((row) => {
      const lesson = lessonById.get(row.lesson_id);

      const reasons: string[] = [];

      const homework =
        Math.max(0, row.homework_done) * rules.homework_item_points;

      if (homework > threshold / 2) {
        reasons.push(
          `uy vazifasi ${row.homework_done} ta → ${homework} ball`,
        );
      }

      if (row.bonus_points > 20) {
        reasons.push(`qöşimça ball ${row.bonus_points}`);
      }

      if (reasons.length === 0) {
        reasons.push("davomat va xulq balli yiğilgan");
      }

      return {
        key: `${row.lesson_id}-${row.student_id}`,
        date: lesson ? lesson.lesson_date.slice(0, 10) : "—",
        name: studentName.get(row.student_id) ?? "Noma’lum",
        points: row.points,
        reasons,
      };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);

  /* ---------------- Takrorlangan o'quvchilar ---------------- */

  const nameCount = new Map<string, StudentRow[]>();

  for (const row of students) {
    const key = normalizeName(row.full_name);

    nameCount.set(key, [...(nameCount.get(key) ?? []), row]);
  }

  const accountCount = new Map<string, StudentRow[]>();

  for (const row of students) {
    if (!row.user_id) continue;

    accountCount.set(row.user_id, [
      ...(accountCount.get(row.user_id) ?? []),
      row,
    ]);
  }

  const duplicates = [
    ...nameCount.values(),
    ...accountCount.values(),
  ].filter((rows) => rows.length > 1);

  const maxDayTotal = byTotal[0]?.total ?? 1;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref={`/admin/crm/guruh?id=${groupId}`}
        backLabel="Guruh"
        title="Ball tahlili"
        subtitle={group.title}
        chips={[`${days.length} ta dars`, `${students.length} ta öquvçi`]}
      />

      <section className={pageSection}>
        {twins.length > 0 && (
          <div
            className={cn(
              card,
              cardPad,
              "mb-4 flex items-start gap-3 border-red-200 bg-red-50",
            )}
          >
            <AlertTriangle
              className="h-6 w-6 shrink-0 text-red-600"
              strokeWidth={2}
              aria-hidden="true"
            />

            <p className="text-sm leading-6 text-red-900">
              Şu onlayn guruhga yana{" "}
              <b>{twins.map((row) => row.title).join(", ")}</b> boğlangan.
              Uy vazifasi balli ikkala guruhda ham sanaladi — tanga şuning
              uçun köpayadi. Guruhlardan birining boğlanişini uzing.
            </p>
          </div>
        )}

        {days.length === 0 ? (
          <div className={cn(card, cardPad, "text-center")}>
            <p className="text-sm text-mb-muted">
              Bu guruhda hali ball yozilmagan.
            </p>
          </div>
        ) : (
          <>
            {/* Xulosa */}
            <div className="rounded-3xl bg-mb-brand p-5 text-white shadow-lg sm:p-6">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90">
                <TrendingUp
                  className="h-4 w-4"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                Eng köp ball yozilgan kun
              </p>

              {topDay && (
                <>
                  <p className="mt-2 text-3xl font-bold">
                    {formatDate(topDay.date)}
                  </p>

                  <p className="mt-1 text-sm text-white/90">
                    {topDay.total} ball · {topDay.count} öquvçi · odatdagi
                    kun {Math.round(dayMedian)} ball
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    {[
                      { label: "Davomat", value: topDay.basePoints },
                      { label: "Xulq", value: topDay.behaviorPoints },
                      { label: "Uy vazifasi", value: topDay.homeworkPoints },
                      { label: "Qöşimça", value: topDay.bonusPoints },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl bg-white/15 px-2 py-3"
                      >
                        <p className="text-lg font-bold">{item.value}</p>
                        <p className="text-xs text-white/80">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <Link
                    href={`/admin/crm/dars?guruh=${groupId}&sana=${topDay.date}`}
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                  >
                    Şu kunni oçiş
                  </Link>
                </>
              )}
            </div>

            {allSame && (
              <div
                className={cn(
                  card,
                  cardPad,
                  "mt-4 flex items-start gap-3 border-blue-200 bg-blue-50",
                )}
              >
                <Info
                  className="h-6 w-6 shrink-0 text-blue-600"
                  strokeWidth={2}
                  aria-hidden="true"
                />

                <p className="text-sm leading-6 text-blue-900">
                  Hamma kun bir xil — <b>{days[0].total} ball</b>.{" "}
                  {nothingButAttendance
                    ? "Dars varağida faqat davomat belgilangan: xulq bahosi va uy vazifasi böş qolgan, şuning uçun ball faqat “keldi” ballidan iborat."
                    : "Ballar bir xil çiqişi uçun har kuni bir xil qiymat kiritilgan bölişi kerak."}
                </p>
              </div>
            )}

            {/* Shubhali yozuvlar */}
            <div className="mt-6">
              <h2 className={sectionTitle}>Tekşiriş kerak</h2>

              {suspicious.length === 0 ? (
                <div
                  className={cn(
                    card,
                    cardPad,
                    "mt-3 flex items-center gap-3 border-emerald-200 bg-emerald-50",
                  )}
                >
                  <CheckCircle2
                    className="h-6 w-6 shrink-0 text-emerald-600"
                    strokeWidth={2}
                    aria-hidden="true"
                  />

                  <p className="text-sm text-emerald-800">
                    Ğalati yozuv topilmadi. Ballar bir tekis taqsimlangan.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-mb-muted">
                    Bitta kunda {threshold} balldan oşgan yozuvlar. Odatdagi
                    kun — {Math.round(recordMedian)} ball.
                  </p>

                  <ul className="mt-3 grid gap-2">
                    {suspicious.map((row) => (
                      <li
                        key={row.key}
                        className={cn(
                          card,
                          "flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50 px-4 py-3",
                        )}
                      >
                        <AlertTriangle
                          className="h-5 w-5 shrink-0 text-amber-600"
                          strokeWidth={2}
                          aria-hidden="true"
                        />

                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-amber-900">
                            {row.name} — {row.points} ball
                          </span>
                          <span className="mt-0.5 block text-xs text-amber-800">
                            {formatDate(row.date)} · {row.reasons.join(", ")}
                          </span>
                        </span>

                        <Link
                          href={`/admin/crm/dars?guruh=${groupId}&sana=${row.date}`}
                          className="shrink-0 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                        >
                          Tuzatiş
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Takrorlangan o'quvchilar */}
            {duplicates.length > 0 && (
              <div className="mt-6">
                <h2 className={sectionTitle}>Bir ism ikki marta</h2>

                <p className="mt-1 text-sm text-mb-muted">
                  Ikki yozuvga ham ball tuşadi — tanga şuning uçun
                  köpayib ketadi. Guruh sahifasida birlaştiring.
                </p>

                <ul className="mt-3 grid gap-2">
                  {duplicates.map((rows) => (
                    <li
                      key={rows[0].id}
                      className={cn(
                        card,
                        "flex items-center gap-3 border-red-200 bg-red-50 px-4 py-3",
                      )}
                    >
                      <Users
                        className="h-5 w-5 shrink-0 text-red-600"
                        strokeWidth={2}
                        aria-hidden="true"
                      />

                      <span className="min-w-0 flex-1 text-sm font-semibold text-red-900">
                        {rows[0].full_name}
                        <span className="ml-2 text-xs font-normal text-red-700">
                          {rows.length} ta yozuv
                        </span>
                      </span>

                      <Link
                        href={`/admin/crm/guruh?id=${groupId}`}
                        className="shrink-0 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-800 transition hover:bg-red-100"
                      >
                        Birlaştiriş
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Kunlar ro'yxati */}
            <div className="mt-6">
              <h2 className={sectionTitle}>Kunlar</h2>

              <ul className="mt-3 grid gap-2">
                {days.map((day) => {
                  const share = Math.round((day.total / maxDayTotal) * 100);
                  const high = day.total > dayMedian * 1.6;

                  return (
                    <li key={day.lessonId} className={cn(card, "px-4 py-3")}>
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/admin/crm/dars?guruh=${groupId}&sana=${day.date}`}
                          className="min-w-0 font-semibold text-mb-ink hover:text-mb-brand"
                        >
                          {formatDate(day.date)}
                          {day.topic && (
                            <span className="ml-2 truncate text-xs font-normal text-mb-muted">
                              {day.topic}
                            </span>
                          )}
                        </Link>

                        <span
                          className={cn(
                            chip,
                            high && "bg-amber-100 text-amber-800",
                          )}
                        >
                          {day.total} ball
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-mb-muted">
                        {day.present} keldi
                        {day.absent > 0 && ` · ${day.absent} kelmadi`}
                        {" · "}
                        vazifa {day.homeworkItems} ta
                        {" · "}
                        xulq{" "}
                        {day.behaviorFilled === 0
                          ? "yozilmagan"
                          : `${day.behaviorFilled} ta`}
                      </p>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            high ? "bg-amber-400" : "bg-mb-brand",
                          )}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
