import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  /** Sahifa manzilini yasaydi — mavjud filtrlar saqlanishi kerak */
  hrefFor: (page: number) => string;
  /** Jami nechta yozuv borligi — "1–25 / 130" yozuvi uchun */
  totalItems?: number;
  pageSize?: number;
};

/**
 * Sahifalar orasida o'tish.
 *
 * Ro'yxatlar uzun bo'lganda hammasini bir sahifada chiqarish
 * brauzerni sekinlashtiradi. Bu komponent barcha uzun ro'yxatlarda
 * bir xil ko'rinishda ishlatiladi.
 *
 * Havolalar oddiy `<Link>` — JavaScript ishlamasa ham o'tish
 * mumkin va sahifani ulashsa o'sha joyi ochiladi.
 */
export default function Pagination({
  currentPage,
  totalPages,
  hrefFor,
  totalItems,
  pageSize,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  /*
   * Ko'rsatiladigan raqamlar: birinchi, oxirgi va joriy sahifa
   * atrofidagilar. Qolgani "…" bilan qisqartiriladi — 40 ta sahifa
   * bo'lganda ham qator uzayib ketmaydi.
   */
  const pages = new Set<number>([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  const ordered = [...pages].sort((a, b) => a - b);

  const from =
    pageSize && totalItems
      ? Math.min((currentPage - 1) * pageSize + 1, totalItems)
      : null;

  const to =
    pageSize && totalItems
      ? Math.min(currentPage * pageSize, totalItems)
      : null;

  const arrowClass =
    "inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition sm:hover:bg-slate-50";

  return (
    <nav
      aria-label="Sahifalar"
      className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      {from && to && totalItems ? (
        <p className="text-sm text-mb-muted">
          {from}–{to} / {totalItems}
        </p>
      ) : (
        <span />
      )}

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {currentPage > 1 ? (
          <Link
            href={hrefFor(currentPage - 1)}
            aria-label="Oldingi sahifa"
            className={arrowClass}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className={cn(arrowClass, "opacity-40")}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
          </span>
        )}

        {ordered.map((page, index) => {
          const previous = ordered[index - 1];
          const gap = previous !== undefined && page - previous > 1;

          return (
            <span key={page} className="flex items-center gap-1.5">
              {gap && (
                <span className="px-1 text-sm text-mb-muted" aria-hidden="true">
                  …
                </span>
              )}

              {page === currentPage ? (
                <span
                  aria-current="page"
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-mb-brand px-3 text-sm font-bold text-white"
                >
                  {page}
                </span>
              ) : (
                <Link
                  href={hrefFor(page)}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition sm:hover:bg-slate-50"
                >
                  {page}
                </Link>
              )}
            </span>
          );
        })}

        {currentPage < totalPages ? (
          <Link
            href={hrefFor(currentPage + 1)}
            aria-label="Keyingi sahifa"
            className={arrowClass}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className={cn(arrowClass, "opacity-40")}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
          </span>
        )}
      </div>
    </nav>
  );
}
