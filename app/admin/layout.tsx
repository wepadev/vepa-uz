import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import AdminNavigation from "@/components/admin/admin-navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

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
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

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
