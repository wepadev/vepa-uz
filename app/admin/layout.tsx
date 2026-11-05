import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import AdminNavigation from "@/components/admin/admin-navigation";
import {
  getBasicProfile,
  getCurrentUser,
} from "@/lib/supabase/current-user";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  /* Menyu ham shu profilni so'raydi — bir so'rovda bir marta o'qiladi */
  const { profile, error: profileError } = await getBasicProfile(user.id);

  if (
    profileError ||
    !profile ||
    profile.is_active !== true ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  return (
    <>
      <AdminNavigation />
      {children}
    </>
  );
}
