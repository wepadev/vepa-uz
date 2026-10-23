import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, ListChecks, Trash2 } from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import { GROUP_EXAM_CODE, GROUP_EXAM_TITLE } from "@/lib/group-tests";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Uy vazifalari",
  description: "Guruhga test berish va berilgan vazifalarni boshqarish.",
};

/**
 * Uy vazifalari sahifasi.
 *
 * Bu yerda faqat vazifa bilan ishlash bor. Guruh ma'lumotlari,
 * qo'shilish kodi, o'quvchilar ro'yxati, hisobot va guruhni
 * o'chirish — hammasi guruh sahifasida (`/admin/crm/guruh`).
 *
 * Ilgari hammasi bitta sahifada to'planib qolgan edi va kerakli
 * narsani topish qiyin edi.
 */

type PageProps = {
  searchParams: Promise<{
    groupId?: string | string[];
    xato?: string | string[];
  }>;
};

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

/**
 * Xatoni sahifaning o'zida ko'rsatish.
 *
 * `throw new Error(...)` ishlatib bo'lmaydi: Next.js production'da
 * server xatosining matnini yashiradi va admin "Nimadir noto'g'ri
 * ketdi" degan umumiy oynani ko'radi.
 */
function fail(groupId: number, message: string): never {
  redirect(
    `/admin/groups/view?groupId=${groupId}&xato=${encodeURIComponent(message)}`,
  );
}

async function createAssignment(formData: FormData) {
  "use server";

  const groupId = Number(formData.get("groupId"));
  const testId = Number(formData.get("testId"));
  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();

  const supabase = await requireAdmin();

  if (!Number.isInteger(groupId) || !Number.isInteger(testId)) {
    fail(groupId, "Test tanlanmadi.");
  }

  if (!dueAtRaw) {
    fail(groupId, "Muddatni kiriting.");
  }

  // datetime-local mahalliy vaqt beradi — Toshkent vaqti sifatida o'qiymiz
  const dueAt = new Date(`${dueAtRaw}:00+05:00`);

  if (Number.isNaN(dueAt.getTime())) {
    fail(groupId, "Muddat noto‘g‘ri.");
  }

  /*
   * Himoya: forma o'zgartirilib boshqa test yuborilmasin.
   *
   * Endi guruh testi ham, katalog testi ham beriladi — tekshiruv
   * testning nashr qilinganini va videodars testi emasligini
   * ko'radi (db/26).
   */
  const allowedResult = await supabase.rpc("is_group_only_test", {
    p_test_id: testId,
  });

  if (!allowedResult.error && allowedResult.data !== true) {
    fail(groupId, "Bu testni vazifa qilib berib bo‘lmaydi.");
  }

  const { error } = await supabase.from("assignments").insert({
    group_id: groupId,
    test_id: testId,
    due_at: dueAt.toISOString(),
  });

  if (error) {
    fail(
      groupId,
      error.code === "23505"
        ? "Bu test shu guruhga allaqachon berilgan. Avval eskisini yoping."
        : `Vazifa berilmadi: ${error.message}`,
    );
  }

  revalidatePath("/admin/groups/view");
}

/**
 * Yopilgan vazifani ro'yxatdan butunlay o'chirish.
 *
 * O'quvchilarning natijalari o'chmaydi: attempts.assignment_id
 * "on delete set null" bilan bog'langan, ya'ni urinishlar vazifadan
 * uziladi-yu, natijalar tarixida qolaveradi.
 *
 * Faqat yopilgan vazifani o'chirish mumkin — ochiq vazifani
 * tasodifan yo'qotib qo'ymaslik uchun avval yopish kerak.
 */
async function deleteAssignment(formData: FormData) {
  "use server";

  const assignmentId = Number(formData.get("assignmentId"));
  const groupId = Number(formData.get("groupId"));

  const supabase = await requireAdmin();

  if (!Number.isInteger(assignmentId)) {
    fail(groupId, "Vazifa topilmadi.");
  }

  const { data: assignment, error: readError } = await supabase
    .from("assignments")
    .select("id, is_active")
    .eq("id", assignmentId)
    .maybeSingle();

  if (readError) {
    fail(groupId, `Vazifa tekshirilmadi: ${readError.message}`);
  }

  if (!assignment) {
    fail(groupId, "Vazifa allaqachon o‘chirilgan.");
  }

  if (assignment.is_active) {
    fail(groupId, "Avval vazifani yoping, keyin o‘chirish mumkin bo‘ladi.");
  }

  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    fail(groupId, `Vazifa o‘chirilmadi: ${error.message}`);
  }

  revalidatePath("/admin/groups/view");
}

