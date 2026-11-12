import type { ReactNode } from "react";
import { MoreHorizontal } from "@/components/ui/icons";

/**
 * Qatordagi kamdan kam kerak bo'ladigan amallar uchun "⋯" menyu.
 *
 * Har bir qatorda to'rt-beshta rangli tugma turganda ro'yxat
 * o'qib bo'lmas darajada shovqinli edi. Endi qatorda bitta asosiy
 * amal (masalan "Tahrirlash") qoladi, qolganlari shu menyuda.
 *
 * JavaScript'siz ishlaydi (<details>). Ichidagi tugma va havolalar
 * `RowMenuItem` klassi bilan bir xil ko'rinadi.
 */
export const rowMenuItem =
  "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100";

export const rowMenuDanger =
  "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50";

export default function RowMenu({ children }: { children: ReactNode }) {
  return (
    <details className="relative">
      <summary
        aria-label="Boşqa amallar"
        title="Boşqa amallar"
        className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </summary>

      <div className="absolute right-0 z-20 mt-1 w-52 space-y-0.5 rounded-xl border border-mb-line bg-white p-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}
