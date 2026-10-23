"use client";

import { useEffect, useState } from "react";

import AppAlert from "@/components/ui/app-alert";
import { LoadingLabel } from "@/components/ui/spinner";
import { sendErrorReport } from "@/lib/send-error-report";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  const [isRetrying, setIsRetrying] =
    useState(false);

  // Xato yuz berishi bilan adminga xabar ketadi
  useEffect(() => {
    sendErrorReport(error);
  }, [error]);

  function retry() {
    setIsRetrying(true);
    reset();

    window.setTimeout(() => {
      setIsRetrying(false);
    }, 1200);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
          Vepa Ustoz
        </p>

        <h1 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">
          Sahifani ochib bo‘lmadi
        </h1>

        {/*
          Xatoning asl matni ataylab ko'rsatilmaydi.

          Next.js production'da server xatosini inglizcha shablon bilan
          almashtiradi ("An error occurred in the Server Components
          render..."), foydalanuvchi esa undan hech narsa tushunmaydi
          va hech narsa qila olmaydi. Texnik tafsilot Telegramga va
          Vercel loglariga ketadi — o'sha yerda kerak.
        */}
        <AppAlert
          variant="error"
          title="Nimadir noto‘g‘ri ketdi"
          className="mt-6"
        >
          Ma’lumotlarni yuklab bo‘lmadi. Internet aloqangizni
          tekshirib, qayta urinib ko‘ring. Muammo takrorlansa
          administrator xabardor qilindi.
        </AppAlert>

        {error.digest && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Xato kodi: {error.digest}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              window.history.back()
            }
            className="min-h-12 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
          >
            ← Orqaga
          </button>

          <button
            type="button"
            onClick={retry}
            disabled={isRetrying}
            className="min-h-12 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
          >
            {isRetrying ? (
              <LoadingLabel>
                Qayta yuklanmoqda...
              </LoadingLabel>
            ) : (
              "Qayta urinish"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
