/**
 * Admin sahifalari uchun yuklanish skeletoni.
 *
 * Sahifa ma'lumotlari kelguncha shu ko'rinadi. Yuqoridagi navigatsiya
 * joyida qoladi, chunki u layout ichida — foydalanuvchi qayerdaligini
 * yo'qotmaydi.
 */
type Variant = "cards" | "table" | "form";

type AdminSkeletonProps = {
  /** Sarlavha o'rnidagi joy kengligi */
  variant?: Variant;
  /** Statistika qatori ko'rsatilsinmi */
  stats?: boolean;
};

function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

function CardBlock() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <Bar className="h-12 w-12 rounded-2xl" />
        <Bar className="h-6 w-14 rounded-full" />
      </div>

      <Bar className="mt-5 h-6 w-2/3" />
      <Bar className="mt-3 h-4 w-full" />
      <Bar className="mt-2 h-4 w-4/5" />
      <Bar className="mt-5 h-11 w-full rounded-2xl" />
    </div>
  );
}

function RowBlock({ last }: { last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-4 sm:px-5 ${
        last ? "" : "border-b border-slate-100"
      }`}
    >
      <div className="min-w-0 flex-1">
        <Bar className="h-4 w-1/3" />
        <Bar className="mt-2 h-3 w-1/5" />
      </div>

      <Bar className="h-9 w-24 shrink-0 rounded-xl" />
    </div>
  );
}

export default function AdminSkeleton({
  variant = "cards",
  stats = false,
}: AdminSkeletonProps) {
  return (
    <main
      className="min-h-screen bg-slate-50"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Sahifa yuklanmoqda</span>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <Bar className="h-4 w-40" />
        <Bar className="mt-3 h-8 w-64 sm:h-9 sm:w-80" />
        <Bar className="mt-3 h-4 w-full max-w-md" />

        {stats && (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <Bar className="h-4 w-2/3" />
                <Bar className="mt-3 h-8 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {variant === "cards" && (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <CardBlock key={i} />
            ))}
          </div>
        )}

        {variant === "table" && (
          <div className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {[0, 1, 2, 3, 4].map((i) => (
              <RowBlock key={i} last={i === 4} />
            ))}
          </div>
        )}

        {variant === "form" && (
          <div className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <Bar className="h-4 w-32" />
            <Bar className="mt-3 h-12 w-full rounded-xl" />

            <Bar className="mt-6 h-4 w-40" />
            <Bar className="mt-3 h-12 w-full rounded-xl" />

            <Bar className="mt-6 h-4 w-28" />
            <Bar className="mt-3 h-28 w-full rounded-xl" />

            <Bar className="mt-6 h-12 w-44 rounded-xl" />
          </div>
        )}
      </section>
    </main>
  );
}
