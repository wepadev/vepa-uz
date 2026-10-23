"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  /**
   * "switch" — yozuv bilan, menyu ichida
   * "icon"   — faqat ikonka, sarlavha yonida
   */
  variant?: "switch" | "icon";
  className?: string;
};

export default function ThemeToggle({
  variant = "switch",
  className,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  /*
   * Server tomonda qaysi rejim tanlanganini bilib bo'lmaydi (u
   * localStorage'da). Shu sababli birinchi renderda holatni
   * ko'rsatmaymiz — aks holda hydration mos kelmaydi.
   */
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={
          mounted
            ? isDark
              ? "Kun rejimiga o‘tish"
              : "Tun rejimiga o‘tish"
            : "Rejimni almashtirish"
        }
        className={cn(
          "inline-grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition sm:hover:bg-slate-50",
          className,
        )}
      >
        {mounted && isDark ? (
          <Sun className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Moon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={mounted ? isDark : false}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition sm:hover:bg-slate-50",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
          {mounted && isDark ? (
            <Moon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Sun className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          )}
        </span>

        <span className="text-[15px] font-semibold text-slate-800">
          Tun rejimi
        </span>
      </span>

      {/* Switch */}
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          mounted && isDark ? "bg-mb-brand" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            mounted && isDark ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        />
      </span>
    </button>
  );
}
