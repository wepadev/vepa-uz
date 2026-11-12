import Link from "next/link";
import { Lock } from "@/components/ui/icons";

import { cn } from "@/lib/utils";

/**
 * "Qulf nima degani" izohi — sahifada bir marta.
 *
 * Ilgari har qatorda "Premium" yorliği turardi va röyxat reklama
 * taxtasiga öxşab qolardi. Endi yopiq qatorda kiçik qulf, izoh esa
 * röyxat ostida bitta: nima yopiq va uni qanday oçiş mumkin.
 */
export default function PremiumNote({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-vp-line bg-vp-surface p-3 sm:p-3.5",
        className,
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-vp-accent-soft text-vp-accent-strong">
        <Lock className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>

      <p className="min-w-0 flex-1 text-sm leading-5 text-vp-muted">
        {children ?? (
          <>
            Qulfli bölimlar <b className="font-semibold text-vp-ink">Premium</b>{" "}
            bilan oçiladi.
          </>
        )}
      </p>

      <Link
        href="/pricing"
        className="press btn-accent inline-flex min-h-10 shrink-0 items-center rounded-xl px-3.5 text-sm font-bold"
      >
        Tariflar
      </Link>
    </div>
  );
}
