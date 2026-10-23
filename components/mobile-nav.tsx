import { signOutAction } from "@/app/actions/sign-out";
import MobileTabBar from "@/components/mobile-tab-bar";
import ServiceWorkerRegister from "@/components/service-worker-register";
import ThemeFloatingToggle from "@/components/theme-floating-toggle";
import { isGroupStudent } from "@/lib/group-membership";
import { createClient } from "@/lib/supabase/server";

export default async function MobileNav() {
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

  return (
    <>
      <ServiceWorkerRegister />

      <MobileTabBar
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        isInGroup={isInGroup}
        fullName={fullName}
        signOut={signOutAction}
      />

      <ThemeFloatingToggle />
    </>
  );
}
