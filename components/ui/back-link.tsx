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
      ? "group inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.95]"
      : "group -ml-2 inline-flex h-9 max-w-full items-center gap-0.5 rounded-lg pl-1 pr-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mb-brand/50",
    /* Ko'rinishi 36 px, lekin barmoq uchun bosish maydoni 48 px */
    "relative before:absolute before:-inset-1.5 before:content-['']",
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
      <ChevronLeft
        className="h-5 w-5 transition group-hover:-translate-x-0.5"
        aria-hidden="true"
      />
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
