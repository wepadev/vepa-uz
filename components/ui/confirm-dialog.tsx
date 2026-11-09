"use client";

import { useEffect } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  type LucideIcon,
} from "lucide-react";

type ConfirmVariant =
  | "warning"
  | "danger"
  | "info";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
};

const variantStyles: Record<
  ConfirmVariant,
  {
    icon: string;
    button: string;
  }
> = {
  warning: {
    icon:
      "bg-amber-100 text-amber-700 ring-8 ring-amber-50",
    button:
      "bg-amber-600 hover:bg-amber-700 focus:ring-amber-200",
  },
  danger: {
    icon:
      "bg-red-100 text-red-700 ring-8 ring-red-50",
    button:
      "bg-red-600 hover:bg-red-700 focus:ring-red-200",
  },
  info: {
    icon:
      "bg-blue-100 text-blue-700 ring-8 ring-blue-50",
    button:
      "bg-mb-brand hover:bg-mb-brandDark focus:ring-blue-200",
  },
};

const VARIANT_ICONS: Record<
  ConfirmVariant,
  LucideIcon
> = {
  warning: AlertTriangle,
  danger: AlertOctagon,
  info: Info,
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Tasdiqlaş",
  cancelLabel = "Bekor qiliş",
  variant = "warning",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const selected =
    variantStyles[variant];

  const VariantIcon =
    VARIANT_ICONS[variant];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCancel();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="w-full max-w-md rounded-3xl border border-white/50 bg-white p-5 shadow-2xl shadow-slate-950/20 sm:p-7"
      >
        <div
          className={[
            "grid h-12 w-12 place-items-center rounded-2xl",
            selected.icon,
          ].join(" ")}
        >
          <VariantIcon
            className="h-6 w-6"
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        <h2
          id="confirm-title"
          className="mt-5 text-xl font-bold text-slate-950 sm:text-2xl"
        >
          {title}
        </h2>

        <p
          id="confirm-description"
          className="mt-2 text-sm leading-6 text-slate-600"
        >
          {description}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={[
              "min-h-12 rounded-2xl px-5 py-3 font-bold text-white shadow-sm transition focus:outline-none focus:ring-4",
              selected.button,
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
