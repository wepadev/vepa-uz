import type { ReactNode } from "react";

import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { cn } from "@/lib/utils";

/**
 * Böş holat: "hali hech narsa yöq" degan joylar uçun yagona körinis.
 *
 * Ilgari har sahifa özi punktir ramka çizardi. Endi: koordinata töri
 * ustida bölim belgisi, bitta sarlavha, bitta izoh va (kerak bölsa)
 * bitta tugma — odam keyingi qadamni köradi.
 */
export default function EmptyState({
  glyph = "empty",
  title,
  children,
  action,
  className,
}: {
  glyph?: GlyphName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-vp-line bg-vp-surface text-center",
        className,
      )}
    >
      <div className="grid-plane grid h-28 place-items-center border-b border-vp-line bg-vp-surface-soft">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-vp-surface ring-1 ring-vp-tint">
          <Glyph name={glyph} className="h-10 w-10" />
        </span>
      </div>

      <div className="px-5 py-6">
        <h2 className="text-lg font-bold text-vp-ink">{title}</h2>

        {children && (
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-vp-muted">
            {children}
          </p>
        )}

        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
