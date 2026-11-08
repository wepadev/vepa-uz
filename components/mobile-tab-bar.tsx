"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  House,
  Menu,
  MonitorPlay,
  type LucideIcon,
} from "lucide-react";

import InstallAppButton from "@/components/install-app-button";
import {
  isActivePath,
  isNavHidden,
  menuSections,
  primaryLinks,
  type NavSection,
  type NavUser,
} from "@/components/nav-links";
import ThemeToggle from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type MobileTabBarProps = NavUser & {
  fullName: string;
  signOut: () => Promise<void>;
};

const ICONS: Record<string, LucideIcon> = {
  "/homework": ClipboardList,
  "/tests": ClipboardCheck,
  "/lessons": MonitorPlay,
  "/textbooks": BookOpen,
};

/* Pastki qatorga Bosh va Menyudan tashqari nechta bo'lim sig'adi */
const TAB_SLOTS = 3;

export default function MobileTabBar({
  isAuthenticated,
  isAdmin,
  isInGroup,
  fullName,
  signOut,
}: MobileTabBarProps) {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);

  const hidden = isNavHidden(pathname);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /* Klaviaturada Esc — menyu yopiladi (shu oynalar uchun odatiy) */
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (hidden) return null;

  const user = { isAuthenticated, isAdmin, isInGroup };

  /*
   * Guruh o'quvchisida birinchi tab — "Vazifalar" (asosiy
   * foydalanuvchi shular). Sig'magan bo'lim (odatda Yechimlar)
   * menyuning boshiga o'tadi.
   */
  const primary = primaryLinks(user);

  const tabs = [
    { key: "/", label: "Boş", href: "/", match: "/", icon: House },
    ...primary.slice(0, TAB_SLOTS).map((link) => {
      const match = link.match ?? link.href;

      return {
        key: match,
        label: link.label,
        href: link.href,
        match,
        icon: ICONS[match] ?? ClipboardCheck,
      };
    }),
  ];

  const overflow = primary.slice(TAB_SLOTS);

  const sections: NavSection[] = [
    ...(overflow.length > 0
      ? [{ title: "Bölimlar", links: overflow }]
      : []),
    ...menuSections(user),
  ];

  return (
    <>
      {/* Fixed tab bar kontentning oxirini to'sib qo'ymasligi uchun */}
      <div
        aria-hidden="true"
        className="h-[calc(58px+env(safe-area-inset-bottom))] md:hidden"
      />

      {menuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menyu"
        >
          <button
            type="button"
            aria-label="Menyuni yopiş"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full animate-in fade-in-0 bg-slate-950/40 backdrop-blur-sm duration-200"
          />

          <div className="absolute inset-x-0 bottom-0 animate-in slide-in-from-bottom-8 fade-in-0 duration-200 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
            <div className="sticky top-0 bg-white px-5 pb-3 pt-3">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />

              <p className="mt-4 truncate text-base font-bold text-slate-900">
                {isAuthenticated ? fullName : "Vepa Ustoz"}
              </p>
              <p className="text-xs text-slate-500">
                {isAuthenticated
                  ? isAdmin
                    ? "Administrator"
                    : "Öquvçi"
                  : "Tizimga kirmagansiz"}
              </p>
            </div>

            <nav className="grid gap-1.5 px-4 pt-2">
              {sections.map((section) => (
                <div key={section.title} className="grid gap-1.5">
                  <p className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {section.title}
                  </p>

                  {section.links.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="press flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 active:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-slate-900">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {item.hint}
                        </span>
                      </span>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-slate-400"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              ))}

              {/* Faqat Chrome o'rnatishga ruxsat berganda ko'rinadi */}
              <InstallAppButton className="mt-1" />

              <div className="mt-1 rounded-2xl border border-slate-200 bg-white p-1">
                <ThemeToggle />
              </div>

              {/* Yopish — fon ustiga bosish va Esc ham yopadi */}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="mt-1 min-h-[52px] w-full rounded-2xl border border-slate-200 text-[15px] font-semibold text-slate-600 active:bg-slate-50"
              >
                Yopiş
              </button>

              {isAuthenticated && (
                <form action={signOut} className="pt-1">
                  <button
                    type="submit"
                    /*
                     * Matn mb-brand emas, mb-brandDark: havorang fon
                     * ustida ochiq ko'k yetarli o'qilmasdi (3.65),
                     * quyuqrog'i bilan 4.88 — me'yordan o'tadi.
                     */
                    className="min-h-[52px] w-full rounded-2xl border border-blue-200 bg-mb-tint px-4 text-[15px] font-semibold text-mb-brandDark active:bg-blue-200"
                  >
                    Çiqiş
                  </button>
                </form>
              )}
            </nav>
          </div>
        </div>
      )}

      <nav
        aria-label="Asosiy navigatsiya"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = isActivePath(pathname, tab.match);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 pt-1 transition-colors",
                  active
                    ? "text-mb-brand"
                    : "text-slate-500 active:text-slate-900",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors duration-200",
                    active && "bg-mb-tint",
                  )}
                >
                  <Icon
                    className="h-[22px] w-[22px] shrink-0"
                    strokeWidth={active ? 2.3 : 1.9}
                  />
                </span>
                <span className="w-full truncate text-center text-[11px] font-semibold leading-tight tracking-tight">
                  {tab.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className={cn(
              "flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 pt-1 transition-colors",
              menuOpen
                ? "text-mb-brand"
                : "text-slate-500 active:text-slate-900",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid h-7 w-12 place-items-center rounded-full transition-colors duration-200",
                menuOpen && "bg-mb-tint",
              )}
            >
              <Menu
                className="h-[22px] w-[22px] shrink-0"
                strokeWidth={menuOpen ? 2.3 : 1.9}
              />
            </span>
            <span className="w-full truncate text-center text-[11px] font-semibold leading-tight tracking-tight">
              Menyu
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
