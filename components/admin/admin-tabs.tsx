import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Admin sahifalaridagi tablar qatori.
 *
 * Tablar oddiy havolalar (`?tab=...` yoki boshqa sahifa): server
 * komponentida ishlaydi, orqaga tugmasi ham to'g'ri qaytaradi va
 * forma yuborilgandan keyin o'sha tabga qaytish oson.
 *
 * Telefonda qator ekranga sig'masa chapga-o'ngga suriladi, lekin
 * tablar soni ataylab kam (2–4 ta).
 */
export type AdminTab = {
  href: string;
  label: string;
  icon?: LucideIcon;
  /* Yorliq yonidagi son, masalan faol vazifalar */
  count?: number;
};

export default function AdminTabs({
  tabs,
  active,
  className,
}: {
  tabs: AdminTab[];
  /* Faol tabning `href` qiymati */
  active: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Bo‘limlar"
      className={cn(
        "-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0",
        className,
      )}
    >
      <div className="inline-flex min-w-full gap-1 rounded-2xl border border-mb-line bg-white p-1 shadow-sm sm:min-w-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.href === active;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition sm:flex-none sm:px-4",
                isActive
                  ? "bg-mb-brand text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {Icon && (
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              )}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
