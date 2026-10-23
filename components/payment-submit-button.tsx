"use client";

import { useFormStatus } from "react-dom";

type PaymentSubmitButtonProps = {
  /** Eng foydali tarif — tugma boshqa rangda ajralib turadi */
  highlighted?: boolean;
  /** Qator ichidagi ixcham tugma (mobil tariflar ro'yxati) */
  compact?: boolean;
};

export default function PaymentSubmitButton({
  highlighted = false,
  compact = false,
}: PaymentSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={[
        compact
          ? "min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold"
          : "mt-4 min-h-12 w-full rounded-2xl px-5 py-3 font-bold",
        highlighted
          ? "bg-mb-brand text-white shadow-sm transition hover:bg-mb-brandDark"
          : "border border-slate-300 bg-white text-slate-800 transition hover:bg-slate-50",
        "disabled:cursor-wait disabled:opacity-70",
      ].join(" ")}
    >
      {pending
        ? compact
          ? "Kuting…"
          : "Buyurtma yaratilmoqda…"
        : compact
          ? "Olish"
          : "Sotib olish"}
    </button>
  );
}
