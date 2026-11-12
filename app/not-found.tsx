import Link from "next/link";
import { Compass, House, Search } from "lucide-react";

/**
 * 404 sahifasi.
 *
 * Ilgari bu yerda Next.js ning inglizcha "This page could not be found"
 * sahifasi chiqardi. Saytda notFound() yigirmadan ortiq joyda
 * ishlatiladi — o'chirilgan test, mavjud bo'lmagan bo'lim, noto'g'ri
 * havola. Endi hammasi shu ekranga tushadi.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-xl shadow-slate-200/60 sm:p-8">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-mb-tint text-mb-brand">
          <Compass className="h-8 w-8" strokeWidth={1.9} aria-hidden="true" />
        </span>

        <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-mb-brand">
          Vepa Ustoz
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
          Bunday sahifa topilmadi
        </h1>

        <p className="mt-3 text-sm leading-6 text-mb-muted sm:text-base">
          Havola eskirgan bölişi mumkin yoki qidirgan narsangiz
          öçirilgan. Quyidagi bölimlardan davom eting.
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mb-brand px-5 font-bold text-white transition hover:bg-mb-brandDark"
          >
            <House className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            Boş sahifa
          </Link>

          <Link
            href="/tests"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Search className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            Testlar
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-semibold text-mb-brand">
          <Link href="/lessons" className="hover:underline">
            Videodarslar
          </Link>

          <Link href="/textbooks" className="hover:underline">
            Darslik yeçimlari
          </Link>

          <Link href="/results" className="hover:underline">
            Natijalarim
          </Link>
        </div>
      </div>
    </main>
  );
}
