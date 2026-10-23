import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Admin ekanini tekshiradi va Supabase mijozini qaytaradi.
 *
 * Nega kerak: `app/admin/layout.tsx` faqat sahifani ochishni
 * to'sadi. Server action'lar esa alohida POST manzillari — ular
 * layout orqali o'tmaydi. Ya'ni action ichida tekshiruv bo'lmasa,
 * action nomini bilgan har qanday tizimga kirgan foydalanuvchi
 * uni chaqira olardi.
 *
 * Bazadagi RLS qoidalari ham himoya qiladi, lekin bu ikkinchi
 * qatlam: qoida noto'g'ri yozilgan yoki keyinchalik o'zgartirilgan
 * bo'lsa ham sayt ochilib qolmaydi.
 *
 * Qaytariladigan mijoz — foydalanuvchi sessiyasi bilan, ya'ni RLS
 * o'z kuchida qoladi. Bu ataylab: admin kaliti (service role) faqat
 * chindan kerak bo'lgan joyda ishlatiladi.
 */
export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.is_active !== true) {
    redirect("/");
  }

  return supabase;
}
