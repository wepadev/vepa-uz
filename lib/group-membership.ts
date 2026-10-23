import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * O'quvchi biror guruhda turibdimi?
 *
 * Do'kon va tanga faqat guruh ichida ma'noga ega, shuning uchun
 * menyuda ham, bosh sahifada ham do'kon havolasi shu tekshiruvga
 * qarab ko'rsatiladi.
 *
 * `study_group_members` da o'quvchining o'z qatorini o'qish
 * huquqi bor (db/01 dagi `group_members_self_read` siyosati),
 * shu sababli qo'shimcha funksiya chaqirilmaydi — bitta yengil
 * sanoq yetarli.
 *
 * Xato bo'lsa `false` qaytadi: navigatsiya baza xatosi tufayli
 * buzilib qolmasin.
 */
export async function isGroupStudent(
  supabase: SupabaseServerClient,
  userId: string,
) {
  try {
    const { count, error } = await supabase
      .from("study_group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      return false;
    }

    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}
