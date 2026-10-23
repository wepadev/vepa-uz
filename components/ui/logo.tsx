import Image from "next/image";
import Link from "next/link";

import BrandMark from "@/components/ui/brand-mark";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** Logotip yonida nom ko'rsatilsinmi */
  withText?: boolean;
  /** Nom ostidagi kichik izoh */
  subtitle?: string | null;
  /** Bosilganda o'tiladigan manzil. null bo'lsa havola bo'lmaydi */
  href?: string | null;
  size?: "sm" | "md" | "lg";
  /** To'q fonda ishlatiladigan oq variant */
  variant?: "color" | "white";
  className?: string;
};

const sizes = {
  sm: { box: 32, text: "text-base", sub: "text-[10px]" },
  md: { box: 40, text: "text-lg", sub: "text-xs" },
  lg: { box: 48, text: "text-xl", sub: "text-xs" },
} as const;

export default function Logo({
  withText = true,
  subtitle,
  href = "/",
  size = "md",
  variant = "color",
  className,
}: LogoProps) {
  const s = sizes[size];

  const content = (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        className,
      )}
    >
      {variant === "white" ? (
        <Image
          src="/logo-white.png"
          alt="Vepa Ustoz"
          width={s.box}
          height={s.box}
          priority
          className="shrink-0"
          style={{ width: s.box, height: s.box }}
        />
      ) : (
        <BrandMark
          size={s.box}
          className="shrink-0"
        />
      )}

      {withText && (
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate font-bold leading-tight",
              s.text,
              variant === "white"
                ? "text-white"
                : "text-mb-ink",
            )}
          >
            Vepa Ustoz
          </span>

          {subtitle && (
            <span
              className={cn(
                "block truncate font-medium leading-tight",
                s.sub,
                variant === "white"
                  ? "text-white/70"
                  : "text-mb-muted",
              )}
            >
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="flex min-w-0 items-center"
    >
      {content}
    </Link>
  );
}
