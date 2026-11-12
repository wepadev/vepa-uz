import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronRight, Lock } from "@/components/ui/icons";

import { cn } from "@/lib/utils";

/**
 * Röyxat qatori — bölim, mavzu, test, dars röyxatlari uçun yagona şakl.
 *
 * Ilgari har sahifa öz qatorini çizardi: birida ikonka plitkasi, birida
 * raqam, birida har qatorda "Premium" yorliği. Endi qator bitta:
 *
 *   [tartib raqami]  Nomi                         [holat] ›
 *                    qisqa ma'lumot
 *
 * Tartib raqami — matematikadagi kabi "nechançi" degan savolga javob.
 * Holat faqat kerak bölganda çiqadi: yaşil "Bepul", qulf yoki
 * bajarilgan belgisi. "Premium" sözi har qatorda takrorlanmaydi —
 * yopiq qatorda kiçik qulf turadi, izoh sahifada bir marta beriladi.
 */
export function RowList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-mb-line overflow-hidden rounded-2xl border border-mb-line bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Tone = "plain" | "done" | "current" | "locked";

const INDEX_TONE: Record<Tone, string> = {
  plain: "bg-slate-100 text-slate-600",
  done: "bg-vp-success-soft text-vp-success",
  current: "bg-mb-brand text-white",
  locked: "bg-slate-100 text-slate-400",
};

/** Qator boşidagi raqam plitkasi */
export function RowIndex({
  value,
  tone = "plain",
  className,
}: {
  value: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "num grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-bold",
        INDEX_TONE[tone],
        className,
      )}
    >
      {tone === "done" ? (
        <Check className="h-5 w-5" aria-hidden="true" />
      ) : tone === "locked" ? (
        <Lock className="h-[18px] w-[18px]" aria-hidden="true" />
      ) : (
        value
      )}
    </span>
  );
}

const TAG_TONE = {
  free: "bg-vp-success-soft text-vp-success",
  brand: "bg-mb-tintSoft text-mb-brandDark",
  accent: "bg-vp-accent-soft text-vp-accent-strong",
  neutral: "bg-slate-100 text-slate-600",
  danger: "bg-vp-danger-soft text-vp-danger",
} as const;

/** Kiçik holat yorliği: "Bepul", "Yangi", "3 kun qoldi" */
export function Tag({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof TAG_TONE;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
        TAG_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Yopiq qator belgisi (Premium kerak) */
export function RowLock() {
  return (
    <Lock
      className="h-[18px] w-[18px] shrink-0 text-slate-400"
      aria-label="Premium"
    />
  );
}

export function RowLink({
  href,
  lead,
  title,
  meta,
  trail,
  muted = false,
  className,
}: {
  /** Böş qoldirilsa qator bosilmaydi (masalan, hali tayyor bölmagan mavzu) */
  href?: string;
  lead?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Öng tomondagi holat: Tag, RowLock, foiz ... */
  trail?: ReactNode;
  /** Yopiq yoki böş qator — matn xiraroq */
  muted?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {lead}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] font-bold leading-snug sm:text-base",
            muted || !href ? "text-slate-500" : "text-mb-ink",
          )}
        >
          {title}
        </span>

        {meta && (
          <span className="num mt-0.5 block truncate text-[13px] text-mb-muted">
            {meta}
          </span>
        )}
      </span>

      {trail}
    </>
  );

  const shell =
    "group flex min-h-[64px] items-center gap-3 px-3.5 py-3 sm:px-4";

  if (!href) {
    return <div className={cn(shell, className)}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        shell,
        "transition-colors hover:bg-slate-50 active:bg-slate-100",
        className,
      )}
    >
      {body}

      <ChevronRight
        className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
