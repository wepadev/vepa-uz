import Link from "next/link";

import ThemeToggle from "@/components/theme-toggle";
import BrandMark from "@/components/ui/brand-mark";

/**
 * Admin panelining yuqori qatori.
 *
 * Ilgari bu yerda o'nta bo'limli menyu turardi. Telefonda u
 * ekranga sig'masdi va chapga-o'ngga surilardi — yarim bo'lim
 * ko'rinmay qolardi, qaysi birida turganini bilish qiyin edi.
 *
 * Endi bo'limlarga faqat boshqaruv panelidagi kartalar orqali
 * kiriladi, har bir sahifada esa "← Admin panelga qaytish"
 * havolasi bor. Yuqorida faqat uchta narsa qoldi: brend, tun
 * rejimi va saytning o'zi.
 */
export default function AdminNavigation() {
  return (
    <header className="sticky top-0 z-50 border-b border-mb-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-5">
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-2.5"
        >
          <BrandMark size={32} className="h-8 w-8 shrink-0" />

          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-mb-ink">
              Vepa Ustoz
            </span>

            <span className="block text-[11px] font-semibold text-mb-muted">
              Administrator
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle variant="icon" />

          <Link
            href="/"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-4"
          >
            Saytni ko‘rish
          </Link>
        </div>
      </div>
    </header>
  );
}
