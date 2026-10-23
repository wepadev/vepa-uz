"use client";

import { useState } from "react";
import { KeyRound, Plus } from "lucide-react";

import SubmitButton from "@/components/ui/submit-button";

/**
 * "Boshqa guruhga ham qo'shilish" tugmasi.
 *
 * O'quvchi allaqachon guruhda bo'lsa, kod maydoni doim ochiq
 * turishi keraksiz — u sahifani band qiladi va har kuni ko'rinib
 * turadi. Shu sababli avval tugma, bosilgandagina maydon.
 */
export default function JoinGroupButton({
  action,
  label = "Boshqa guruhga ham qo‘shilish",
}: {
  action: (formData: FormData) => void | Promise<void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="w-full">
      <label
        htmlFor="join-code"
        className="block text-xs font-semibold text-slate-600"
      >
        Ustoz bergan 6 belgili kod
      </label>

      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mb-muted"
            strokeWidth={2}
            aria-hidden="true"
          />

          <input
            id="join-code"
            name="code"
            required
            maxLength={6}
            autoFocus
            autoComplete="off"
            placeholder="ABC123"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-4 font-mono text-lg font-bold uppercase tracking-widest outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <SubmitButton className="min-h-12 rounded-xl bg-mb-brand px-6 font-semibold text-white transition hover:bg-mb-brandDark">
          Qo‘shilish
        </SubmitButton>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Bekor
        </button>
      </div>
    </form>
  );
}
