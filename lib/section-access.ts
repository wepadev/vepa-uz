import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type SectionName =
  | "textbooks"
  | "lessons"
  | "tests";

type ProfileAccess = {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  auth_provider: string;
  can_access_textbooks: boolean;
  can_access_lessons: boolean;
  can_access_tests: boolean;
};

function hasSectionAccess(
  profile: ProfileAccess,
  section: SectionName,
) {
  /*
   * Administrator barcha bo‘limlarga
   * avtomatik ravishda kira oladi.
   */
  if (profile.role === "admin") {
    return true;
  }

  if (section === "textbooks") {
    return profile.can_access_textbooks;
  }

  if (section === "lessons") {
    return profile.can_access_lessons;
  }

  if (section === "tests") {
    return profile.can_access_tests;
  }

  return false;
}

export async function requireSectionAccess(
  section: SectionName,
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  /*
   * Login qilmagan foydalanuvchi
   * login sahifasiga yuboriladi.
   */
  if (userError || !user) {
    redirect(
      `/auth/login?next=${encodeURIComponent(
        `/${section}`,
      )}`,
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      role,
      is_active,
      auth_provider,
      can_access_textbooks,
      can_access_lessons,
      can_access_tests
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Foydalanuvchi ruxsatlari yuklanmadi: ${profileError.message}`,
    );
  }

  /*
   * Profil topilmasa yoki bloklangan bo‘lsa,
   * foydalanuvchi sayt ichki bo‘limlariga
   * kira olmaydi.
   */
  if (
    !profile ||
    profile.is_active !== true
  ) {
    redirect("/access-required?reason=inactive");
  }

  const typedProfile =
    profile as ProfileAccess;

  /*
   * Bo‘limga ruxsat bo‘lmasa,
   * tushuntirish sahifasiga yuboriladi.
   */
  if (
    !hasSectionAccess(
      typedProfile,
      section,
    )
  ) {
    redirect(
      `/access-required?section=${section}`,
    );
  }

  return {
    supabase,
    user,
    profile: typedProfile,
  };
}