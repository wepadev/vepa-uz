import type { ReactNode } from "react";

import { signOutAction } from "@/app/actions/sign-out";
import DesktopNav from "@/components/desktop-nav";
import MobileTabBar from "@/components/mobile-tab-bar";
import ServiceWorkerRegister from "@/components/service-worker-register";
import ThemeFloatingToggle from "@/components/theme-floating-toggle";
import { isGroupStudent } from "@/lib/group-membership";
import { createClient } from "@/lib/supabase/server";

/**
 * Sayt navigatsiyasi: kompyuterda tepadagi menyu, telefonda pastki
 * tab bar. Foydalanuvchi ma'lumoti bir marta o'qiladi va ikkalasiga
 * beriladi.
 */
export default async function SiteNav({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  let isAuthenticated = false;
  let isAdmin = false;
  let isInGroup = false;
  let fullName = "O‘quvchi";

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      const profile = data as
        | { full_name: string | null; role: string; is_active: boolean }
        | null;

      isAuthenticated = Boolean(profile && profile.is_active === true);
      isAdmin = isAuthenticated && profile?.role === "admin";
      fullName =
        profile?.full_name?.trim() || user.email?.split("@")[0] || "O‘quvchi";

      /* Do'kon faqat guruh o'quvchisiga ko'rinadi */
      if (isAuthenticated) {
        isInGroup = await isGroupStudent(supabase, user.id);
      }
    }
  } catch {
    // Navigatsiya profil xatosi tufayli sahifani buzmasligi kerak
  }

  const navProps = {
    isAuthenticated,
    isAdmin,
    isInGroup,
    fullName,
    signOut: signOutAction,
  };

  return (
    <>
      <DesktopNav {...navProps} />

      {children}

      <ServiceWorkerRegister />

      <MobileTabBar {...navProps} />

      <ThemeFloatingToggle />
    </>
  );
}