async function closeAssignment(formData: FormData) {
  "use server";

  const assignmentId = Number(formData.get("assignmentId"));
  const groupId = Number(formData.get("groupId"));

  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("assignments")
    .update({ is_active: false })
    .eq("id", assignmentId);

  if (error) {
    fail(groupId, `Vazifa yopilmadi: ${error.message}`);
  }

  revalidatePath("/admin/groups/view");
}

export default async function AdminGroupAssignmentsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const groupId = Number(single(params.groupId));
  const errorMessage = single(params.xato);

  if (!Number.isInteger(groupId) || groupId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const { data: group, error: groupError } = await supabase
    .from("study_groups")
    .select("id, title")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    throw new Error(`Guruh yuklanmadi: ${groupError.message}`);
  }

  if (!group) {
    notFound();
  }

  /*
   * Vazifa uchun testlar ikkita manbadan keladi:
   *   · "Guruhlar uchun maxsus testlar" — katalogda ko'rinmaydi
   *   · "Testlar bo'limi" — o'quvchilar katalogdan ham ishlaydi
   *
   * Videodarsga biriktirilgan testlar ro'yxatga tushmaydi.
   */
  const [testsResult, assignmentsResult, crmResult] = await Promise.all([
    supabase.rpc("assignable_tests"),

    supabase
      .from("assignments")
      .select("id, test_id, due_at, is_active, tests(title)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),

    supabase
      .from("crm_groups")
      .select("id")
      .eq("study_group_id", groupId)
      .maybeSingle(),
  ]);

  if (assignmentsResult.error) {
    throw new Error(
      `Vazifalar yuklanmadi: ${assignmentsResult.error.message}`,
    );
  }

  /* db/26 hali ishga tushirilmagan bo'lsa ro'yxat bo'sh qoladi */
  const tests = (testsResult.data ?? []) as TestOption[];
  const testsUnavailable = Boolean(testsResult.error);

  const groupTests = tests.filter((test) => test.source === "guruh");
  const catalogTests = tests.filter((test) => test.source === "katalog");

  const assignments = (assignmentsResult.data ??
    []) as unknown as AssignmentRow[];

  /* Orqaga havolasi guruh sahifasiga olib boradi */
  const crmGroupId = (crmResult.data as { id: number } | null)?.id ?? null;

  // datetime-local uchun default: ertaga 20:00 (Toshkent)
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const defaultDue = `${tomorrow.toISOString().slice(0, 10)}T20:00`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
        <Link
          href={
            crmGroupId ? `/admin/crm/guruh?id=${crmGroupId}` : "/admin/crm"
          }
          className="inline-flex min-h-8 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
        >
          ← Guruhga qaytish
        </Link>

        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <ListChecks
            className="h-6 w-6 text-mb-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          Uy vazifalari
        </h1>

        <p className="mt-1 text-sm text-mb-muted">{group.title}</p>

        {errorMessage && (
          <AppAlert variant="error" title="Bajarilmadi" className="mt-4">
            {errorMessage}
          </AppAlert>
        )}

        {/* Berilgan vazifalar tepada — eng ko'p shu ko'riladi */}
        {assignments.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
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
                      <input
                        type="hidden"
                        name="assignmentId"
                        value={assignment.id}
                      />
                      <input type="hidden" name="groupId" value={group.id} />

                      <SubmitButton className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                        Yopish
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={deleteAssignment}>
                      <input
                        type="hidden"
                        name="assignmentId"
                        value={assignment.id}
                      />
                      <input type="hidden" name="groupId" value={group.id} />

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
          <AppAlert variant="info" title="Hali vazifa yo‘q" className="mt-5">
            Pastdagi shakl orqali birinchi vazifani bering.
          </AppAlert>
        )}

        {/* Yangi vazifa berish — pastda */}
        <h2 className="mt-8 text-lg font-bold">Yangi vazifa berish</h2>

        {tests.length === 0 ? (
          <AppAlert
            variant={testsUnavailable ? "warning" : "info"}
            title={
              testsUnavailable
                ? "Ro‘yxat yuklanmadi"
                : "Tanlash uchun test yo‘q"
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
            <input type="hidden" name="groupId" value={group.id} />

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
              O‘quvchi vazifani faqat bir marta ishlaydi. Muddat tugagach
              yangi urinish boshlab bo‘lmaydi.
            </p>

            <p className="mt-1 text-xs leading-5 text-mb-muted">
              Vazifa natijasi guruh balliga va tangaga qo‘shiladi. Saytdagi
              umumiy reytingga qo‘shilmaydi — u faqat o‘quvchi katalogdan
              o‘zi ishlagan testlardan tuziladi.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
