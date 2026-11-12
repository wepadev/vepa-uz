"use client";

import { useEffect } from "react";
import Link from "next/link";

import AppAlert from "@/components/ui/app-alert";
import { sendErrorReport } from "@/lib/send-error-report";

/**
 * Admin bo'limi uchun alohida xato ekrani.
 *
 * Sayt tomonidagidan farqi: bu yerda xatoning texnik matni
 * ko'rsatiladi. Admin — o'zingiz, sizga sabab kerak. O'quvchiga esa
 * inglizcha texnik matn foydasiz, shuning uchun u yerda yashiriladi.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    sendErrorReport(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-mb-brand">
          Admin panel
        </p>

        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          Sahifa oçilmadi
        </h1>

        <AppAlert variant="error" title="Xato matni" className="mt-5">
          <span className="break-words font-mono text-[13px]">
            {error.message || "Sabab körsatilmagan."}
          </span>
        </AppAlert>

        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">
            Xato kodi: {error.digest} — Vercel loglaridan şu böyiça
            qidiring.
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-xl bg-mb-brand px-5 font-bold text-white transition hover:bg-mb-brandDark"
          >
            Qayta uriniş
          </button>

          <Link
            href="/admin"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Boşqaruv paneli
          </Link>
        </div>
      </div>
    </main>
  );
}
