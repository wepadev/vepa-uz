"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  label?: string;
  className?: string;
};

export function LogoutButton({
  label = "Chiqish",
  className,
}: LogoutButtonProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] =
    useState(false);

  async function logout() {
    setIsLoading(true);

    const supabase = createClient();
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      setIsLoading(false);
      return;
    }

    router.push("/auth/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={isLoading}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60",
        className,
      )}
    >
      {isLoading ? "Chiqilmoqda..." : label}
    </button>
  );
}
