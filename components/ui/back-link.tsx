import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sayt bo'ylab yagona "orqaga" tugmasi.
 *
 * Ilgari har sahifada "← Admin panelga qaytiş" degan ko'k matnli
 * havola bor edi: telefonda barmoq bilan bosish qiyin, sarlavhaga
 * yopishib turardi va har sahifada boshqacha ko'rinardi.
 *
 * Endi u kichik "pill" tugma: chapda aylana ichida strelka, yonida
 * qayerga qaytishi (qisqa: "Admin panel", "Darslar"). Bosish maydoni
 * 36px, uzun nomlar bir qatorda qisqartiriladi.
 *
 * `iconOnly` — faqat aylana strelka (sarlavha yonida joy tor bo'lsa),
 * `label` bu holda ekran o'quvchilar uchun aria-label bo'ladi.
 *
 * `native` — sahifa to'liq qayta yuklanishi kerak bo'lgan joylar
 * uchun oddiy <a> qaytaradi (Next Link emas).
 */
export default function BackLink({
  href,
  label = "Orqaga",
  native = false,
  iconOnly = false,
  className,
}: {
  href: string;
  label?: string;
  native?: boolean;
  iconOnly?: boolean;
  className?: string;
}) {
  const classes = cn(
    iconOnly
      ? "group inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-mb-line bg-white text-mb-brand shadow-sm transition hover:border-mb-brand/40 hover:bg-mb-tintSoft active:scale-[0.95]"
      : "group inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-mb-line bg-white py-1 pl-1 pr-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-mb-brand/40 hover:bg-mb-tintSoft hover:text-mb-brand active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mb-brand/50",
    className,
  );

  const content = iconOnly ? (
    <ChevronLeft
      className="h-5 w-5 transition group-hover:-translate-x-0.5"
      strokeWidth={2.4}
      aria-hidden="true"
    />
  ) : (
    <>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mb-tintSoft text-mb-brand transition group-hover:-translate-x-0.5 group-hover:bg-mb-tint">
        <ChevronLeft className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
      </span>
      <span className="truncate">{label}</span>
    </>
  );

  if (native) {
    return (
      <a href={href} className={classes} aria-label={iconOnly ? label : undefined}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} aria-label={iconOnly ? label : undefined}>
      {content}
    </Link>
  );
}
