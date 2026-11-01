import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  RotateCcw,
  TrendingDown,
  XCircle,
} from "lucide-react";

import MathText from "@/components/math-text";

import AppAlert from "@/components/ui/app-alert";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import SubmitButton from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    id?: string | string[];
    xato?: string | string[];
  }>;
};

type MemberRow = {
  user_id: string;
  profiles: { full_name: string | null } | null;
};

type QuestionStatRow = {
  question_id: number;
  order_number: number;
  question_text: string;
  part_label: string | null;
  correct_answer: string | null;
  answered_count: number;
  correct_count: number;
  correct_percent: number | string;
};

type AttemptRow = {
  id: string;
  user_id: string;
  percentage: number | string | null;
  score: number | null;
  total_questions: number | null;
  completed_at: string | null;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

/** Xabarni sahifada ko'rsatish \u2014 prod'da throw matni yashiriladi */
function fail(assignmentId: number, message: string): never {
  redirect(
    `/admin/assignments/view?id=${assignmentId}&xato=${encodeURIComponent(
      message,
    )}`,
  );
}

async function reopenForStudent(formData: FormData) {
  "use server";

  const assignmentId = Number(formData.get("assignmentId"));
  const userId = String(formData.get("userId") ?? "");

  const supabase = await requireAdmin();

  if (!Number.isInteger(assignmentId) || !userId) {
    fail(assignmentId, "Ma\u2019lumot notöğri.");
  }

  const { error } = await supabase.rpc("reopen_assignment_for_student", {
    p_assignment_id: assignmentId,
    p_user_id: userId,
  });

  if (error) {
    fail(assignmentId, `Qayta oçilmadi: ${error.message}`);
  }

  revalidatePath("/admin/assignments/view");
}

export default async function AdminAssignmentViewPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const assignmentId = Number(single(params.id));
  const errorMessage = single(params.xato);

  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select(
      "id, group_id, test_id, due_at, is_active, tests(title), study_groups(title)",
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(`Vazifa yuklanmadi: ${assignmentError.message}`);
  }

  if (!assignment) {
    notFound();
  }

  const test = Array.isArray(assignment.tests)
    ? assignment.tests[0]
    : assignment.tests;

  const group = Array.isArray(assignment.study_groups)
    ? assignment.study_groups[0]
    : assignment.study_groups;

  // Tashlab ketilgan sessiyalar natijalarda ko'rinishi uchun
  await supabase.rpc("close_abandoned_sessions");

  const [membersResult, attemptsResult, statsResult] = await Promise.all([
    supabase
      .from("study_group_members")
      .select("user_id, profiles(full_name)")
      .eq("group_id", assignment.group_id),

    supabase
      .from("attempts")
      .select("id, user_id, percentage, score, total_questions, completed_at")
      .eq("assignment_id", assignmentId),

    supabase.rpc("assignment_question_stats", {
      p_assignment_id: assignmentId,
    }),
  ]);

  if (membersResult.error) {
    throw new Error(`A’zolar yuklanmadi: ${membersResult.error.message}`);
  }

  if (attemptsResult.error) {
    throw new Error(`Natijalar yuklanmadi: ${attemptsResult.error.message}`);
  }

  const questionStats = (statsResult.data ?? []) as QuestionStatRow[];

  const members = (membersResult.data ?? []) as unknown as MemberRow[];
  const attempts = (attemptsResult.data ?? []) as AttemptRow[];

  const attemptByUser = new Map<string, AttemptRow>();
  for (const attempt of attempts) {
    attemptByUser.set(attempt.user_id, attempt);
  }

  const rows = members
    .map((member) => ({
      userId: member.user_id,
      name:
        member.profiles?.full_name?.trim() || "Ism körsatilmagan",
      attempt: attemptByUser.get(member.user_id) ?? null,
    }))
    .sort((a, b) => {
      // Ishlaganlar tepada, foiz bo'yicha kamayish tartibida
      if (Boolean(a.attempt) !== Boolean(b.attempt)) {
        return a.attempt ? -1 : 1;
      }
      return (
        Number(b.attempt?.percentage ?? 0) -
        Number(a.attempt?.percentage ?? 0)
      );
    });

  const doneCount = rows.filter((r) => r.attempt).length;

  const averagePercentage =
    doneCount > 0
      ? Math.round(
          rows
            .filter((r) => r.attempt)
            .reduce(
              (sum, r) => sum + Number(r.attempt?.percentage ?? 0),
              0,
            ) / doneCount,
        )
      : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
        <Link
          href={`/admin/groups/view?groupId=${assignment.group_id}`}
          className="inline-flex min-h-8 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
        >
          ← {group?.title ?? "Guruhga qaytiş"}
        </Link>

        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          {test?.title ?? "Vazifa"}
        </h1>

        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-mb-muted">
          <CalendarClock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Muddat: {formatDateTime(assignment.due_at)}
          {!assignment.is_active && " · vazifa yopilgan"}
        </p>

        {errorMessage && (
          <AppAlert
            variant="error"
            title="Bajarilmadi"
            className="mt-4"
          >
            {errorMessage}
          </AppAlert>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-mb-line bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold text-mb-muted">Işladi</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {doneCount}
            </p>
          </div>

          <div className="rounded-2xl border border-mb-line bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold text-mb-muted">Işlamadi</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {rows.length - doneCount}
            </p>
          </div>

          <div className="rounded-2xl border border-mb-line bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold text-mb-muted">Örtaça</p>
            <p className="mt-1 text-2xl font-bold text-mb-brand">
              {averagePercentage}%
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <AppAlert variant="info" title="Guruhda öquvçi yöq" className="mt-6">
            Avval öquvçilarni guruhga qöşing.
          </AppAlert>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
            {rows.map((row, index) => (
              <div
                key={row.userId}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3",
                  index > 0 && "border-t border-mb-line",
                  !row.attempt && "bg-red-50/40",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-mb-ink">
                    {row.name}
                  </p>

                  {row.attempt?.completed_at && (
                    <p className="text-xs text-mb-muted">
                      {formatDateTime(row.attempt.completed_at)}
                      {row.attempt.total_questions
                        ? ` · ${row.attempt.score ?? 0}/${row.attempt.total_questions}`
                        : ""}
                    </p>
                  )}
                </div>

                {row.attempt ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {/*
                      Admin uchun /admin/results/view kerak.
                      Oddiy /results/view faqat o'z natijasini ko'rsatadi
                      (user_id bo'yicha filtrlaydi), shuning uchun
                      boshqa o'quvchining urinishida 404 chiqardi.
                    */}
                    <Link
                      href={`/admin/results/view?attemptId=${row.attempt.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:underline"
                    >
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                      {Math.round(Number(row.attempt.percentage ?? 0))}%
                    </Link>

                    <form action={reopenForStudent}>
                      <input type="hidden" name="assignmentId" value={assignmentId} />
                      <input type="hidden" name="userId" value={row.userId} />
                      <SubmitButton
                        title="Vazifani şu öquvçi uçun qayta oçiş"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition hover:border-mb-brand hover:text-mb-brand"
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        Qayta oçiş
                      </SubmitButton>
                    </form>
                  </div>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-red-600">
                    <XCircle className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                    Işlamadi
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sinf bo'yicha savol tahlili */}
        {questionStats.length > 0 && doneCount > 0 && (
          <div className="mt-8">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold">
              <TrendingDown className="h-5 w-5 text-mb-muted" strokeWidth={2} aria-hidden="true" />
              Savol tahlili
            </h2>

            <p className="mt-1 text-sm leading-6 text-mb-muted">
              Eng köp xato qilingan savollar tepada. Keyingi darsda
              şu mavzularni takrorlang.
            </p>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              {questionStats.map((stat, index) => {
                const percent = Math.round(Number(stat.correct_percent ?? 0));

                const tone =
                  percent < 40
                    ? "bg-red-500"
                    : percent < 70
                      ? "bg-amber-500"
                      : "bg-emerald-500";

                return (
                  <div
                    key={stat.question_id}
                    className={cn(
                      "px-4 py-3",
                      index > 0 && "border-t border-mb-line",
                      percent < 40 && "bg-red-50/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-mb-muted">
                          {stat.order_number}-savol
                          {stat.part_label ? ` (${stat.part_label})` : ""}
                          {stat.correct_answer
                            ? ` · töğri javob: ${stat.correct_answer}`
                            : ""}
                        </p>

                        <div className="mt-1 line-clamp-2 text-sm leading-6 text-mb-ink">
                          <MathText content={stat.question_text} />
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-lg font-bold",
                            percent < 40
                              ? "text-red-600"
                              : percent < 70
                                ? "text-amber-600"
                                : "text-emerald-600",
                          )}
                        >
                          {percent}%
                        </p>
                        <p className="text-[11px] text-mb-muted">
                          {stat.correct_count}/{stat.answered_count}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full", tone)}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
