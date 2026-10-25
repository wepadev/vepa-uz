import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck, ClipboardList, Star } from "lucide-react";

import BrandMark from "@/components/ui/brand-mark";
import { parseParentToken } from "@/lib/parent-link";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "O‘quvchi hisoboti",
  /* Shaxsiy ma'lumot — qidiruvga tushmasin */
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ kod: string }>;
};

type DailyRow = {
  attendance: "keldi" | "kechikdi" | "sababli" | "kelmadi";
  behavior: number | null;
  homework_done: number;
  homework_total: number;
  points: number;
  crm_lessons: { lesson_date: string; topic: string | null } | null;
};

type AssignmentRow = {
  id: number;
  due_at: string;
  tests: { title: string } | null;
};

const ATTENDANCE: Record<DailyRow["attendance"], { label: string; tone: string }> = {
  keldi: { label: "Keldi", tone: "bg-emerald-50 text-emerald-700" },
  kechikdi: { label: "Kechikdi", tone: "bg-amber-50 text-amber-700" },
  sababli: { label: "Sababli", tone: "bg-slate-100 text-slate-600" },
  kelmadi: { label: "Kelmadi", tone: "bg-red-50 text-red-700" },
};

/*
 * "Jami berilgan" maydoni olib tashlangan (admin/crm/actions.ts),
 * shuning uchun yangi darslarda jami 0 bo'ladi — u holda faqat
 * ishlangan masalalar soni ko'rsatiladi.
 */
