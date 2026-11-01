import type { ReactNode } from "react";
import { Plus } from "lucide-react";

/**
 * "+ Yangi ..." tugmasi ostiga yashirilgan yaratish formasi.
 *
 * Ilgari admin sahifalarida yaratish formasi doim ochiq turardi va
 * ekranning yarmini egallardi — ro'yxat esa chetga surilib qolardi.
 * Endi forma faqat kerak bo'lganda ochiladi. Ro'yxat bo'sh bo'lsa
 * (`defaultOpen`) darhol ochiq turadi: boshqa qiladigan ish yo'q.
 */
export default function CreatePanel({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-dashed border-mb-brand/40 bg-white open:border-solid open:border-mb-line open:shadow-sm"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-mb-brand group-open:border-b group-open:border-mb-line">
        <Plus
          className="h-4 w-4 transition group-open:rotate-45"
          strokeWidth={2.4}
          aria-hidden="true"
        />
        <span className="group-open:hidden">{label}</span>
        <span className="hidden text-slate-600 group-open:inline">Yopiş</span>
      </summary>

      {/* Ichki formalar o'z ramkasi bilan keladi — bu yerda olib tashlanadi */}
      <div className="[&>form]:rounded-none [&>form]:border-0 [&>form]:shadow-none">
        {children}
      </div>
    </details>
  );
}
