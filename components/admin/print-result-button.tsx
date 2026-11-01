"use client";

import { Printer } from "lucide-react";

export default function PrintResultButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hidden inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
    >
      <Printer
        className="h-5 w-5"
        strokeWidth={1.9}
        aria-hidden="true"
      />

      Çop etiş / PDF
    </button>
  );
}
