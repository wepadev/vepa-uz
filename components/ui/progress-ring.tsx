import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Foiz halqasi: natija, progress, örtaça ball.
 *
 * Çiziq yöqoladigan joyi tepada (soat 12), toldiriş soat mili
 * böyiça. `tone` — halqa rangi: brend (oddiy), success (90%+),
 * accent (yutuq).
 */
const TONES = {
  brand: "var(--vp-brand)",
  success: "var(--vp-success)",
  accent: "var(--vp-accent)",
  danger: "var(--vp-danger)",
  white: "#ffffff",
} as const;

export default function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  tone = "brand",
  track,
  className,
  children,
}: {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  tone?: keyof typeof TONES;
  /** Iz rangi (standart: --vp-raised) */
  track?: string;
  className?: string;
  children?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={track ?? "var(--vp-raised)"}
          strokeWidth={stroke}
        />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={TONES[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * length} ${length}`}
          />
        )}
      </svg>

      {children && (
        <span className="absolute inset-0 grid place-items-center">{children}</span>
      )}
    </span>
  );
}
