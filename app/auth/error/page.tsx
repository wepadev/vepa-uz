import { Suspense } from "react";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

async function ErrorDetails({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const code = Array.isArray(params.error)
    ? params.error[0]
    : params.error;

  if (!code) {
    return null;
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Xatolik kodi
      </p>

      <p className="mt-1 break-all font-mono text-sm text-slate-700">
        {code}
      </p>
    </div>
  );
}

export default function Page({
  searchParams,
}: PageProps) {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-slate-50 px-3 py-8 text-slate-900 sm:px-6 sm:py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-2xl text-red-600 ring-1 ring-red-100">
          !
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-950 sm:text-3xl">
          Xatolik yuz berdi
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
          Kiriş jarayonida muammo çiqdi. Qayta
          urinib köring yoki boşqa usul bilan
          kiring.
        </p>

        <Suspense>
          <ErrorDetails searchParams={searchParams} />
        </Suspense>

        <Link
          href="/auth/login"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-mb-brand px-5 py-3 font-bold text-white transition hover:bg-mb-brandDark"
        >
          Qayta uriniş
        </Link>

        <Link
          href="/"
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Boş sahifa
        </Link>
      </div>
    </main>
  );
}
