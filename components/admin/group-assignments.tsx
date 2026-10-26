import Link from "next/link";
import { CalendarClock, Trash2 } from "lucide-react";

import {
  closeAssignment,
  createAssignment,
  deleteAssignment,
} from "@/app/admin/crm/vazifa-actions";
import AppAlert from "@/components/ui/app-alert";
import SubmitButton from "@/components/ui/submit-button";
import { GROUP_EXAM_CODE, GROUP_EXAM_TITLE } from "@/lib/group-tests";
import { createClient } from "@/lib/supabase/server";

/**
 * Guruh sahifasining "Vazifalar" tabi.
 *
 * Tepada "Yangi vazifa berish" shakli (eng ko'p shu kerak), pastda
 * berilgan vazifalar: natijalarni ko'rish, yopish, o'chirish.
 *
 * Vazifa uchun testlar ikkita manbadan keladi:
 *   · "Guruhlar uchun maxsus testlar" — katalogda ko'rinmaydi
 *   · "Testlar bo'limi" — o'quvchilar katalogdan ham ishlaydi
 * Videodarsga biriktirilgan testlar ro'yxatga tushmaydi.
 */
type TestOption = {
  test_id: number;
  test_title: string;
  section_title: string;
  question_count: number;
  /** 'guruh' — faqat guruhlar uchun; 'katalog' — Testlar bo'limi */
  source: string;
};

type AssignmentRow = {
  id: number;
  test_id: number;
  due_at: string;
  is_active: boolean;
  tests: { title: string } | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

export default async function GroupAssignments({
  crmGroupId,
  studyGroupId,
}: {
  crmGroupId: number;
  studyGroupId: number;
}) {
  const supabase = await createClient();

  const [testsResult, assignmentsResult] = await Promise.all([
    supabase.rpc("assignable_tests"),

    supabase
      .from("assignments")
      .select("id, test_id, due_at, is_active, tests(title)")
      .eq("group_id", studyGroupId)
      .order("created_at", { ascending: false }),
  ]);

  /* db/26 hali ishga tushirilmagan bo'lsa ro'yxat bo'sh qoladi */
  const tests = (testsResult.data ?? []) as TestOption[];
  const testsUnavailable = Boolean(testsResult.error);

  const groupTests = tests.filter((test) => test.source === "guruh");
  const catalogTests = tests.filter((test) => test.source === "katalog");

  const assignments = (assignmentsResult.data ??
    []) as unknown as AssignmentRow[];

  // datetime-local uchun default: ertaga 20:00 (Toshkent)
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const defaultDue = `${tomorrow.toISOString().slice(0, 10)}T20:00`;

  const hidden = (
    <>
      <input type="hidden" name="crmGroupId" value={crmGroupId} />
      <input type="hidden" name="studyGroupId" value={studyGroupId} />
    </>
  );

  return (
    <>
      <h2 className="mt-6 text-lg font-bold">Yangi vazifa berish</h2>

      {tests.length === 0 ? (
        <AppAlert
          variant={testsUnavailable ? "warning" : "info"}
          title={
            testsUnavailable ? "Ro‘yxat yuklanmadi" : "Tanlash uchun test yo‘q"
          }
          className="mt-3"
        >
          {testsUnavailable ? (
            <>
              Supabase’da <b>db/26-vazifa-balli.sql</b> faylini ishga
              tushiring — vazifa uchun testlar shundan keyin ko‘rinadi.
            </>
          ) : (
            <>
              Avval test yarating va nashr qiling.{" "}
              <Link
                href={`/admin/tests/sections?exam=${GROUP_EXAM_CODE}`}
                className="font-semibold text-mb-brand underline underline-offset-2"
              >
                {GROUP_EXAM_TITLE}
              </Link>{" "}
              yo‘nalishi shu uchun mo‘ljallangan.
            </>
          )}
        </AppAlert>
      ) : (
        <form
          action={createAssignment}
          className="mt-3 rounded-2xl border border-mb-line bg-white p-4 shadow-sm"
        >
          {hidden}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div>
              <label
                htmlFor="testId"
                className="text-sm font-semibold text-slate-700"
              >
                Test
              </label>

              <select
                id="testId"
                name="testId"
                required
                className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              >
                {groupTests.length > 0 && (
                  <optgroup label={GROUP_EXAM_TITLE}>
                    {groupTests.map((test) => (
                      <option key={test.test_id} value={test.test_id}>
                        {test.test_title} ({test.question_count} ta savol)
                      </option>
                    ))}
                  </optgroup>
                )}

                {catalogTests.length > 0 && (
                  <optgroup label="Testlar bo‘limi">
                    {catalogTests.map((test) => (
                      <option key={test.test_id} value={test.test_id}>
                        {test.section_title} — {test.test_title} (
                        {test.question_count} ta savol)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="dueAt"
                className="text-sm font-semibold text-slate-700"
              >
                Muddat
              </label>

              <input
                id="dueAt"
                name="dueAt"
                type="datetime-local"
                required
                defaultValue={defaultDue}
                className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <SubmitButton className="mt-3 min-h-12 w-full rounded-xl bg-mb-brand px-6 font-semibold text-white transition hover:bg-mb-brandDark sm:w-auto">
            Vazifa berish
          </SubmitButton>

          <p className="mt-2 text-xs leading-5 text-mb-muted">
            O‘quvchi vazifani faqat bir marta ishlaydi. Natija guruh balliga
            va tangaga qo‘shiladi.
          </p>
        </form>
      )}

      <h2 className="mt-8 text-lg font-bold">Berilgan vazifalar</h2>

      {assignments.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
          {assignments.map((assignment, index) => (
            <div
              key={assignment.id}
              className={
                index === 0
                  ? "flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  : "flex flex-wrap items-center justify-between gap-3 border-t border-mb-line px-4 py-3"
              }
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-mb-ink">
                  {assignment.tests?.title ?? "Test"}
                </p>

                <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-mb-muted">
                  <CalendarClock
                    className="h-3.5 w-3.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {formatDateTime(assignment.due_at)}
                  {!assignment.is_active && " · yopilgan"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/assignments/view?id=${assignment.id}`}
                  className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Natijalar
                </Link>

                {assignment.is_active ? (
                  <form action={closeAssignment}>
                    {hidden}
                    <input
                      type="hidden"
                      name="assignmentId"
                      value={assignment.id}
                    />

                    <SubmitButton className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                      Yopish
                    </SubmitButton>
                  </form>
                ) : (
                  <form action={deleteAssignment}>
                    {hidden}
                    <input
                      type="hidden"
                      name="assignmentId"
                      value={assignment.id}
                    />

                    <SubmitButton
                      title="Vazifani ro‘yxatdan o‘chirish (natijalar saqlanadi)"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2
                        className="h-3.5 w-3.5"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      O‘chirish
                    </SubmitButton>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-mb-line bg-white px-4 py-3 text-sm text-mb-muted">
          Hali vazifa berilmagan.
        </p>
      )}
    </>
  );
}
