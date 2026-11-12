"use server";

/**
 * Uy vazifasi amallari: berish, yopish, o'chirish.
 *
 * Ilgari ular alohida "Uy vazifalari" sahifasida (`/admin/groups/view`)
 * edi. Endi vazifalar guruh sahifasining "Vazifalar" tabida turadi,
 * shuning uchun har bir amal o'sha tabga qaytadi.
 *
 * Formada ikkita id keladi: `crmGroupId` — qaytish manzili uchun,
 * `studyGroupId` — vazifa aynan shu guruhga yoziladi.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";

function ids(formData: FormData) {
  return {
    crmGroupId: Number(formData.get("crmGroupId")),
    studyGroupId: Number(formData.get("studyGroupId")),
  };
}

function tabPath(crmGroupId: number) {
  return `/admin/crm/guruh?id=${crmGroupId}&tab=vazifalar`;
}

/** Xatoni sahifaning o'zida ko'rsatish (throw matni production'da yashiriladi) */
function fail(crmGroupId: number, message: string): never {
  redirect(`${tabPath(crmGroupId)}&xato=${encodeURIComponent(message)}`);
}

function done(crmGroupId: number): never {
  revalidatePath("/admin/crm/guruh");
  redirect(tabPath(crmGroupId));
}

export async function createAssignment(formData: FormData) {
  const { crmGroupId, studyGroupId } = ids(formData);
  const testId = Number(formData.get("testId"));
  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();

  const supabase = await requireAdmin();

  if (!Number.isInteger(studyGroupId) || !Number.isInteger(testId)) {
    fail(crmGroupId, "Test tanlanmadi.");
  }

  if (!dueAtRaw) {
    fail(crmGroupId, "Muddatni kiriting.");
  }

  // datetime-local mahalliy vaqt beradi — Toshkent vaqti sifatida o'qiymiz
  const dueAt = new Date(`${dueAtRaw}:00+05:00`);

  if (Number.isNaN(dueAt.getTime())) {
    fail(crmGroupId, "Muddat notöğri.");
  }

  /*
   * Himoya: forma o'zgartirilib boshqa test yuborilmasin. Tekshiruv
   * testning nashr qilinganini va videodars testi emasligini ko'radi
   * (db/40: is_assignable_test).
   */
  const allowedResult = await supabase.rpc("is_assignable_test", {
    p_test_id: testId,
  });

  if (!allowedResult.error && allowedResult.data !== true) {
    fail(crmGroupId, "Bu testni vazifa qilib berib bölmaydi.");
  }

  const { error } = await supabase.from("assignments").insert({
    group_id: studyGroupId,
    test_id: testId,
    due_at: dueAt.toISOString(),
  });

  if (error) {
    fail(
      crmGroupId,
      error.code === "23505"
        ? "Bu test şu guruhga allaqaçon berilgan. Avval eskisini yoping."
        : `Vazifa berilmadi: ${error.message}`,
    );
  }

  done(crmGroupId);
}

export async function closeAssignment(formData: FormData) {
  const { crmGroupId } = ids(formData);
  const assignmentId = Number(formData.get("assignmentId"));

  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("assignments")
    .update({ is_active: false })
    .eq("id", assignmentId);

  if (error) {
    fail(crmGroupId, `Vazifa yopilmadi: ${error.message}`);
  }

  done(crmGroupId);
}

/**
 * Yopilgan vazifani ro'yxatdan butunlay o'chirish.
 *
 * O'quvchilarning natijalari o'chmaydi: attempts.assignment_id
 * "on delete set null" bilan bog'langan. Ochiq vazifani tasodifan
 * yo'qotib qo'ymaslik uchun avval yopish kerak.
 */
export async function deleteAssignment(formData: FormData) {
  const { crmGroupId } = ids(formData);
  const assignmentId = Number(formData.get("assignmentId"));

  const supabase = await requireAdmin();

  if (!Number.isInteger(assignmentId)) {
    fail(crmGroupId, "Vazifa topilmadi.");
  }

  const { data: assignment, error: readError } = await supabase
    .from("assignments")
    .select("id, is_active")
    .eq("id", assignmentId)
    .maybeSingle();

  if (readError) {
    fail(crmGroupId, `Vazifa tekşirilmadi: ${readError.message}`);
  }

  if (!assignment) {
    fail(crmGroupId, "Vazifa allaqaçon öçirilgan.");
  }

  if (assignment.is_active) {
    fail(crmGroupId, "Avval vazifani yoping, keyin öçiriş mumkin böladi.");
  }

  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    fail(crmGroupId, `Vazifa öçirilmadi: ${error.message}`);
  }

  done(crmGroupId);
}
