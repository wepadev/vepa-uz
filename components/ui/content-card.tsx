import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import {
  accents,
  type Accent,
} from "@/components/ui/section-visual";
import { cn } from "@/lib/utils";

type ContentCardProps = {
  href: string;
  title: string;
  description?: string | null;
  /** Tugma matni — qisqa bo'lsin (masalan "Ochish") */
  actionLabel: string;
  /** lucide-react ikonkasi */
  icon: LucideIcon;
  accent?: Accent;
  /** Rasm zonasining o'ng yuqori burchagidagi yorliq */
  badge?: ReactNode;
  /** Sarlavha va tugma orasidagi qo'shimcha ma'lumot */
  meta?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
};

export default function ContentCard({
  href,
  title,
  description,
  actionLabel,
  icon: Icon,
  accent = "tests",
  badge,
  meta,
  children,
  disabled = false,
  className,
}: ContentCardProps) {
  const visual = accents[accent];

  const body = (
    <>
      <div
        className={cn(
          "paper-grid relative flex aspect-[5/4] items-center justify-center overflow-hidden border-b border-mb-line",
        )}
      >
        <span className="grid h-[68px] w-[68px] place-items-center rounded-2xl border border-mb-line bg-white shadow-md sm:h-[76px] sm:w-[76px]">
          <Icon
            className={cn(
              "h-8 w-8 sm:h-9 sm:w-9",
              visual.icon,
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </span>

        {badge && (
          <span className="absolute left-2.5 top-2.5">
            {badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <h3 className="font-serif text-[16px] font-bold leading-snug text-mb-ink sm:text-[18px]">
          {title}
        </h3>

        {description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-mb-muted sm:text-sm sm:leading-6">
            {description}
          </p>
        )}

        {meta && (
          <p className="mt-2 text-[12px] font-medium text-mb-muted">
            {meta}
          </p>
        )}

        {children}

        <span
          className={cn(
            "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-[14px] font-bold text-white transition sm:mt-4 sm:text-[15px]",
            disabled
              ? "bg-slate-200 text-slate-500"
              : cn("btn-solid", visual.button),
          )}
        >
          {actionLabel}
          {!disabled && (
            <ArrowRight
              className="h-4 w-4 transition-transform sm:group-hover:translate-x-0.5"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          )}
        </span>
      </div>
    </>
  );

  const shell = cn(
    "group flex h-full flex-col overflow-hidden rounded-2xl border border-mb-line bg-white transition",
    disabled
      ? "opacity-75"
      : "sm:hover:border-slate-300 sm:hover:shadow-md",
    className,
  );

  if (disabled) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link href={href} className={shell}>
      {body}
    </Link>
  );
}
