import type { ReactNode } from "react";

import { signOutAction } from "@/app/actions/sign-out";
import DesktopNav from "@/components/desktop-nav";
import MobileTabBar from "@/components/mobile-tab-bar";
import ServiceWorkerRegister from "@/components/service-worker-register";
import ThemeFloatingToggle from "@/components/theme-floating-toggle";
import {
  getBasicProfile,
  getCurrentUser,
  getIsGroupStudent,
} from "@/lib/supabase/current-user";

/**
 * Sayt navigatsiyasi: kompyuterda tepadagi menyu, telefonda pastki
 * tab bar. Foydalanuvchi ma'lumoti bir marta o'qiladi va ikkalasiga
 * beriladi.
 */
export default async function SiteNav({ children }: { children: ReactNode }) {
  let isAuthenticated = false;
  let isAdmin = false;
  let isInGroup = false;
  let fullName = "Öquvçi";

  try {
    const user = await getCurrentUser();

    if (user) {
      /*
       * Profil va guruh bir vaqtda so'raladi. Guruh sanog'i faol
       * bo'lmagan profil uchun ham keladi, lekin u holda ishlatilmaydi.
       */
      const [{ profile }, inGroup] = await Promise.all([
        getBasicProfile(user.id),
        getIsGroupStudent(user.id),
      ]);

      isAuthenticated = Boolean(profile && profile.is_active === true);
      isAdmin = isAuthenticated && profile?.role === "admin";
      fullName =
        profile?.full_name?.trim() || user.email?.split("@")[0] || "Öquvçi";

      /* Do'kon faqat guruh o'quvchisiga ko'rinadi */
      isInGroup = isAuthenticated && inGroup;
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
