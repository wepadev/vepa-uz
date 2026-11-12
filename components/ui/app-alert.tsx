"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "@/components/ui/icons";

type AlertVariant =
  | "success"
  | "error"
  | "warning"
  | "info";

type AppAlertProps = {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

const styles: Record<
  AlertVariant,
  {
    wrapper: string;
    iconBox: string;
    title: string;
    text: string;
  }
> = {
  success: {
    wrapper:
      "border-emerald-200 bg-emerald-50/90 shadow-emerald-100/70",
    iconBox:
      "bg-emerald-600 text-white ring-4 ring-emerald-100",
    title: "text-emerald-950",
    text: "text-emerald-800",
  },
  error: {
    wrapper:
      "border-red-200 bg-red-50/90 shadow-red-100/70",
    iconBox:
      "bg-red-600 text-white ring-4 ring-red-100",
    title: "text-red-950",
    text: "text-red-800",
  },
  warning: {
    wrapper:
      "border-amber-200 bg-amber-50/90 shadow-amber-100/70",
    iconBox:
      "bg-amber-500 text-white ring-4 ring-amber-100",
    title: "text-amber-950",
    text: "text-amber-800",
  },
  info: {
    wrapper:
      "border-blue-200 bg-blue-50/90 shadow-blue-100/70",
    iconBox:
      "bg-mb-brand text-white ring-4 ring-blue-100",
    title: "text-blue-950",
    text: "text-blue-800",
  },
};

const ALERT_ICONS: Record<
  AlertVariant,
  LucideIcon
> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function AlertIcon({
  variant,
}: {
  variant: AlertVariant;
}) {
  const Icon = ALERT_ICONS[variant];

  return (
    <Icon
      className="h-5 w-5"
      strokeWidth={2.1}
      aria-hidden="true"
    />
  );
}

export default function AppAlert({
  variant,
  title,
  children,
  className = "",
  compact = false,
}: AppAlertProps) {
  const selected = styles[variant];

  return (
    <div
      role={
        variant === "error" ||
        variant === "warning"
          ? "alert"
          : "status"
      }
      aria-live={
        variant === "error"
          ? "assertive"
          : "polite"
      }
      className={[
        "flex items-start gap-3 rounded-2xl border shadow-sm",
        compact
          ? "px-3.5 py-3"
          : "px-4 py-4",
        selected.wrapper,
        className,
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          selected.iconBox,
        ].join(" ")}
      >
        <AlertIcon variant={variant} />
      </span>

      <div className="min-w-0 flex-1">
        {title && (
          <p
            className={[
              "font-bold leading-6",
              selected.title,
            ].join(" ")}
          >
            {title}
          </p>
        )}

        <div
          className={[
            title
              ? "mt-1 text-sm leading-6"
              : "text-sm font-medium leading-6",
            selected.text,
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