function formatHomework(done: number, total: number) {
  return total > 0 ? `${done}/${total}` : String(done);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

/**
 * Ota-onaga yuboriladigan hisobot.
 *
 * Kirish talab qilinmaydi: havoladagi kod serverdagi kalit bilan
 * imzolangan (lib/parent-token.ts), shuning uchun faqat o'qituvchi
 * bergan havola ishlaydi. Ma'lumot admin mijozi orqali o'qiladi va
 * faqat shu o'quvchiga tegishli qismi ko'rsatiladi.
 */
export default async function ParentReportPage({ params }: PageProps) {
  const { kod } = await params;
  const studentId = parseParentToken(decodeURIComponent(kod));

  if (!studentId) notFound();

  const admin = createAdminClient();

  const { data: student } = await admin
    .from("crm_students")
    .select("id, full_name, user_id, crm_groups(title, study_group_id)")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) notFound();

  const group = student.crm_groups as unknown as {
    title: string;
    study_group_id: number | null;
  } | null;

  const { data: dailyData } = await admin
    .from("crm_daily_records")
    .select(
      "attendance, behavior, homework_done, homework_total, points, crm_lessons(lesson_date, topic)",
    )
    .eq("student_id", studentId)
    .limit(200);

  const days = ((dailyData ?? []) as unknown as DailyRow[])
    .filter((row) => row.crm_lessons)
    .sort((a, b) =>
      b.crm_lessons!.lesson_date.localeCompare(a.crm_lessons!.lesson_date),
    );

  const present = days.filter(
    (row) => row.attendance === "keldi" || row.attendance === "kechikdi",
  ).length;
  const attendanceRate = days.length
    ? Math.round((present / days.length) * 100)
    : null;
  const totalPoints = days.reduce((sum, row) => sum + row.points, 0);
  const homeworkDone = days.reduce((sum, row) => sum + row.homework_done, 0);
  const homeworkTotal = days.reduce((sum, row) => sum + row.homework_total, 0);

  /* Saytdagi uy vazifalari — o'quvchining hisobi bog'langan bo'lsa */
  let online: {
    id: number;
    title: string;
    dueAt: string;
    percentage: number | null;
    done: boolean;
  }[] = [];

  if (student.user_id && group?.study_group_id) {
    const { data: assignmentData } = await admin
      .from("assignments")
      .select("id, due_at, tests(title)")
      .eq("group_id", group.study_group_id)
      .order("due_at", { ascending: false })
      .limit(10);

    const assignments = (assignmentData ?? []) as unknown as AssignmentRow[];

    const { data: attemptData } = assignments.length
      ? await admin
          .from("attempts")
          .select("assignment_id, percentage, completed_at")
          .eq("user_id", student.user_id)
          .in(
            "assignment_id",
            assignments.map((item) => item.id),
          )
      : { data: [] };

    const attempts = new Map(
      (
        (attemptData ?? []) as {
          assignment_id: number;
          percentage: number | string | null;
          completed_at: string | null;
        }[]
      ).map((row) => [row.assignment_id, row] as const),
    );

    online = assignments.map((item) => {
      const attempt = attempts.get(item.id);

      return {
        id: item.id,
        title: item.tests?.title ?? "Test",
        dueAt: item.due_at,
        done: Boolean(attempt?.completed_at),
        percentage:
          attempt?.percentage != null ? Math.round(Number(attempt.percentage)) : null,
      };
    });
  }

  const stats = [
    {
      icon: CalendarCheck,
      label: "Davomat",
      value: attendanceRate === null ? "—" : `${attendanceRate}%`,
      hint: `${days.length} ta darsdan ${present} tasida`,
    },
    {
      icon: ClipboardList,
      label: "Uy vazifasi",
      value: days.length ? formatHomework(homeworkDone, homeworkTotal) : "—",
      hint: "ishlangan masalalar",
    },
    {
      icon: Star,
      label: "Ball",
      value: String(totalPoints),
      hint: "jami to‘plangan",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 pb-10 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <BrandMark size={36} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-mb-muted">
              Vepa Ustoz · o‘quvchi hisoboti
            </p>
            <h1 className="truncate text-lg font-bold">{student.full_name}</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-3 pt-5 sm:px-6">
        {group && (
          <p className="text-sm text-mb-muted">
            Guruh: <b className="text-mb-ink">{group.title}</b>
          </p>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-mb-line bg-white p-3 text-center shadow-sm"
            >
              <item.icon
                className="mx-auto h-5 w-5 text-mb-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              <p className="mt-1 text-xl font-bold text-mb-brand">{item.value}</p>
              <p className="text-xs font-semibold text-mb-ink">{item.label}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-mb-muted">{item.hint}</p>
            </div>
          ))}
        </div>

        {online.length > 0 && (
          <>
            <h2 className="mt-7 text-base font-bold">Saytdagi uy vazifalari</h2>

            <div className="mt-2 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              {online.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3",
                    index > 0 && "border-t border-mb-line",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-mb-ink">
                      {item.title}
                    </p>
                    <p className="text-xs text-mb-muted">
                      Muddat: {formatDate(item.dueAt)}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                      item.done
                        ? "bg-emerald-50 text-emerald-700"
                        : new Date(item.dueAt).getTime() < Date.now()
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {item.done
                      ? `${item.percentage ?? 0}%`
                      : new Date(item.dueAt).getTime() < Date.now()
                        ? "Bajarilmadi"
                        : "Kutilmoqda"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mt-7 text-base font-bold">Oxirgi darslar</h2>

        {days.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-mb-line bg-white px-4 py-3 text-sm text-mb-muted">
            Hali dars yozuvlari yo‘q.
          </p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
            {days.slice(0, 12).map((row, index) => {
              const attendance = ATTENDANCE[row.attendance] ?? ATTENDANCE.kelmadi;

              return (
                <div
                  key={row.crm_lessons!.lesson_date}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3",
                    index > 0 && "border-t border-mb-line",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-mb-ink">
                      {formatDate(row.crm_lessons!.lesson_date)}
                      {row.crm_lessons!.topic && (
                        <span className="font-normal text-mb-muted">
                          {" "}· {row.crm_lessons!.topic}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-mb-muted">
                      {(row.homework_done > 0 || row.homework_total > 0) &&
                        `Vazifa ${formatHomework(row.homework_done, row.homework_total)} · `}
                      {row.behavior !== null && `Xulq ${row.behavior}/5 · `}
                      {row.points} ball
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                      attendance.tone,
                    )}
                  >
                    {attendance.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-mb-muted">
          Bu havola faqat siz uchun. Savollar bo‘lsa, ustozga yozing.
        </p>
      </section>
    </main>
  );
}
