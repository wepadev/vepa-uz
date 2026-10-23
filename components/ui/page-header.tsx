import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Sayt bo'ylab yagona sahifa sarlavhasi.
 *
 * Ilgari har bir sahifa o'z sarlavhasini qo'lda yozardi: birida
 * brend nomi, boshqasida "Salom, ism", uchinchisida beshta tugma.
 * Natijada bir saytdek his qilinmasdi.
 *
 * Endi hamma joyda bir xil: chapda qayerdan kelgani, ostida sahifa
 * nomi va bitta izoh, o'ngda esa shu sahifaning asosiy amali.
 * Admin panel ham shu sarlavhadan foydalanadi.
 */
export default function PageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  chips = [],
  action,
}: {
  backHref?: string;
  backLabel?: string;
  title: string;
  subtitle?: string | null;
  /** Raqamli belgilar: "12 ta test", "84 ta mavzu" */
  chips?: string[];
  /** O'ngdagi tugma yoki belgi */
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex min-h-7 items-center gap-0.5 text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              <ChevronLeft
                className="h-4 w-4"
                strokeWidth={2.4}
                aria-hidden="true"
              />
              {backLabel ?? "Orqaga"}
            </Link>
          )}

          <h1 className="truncate text-lg font-bold sm:text-xl">
            {title}
          </h1>

          {subtitle && (
            <p className="truncate text-sm text-mb-muted">{subtitle}</p>
          )}

          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
