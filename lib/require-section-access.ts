import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type SectionAccess =
  | "tests"
  | "lessons"
  | "textbooks";

export type ProfileAccess = {
  full_name: string | null;
  role: string;
  is_active: boolean;
  can_access_tests: boolean;
  can_access_lessons: boolean;
  can_access_textbooks: boolean;
  premium_until: string | null;
};

const accessField = {
  tests: "can_access_tests",
  lessons: "can_access_lessons",
} as const;

export function hasActivePremium(
  profile: ProfileAccess,
) {
  if (profile.role === "admin") {
    return true;
  }

  if (!profile.premium_until) {
    return false;
  }

  const expiresAt =
    new Date(
      profile.premium_until,
    ).getTime();

  return (
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now()
  );
}

export async function requireSectionAccess(
  section: SectionAccess,
) {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(`
      full_name,
      role,
      is_active,
      can_access_tests,
      can_access_lessons,
      can_access_textbooks,
      premium_until
    `)
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(
      `Profil ruxsatlari tekşirilmadi: ${profileError.message}`,
    );
  }

  if (
    !profile ||
    profile.is_active !== true
  ) {
    redirect("/");
  }

  const typedProfile =
    profile as ProfileAccess;

  /*
   * Darslik yechimlari barcha faol
   * foydalanuvchilar uchun bepul.
   */
  if (
    section !== "textbooks" &&
    typedProfile.role !== "admin"
  ) {
    const field =
      accessField[section];

    if (
      typedProfile[field] !== true
    ) {
      redirect(
        `/access-denied?section=${section}`,
      );
    }
  }

  return {
    supabase,
    user,
    profile: typedProfile,
    isPremium:
      hasActivePremium(
        typedProfile,
      ),
  };
}
