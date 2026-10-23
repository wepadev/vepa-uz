import { Spinner } from "@/components/ui/spinner";

type PageLoaderProps = {
  label?: string;
  fullScreen?: boolean;
};

export default function PageLoader({
  label = "Sahifa yuklanmoqda...",
  fullScreen = true,
}: PageLoaderProps) {
  return (
    <div
      className={
        fullScreen
          ? "grid min-h-screen place-items-center bg-slate-50 px-4"
          : "grid min-h-64 place-items-center px-4"
      }
    >
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7 text-center shadow-xl shadow-slate-200/60">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
          <Spinner
            size="lg"
            label={label}
          />
        </div>

        <p className="mt-5 font-bold text-slate-900">
          Vepa Ustoz
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {label}
        </p>
      </div>
    </div>
  );
}
