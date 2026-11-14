import type { ReactNode } from "react";

import BackLink from "@/components/ui/back-link";
import { GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { cn } from "@/lib/utils";

/**
 * Sayt bo'ylab yagona sahifa sarlavhasi.
 *
 * Ilgari har bir sahifa o'z sarlavhasini qo'lda yozardi: kengligi,
 * yopishib turishi va shrift o'lchami sahifadan sahifaga farq
 * qilardi. Endi o'quvchi sahifalari ham, admin panel ham shu
 * komponentdan foydalanadi:
 *
 *   chapda  — qaytish tugmasi (BackLink), ostida sahifa nomi,
 *             bitta izoh va raqamli belgilar;
 *   o'ngda  — shu sahifaning asosiy amali (tugma yoki belgi);
 *   pastda  — ixtiyoriy qo'shimcha qator (masalan, admin tablari).
 *
 * Admin panelda yuqorida o'z menyusi yopishib turadi, shuning uchun
 * u yerda `sticky={false}` beriladi — aks holda ikki sarlavha
 * telefonda ekranning yarmini egallardi.
 */
const WIDTHS = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

/** Sarlavhadagi ikkinchi darajali tugma (oq, ramkali) */
export const headerButton =
  "edge inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700";

/** Sarlavhadagi asosiy tugma (brend ko'k) */
export const headerPrimaryButton =
  "press btn-solid inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-mb-brand px-4 text-sm font-bold text-white transition hover:bg-mb-brandDark";

export default function PageHeader({
  backHref,
  backLabel,
  backNative = false,
  title,
  subtitle,
  glyph,
  chips = [],
  action,
  children,
  width = "5xl",
  sticky = true,
}: {
  backHref?: string;
  backLabel?: string;
  /** Oddiy <a> (sahifa to'liq qayta yuklanadi) — video sahifalari uchun */
  backNative?: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Bo'lim belgisi — sarlavha chapida (components/ui/glyph.tsx) */
  glyph?: GlyphName;
  /** Raqamli belgilar: "12 ta test", "84 ta mavzu" */
  chips?: ReactNode[];
  /** O'ngdagi tugma yoki belgi */
  action?: ReactNode;
  /** Sarlavha ostidagi qo'shimcha qator (tablar, izoh) */
  children?: ReactNode;
  width?: keyof typeof WIDTHS;
  sticky?: boolean;
}) {
  const visibleChips = chips.filter(
    (chip) => chip !== null && chip !== undefined && chip !== false && chip !== "",
  );

  return (
    <header
      className={cn(
        "border-b border-mb-line bg-white/95 backdrop-blur",
        sticky && "sticky top-0 z-30",
      )}
    >
      <div className={cn("mx-auto px-4 py-2.5 sm:px-6 sm:py-3", WIDTHS[width])}>
        {backHref && (
          <BackLink
            href={backHref}
            label={backLabel ?? "Orqaga"}
            native={backNative}
            className="mb-1.5"
          />
        )}

        {/*
          Tor ekranda tugmalar sarlavhani siqib, sözni harfma-harf
          bölmasin ("Prof/il"): joy yetmasa tugmalar pastki qatorga tuşadi.
        */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-[9rem] flex-1 items-center gap-3">
            {glyph && <GlyphTile name={glyph} size="sm" />}

            <div className="min-w-0">
              <h1 className="line-clamp-2 break-normal text-xl font-extrabold leading-tight text-mb-ink sm:text-2xl">
                {title}
              </h1>

              {subtitle && (
                <div className="mt-0.5 line-clamp-2 text-sm text-mb-muted">{subtitle}</div>
              )}
            </div>
          </div>

          {action && (
            <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
              {action}
            </div>
          )}
        </div>

        {visibleChips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleChips.map((chip, index) => (
              <span
                key={index}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {children && <div className="mt-2">{children}</div>}
      </div>
    </header>
  );
}
