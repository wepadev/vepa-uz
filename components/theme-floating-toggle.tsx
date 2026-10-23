"use client";

import { usePathname } from "next/navigation";

import InstallAppButton from "@/components/install-app-button";
import ThemeToggle from "@/components/theme-toggle";

/*
 * Kompyuterda sayt bo'ylab doimiy sarlavha yo'q, shuning uchun
 * rejim tugmasi pastki o'ng burchakda suzib turadi.
 *
 * Mobil versiyada kerak emas — u yerda tugma "Menyu" ichida.
 * Admin panelda ham kerak emas — u yerda navigatsiyaga qo'yilgan.
 */
const HIDDEN_PREFIXES = [
  "/admin",
  "/auth",
  "/tests/take",
];

export default function ThemeFloatingToggle() {
  const pathname = usePathname() ?? "/";

  const hidden = HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (hidden) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 hidden items-center gap-2 md:flex">
      {/* Faqat Chrome o'rnatishga ruxsat berganda ko'rinadi */}
      <InstallAppButton variant="floating" />

      <ThemeToggle
        variant="icon"
        className="h-11 w-11 shadow-lg shadow-slate-900/10"
      />
    </div>
  );
}
