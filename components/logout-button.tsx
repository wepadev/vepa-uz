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
  label = "Çiqiş",
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
        "edge inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-60",
        className,
      )}
    >
      {isLoading ? "Çiqilmoqda..." : label}
    </button>
  );
}
