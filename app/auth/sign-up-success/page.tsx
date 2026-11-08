import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function Page() {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-slate-50 px-3 py-8 text-slate-900 sm:px-6 sm:py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600 ring-1 ring-emerald-100">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-950 sm:text-3xl">
          Röyxatdan ötdingiz
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
          Emailingizga tasdiqlaş havolasi
          yuborildi. Havolani bosib akkauntingizni
          tasdiqlang, söng tizimga kiring.
        </p>

        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm leading-6 text-blue-900">
            Xat kelmadimi? “Spam” yoki “Promotions”
            papkasini ham tekşiring.
          </p>
        </div>

        <Link
          href="/auth/login"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700"
        >
          Kiriş sahifasiga ötiş
        </Link>

        <Link
          href="/"
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Boş sahifa
        </Link>
      </div>
    </main>
  );
}
