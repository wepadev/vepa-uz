import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  Printer,
  TrendingDown,
  Users,
} from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    groupId?: string | string[];
  }>;
};

type StudentRow = {
  user_id: string;
  full_name: string;
  assigned_count: number;
  completed_count: number;
  average_percent: number | string;
  last_activity: string | null;
};

type WeakTestRow = {
  assignment_id: number;
  test_id: number;
  test_title: string;
  due_at: string;
  attempts_count: number;
  average_percent: number | string;
  lowest_percent: number | string;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

/** Foizga qarab rang: past natija ko'zga tashlansin */
function toneFor(percent: number) {
  if (percent >= 80) return "emerald";
  if (percent >= 60) return "blue";
  if (percent >= 40) return "amber";
  return "red";
}

export default async function GroupReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groupId = Number(single(params.groupId));

  if (!Number.isInteger(groupId) || groupId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.is_active !== true) {
    redirect("/");
  }

  const { data: group, error: groupError } = await supabase
    .from("study_groups")
    .select("id, title")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    throw new Error(`Guruh yuklanmadi: ${groupError.message}`);
  }

  if (!group) notFound();

  const [studentsResult, weakResult] = await Promise.all([
    supabase.rpc("group_student_report", { p_group_id: groupId }),
    supabase.rpc("group_weak_tests", { p_group_id: groupId }),
  ]);

  /*
   * db/12 hali ishga tushirilmagan bo'lsa sahifa buzilmasin —
   * bo'sh ro'yxat va tushunarli xabar ko'rsatamiz.
   */
  const migrationMissing = Boolean(
    studentsResult.error || weakResult.error,
  );

  const students = (studentsResult.data ?? []) as StudentRow[];
  const weakTests = (weakResult.data ?? []) as WeakTestRow[];

  const active = students.filter((s) => s.completed_count > 0);

  const groupAverage =
    active.length > 0
      ? Math.round(
          active.reduce((sum, s) => sum + Number(s.average_percent), 0) /
            active.length,
        )
      : 0;

  const totalAssigned = students.reduce(
    (sum, s) => sum + s.assigned_count,
    0,
  );

  const totalCompleted = students.reduce(
    (sum, s) => sum + s.completed_count,
    0,
  );

  const completionRate =
    totalAssigned > 0
      ? Math.round((totalCompleted / totalAssigned) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10">
        <Link
          href={`/admin/groups/view?groupId=${groupId}`}
          className="inline-flex min-h-8 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
        >
          ← {group.title}
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <BarChart3 className="h-6 w-6 text-mb-muted" strokeWidth={2} aria-hidden="true" />
            Guruh hisoboti
          </h1>

          {/*
            Ota-onalar yig'ilishiga tayyor varaq: umumiy jadval va
            har bir o'quvchiga alohida sahifa.
          */}
          <Link
            href={`/admin/groups/report/çop?groupId=${groupId}`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Çop etiş / PDF
          </Link>
        </div>

        {migrationMissing && (
          <AppAlert variant="warning" title="Hisobot tayyor emas" className="mt-5">
            Supabase’da <b>db/12-guruh-hisoboti.sql</b> faylini işga
            tuşiring — şundan keyin ma’lumotlar çiqadi.
          </AppAlert>
        )}

        {/* Umumiy ko'rsatkichlar */}
        <div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-muted sm:text-xs">
              Öquvçi
            </p>
            <p className="mt-1 text-lg font-bold text-mb-ink sm:text-2xl">
              {students.length}
            </p>
          </div>

          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-muted sm:text-xs">
              Bajarilgan
            </p>
            <p className="mt-1 whitespace-nowrap text-lg font-bold text-emerald-600 sm:text-2xl">
              {completionRate}%
            </p>
          </div>

          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-muted sm:text-xs">
              Örtaça
            </p>
            <p className="mt-1 whitespace-nowrap text-lg font-bold text-mb-brand sm:text-2xl">
              {groupAverage}%
            </p>
          </div>
        </div>

        {/* O'quvchilar */}
        <h2 className="mt-8 inline-flex items-center gap-2 text-lg font-bold">
          <Users className="h-5 w-5 text-mb-muted" strokeWidth={2} aria-hidden="true" />
          Öquvçilar
        </h2>

        {students.length === 0 ? (
          <AppAlert variant="info" title="Ma’lumot yöq" className="mt-3">
            Guruhda öquvçi yöq yoki hali vazifa berilmagan.
          </AppAlert>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
            {students.map((student, index) => {
              const percent = Math.round(Number(student.average_percent));
              const tone = toneFor(percent);
              const neverWorked = student.completed_count === 0;

              return (
                <div
                  key={student.user_id}
                  className={cn(
                    "px-4 py-3",
                    index > 0 && "border-t border-mb-line",
                    neverWorked && "bg-red-50/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-mb-ink">
                        {student.full_name}
                      </p>

                      <p className="mt-0.5 text-xs text-mb-muted">
                        {student.completed_count}/{student.assigned_count} vazifa
                        {student.last_activity && (
                          <> · oxirgi: {formatDate(student.last_activity)}</>
                        )}
                      </p>
                    </div>

                    <p
                      className={cn(
                        "shrink-0 whitespace-nowrap text-lg font-bold",
                        tone === "emerald" && "text-emerald-600",
                        tone === "blue" && "text-blue-600",
                        tone === "amber" && "text-amber-600",
                        tone === "red" && "text-red-600",
                      )}
                    >
                      {neverWorked ? "—" : `${percent}%`}
                    </p>
                  </div>

                  {!neverWorked && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          tone === "emerald" && "bg-emerald-500",
                          tone === "blue" && "bg-blue-500",
                          tone === "amber" && "bg-amber-500",
                          tone === "red" && "bg-red-500",
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Qiyin kelgan vazifalar */}
        {weakTests.length > 0 && (
          <>
            <h2 className="mt-8 inline-flex items-center gap-2 text-lg font-bold">
              <TrendingDown className="h-5 w-5 text-mb-muted" strokeWidth={2} aria-hidden="true" />
              Qiyin kelgan vazifalar
            </h2>

            <p className="mt-1 text-sm leading-6 text-mb-muted">
              Sinf eng past natija körsatgan vazifalar tepada. Keyingi
              darsda şu mavzularni takrorlang.
            </p>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              {weakTests.map((item, index) => {
                const percent = Math.round(Number(item.average_percent));
                const tone = toneFor(percent);

                return (
                  <Link
                    key={item.assignment_id}
                    href={`/admin/assignments/view?id=${item.assignment_id}`}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3 transition sm:hover:bg-slate-50",
                      index > 0 && "border-t border-mb-line",
                      percent < 40 && "bg-red-50/40",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-mb-ink">
                        {item.test_title}
                      </p>

                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-mb-muted">
                        <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        {formatDate(item.due_at)} · {item.attempts_count} ta işladi
                        · eng past {Math.round(Number(item.lowest_percent))}%
                      </p>
                    </div>

                    <p
                      className={cn(
                        "shrink-0 whitespace-nowrap text-lg font-bold",
                        tone === "emerald" && "text-emerald-600",
                        tone === "blue" && "text-blue-600",
                        tone === "amber" && "text-amber-600",
                        tone === "red" && "text-red-600",
                      )}
                    >
                      {percent}%
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
