"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import AppAlert from "@/components/ui/app-alert";
import { LoadingLabel, Spinner } from "@/components/ui/spinner";
import { loadTelegram, type TelegramWebApp } from "@/components/telegram/sdk";
import { btnGhost, btnPrimary, card } from "@/lib/ui";

type State =
  | { kind: "loading" }
  | { kind: "not-telegram" }
  | { kind: "choose"; name: string }
  | { kind: "error"; message: string };

const ERRORS: Record<string, string> = {
  not_configured: "Bot hali sozlanmagan. Birozdan keyin qayta oçing.",
  invalid_init_data:
    "Telegram ma'lumoti eskirgan. Ilovani yopib, qaytadan oçing.",
  rate_limited: "Juda köp uriniş. Bir daqiqadan keyin qayta oçing.",
};

/** Mini App'ning kiriş eşigi: Telegram orqali taniş va yönaltiriş */
export default function TelegramEntry({
  fallbackNext,
}: {
  fallbackNext: string | null;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [creating, setCreating] = useState(false);
  const appRef = useRef<TelegramWebApp | null>(null);

  const authenticate = useCallback(
    async (mode?: "create") => {
      const app = appRef.current;
      if (!app) return;

      try {
        const response = await fetch("/api/telegram/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: app.initData, mode }),
        });

        const data = (await response.json().catch(() => ({}))) as {
          status?: string;
          next?: string;
          name?: string;
          error?: string;
        };

        if (data.status === "ok") {
          const next =
            data.next && data.next !== "/" ? data.next : fallbackNext || "/";
          // Töliq ötiş: server sahifalari yangi cookie'ni körsin
          window.location.replace(next);
          return;
        }

        if (data.status === "choose") {
          setState({ kind: "choose", name: data.name ?? "" });
          return;
        }

        setState({
          kind: "error",
          message:
            ERRORS[data.error ?? ""] ??
            "Kiriş amalga oşmadi. Ilovani qayta oçib köring.",
        });
      } catch {
        setState({
          kind: "error",
          message: "Internet bilan bog'lanib bölmadi. Qayta urinib köring.",
        });
      } finally {
        setCreating(false);
      }
    },
    [fallbackNext],
  );

  useEffect(() => {
    let cancelled = false;

    loadTelegram().then((app) => {
      if (cancelled) return;
      if (!app) {
        setState({ kind: "not-telegram" });
        return;
      }
      appRef.current = app;
      app.ready();
      void authenticate();
    });

    return () => {
      cancelled = true;
    };
  }, [authenticate]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-10">
      {state.kind === "loading" && (
        <div className="flex flex-col items-center gap-4 text-center text-mb-muted">
          <Spinner size="lg" className="text-mb-brand" />
          <p className="font-semibold">Vepa Ustoz oçilmoqda...</p>
        </div>
      )}

      {state.kind === "not-telegram" && (
        <div className={`${card} p-6 text-center`}>
          <h1 className="text-xl font-bold text-mb-ink">
            Bu sahifa Telegram uçun
          </h1>
          <p className="mt-2 text-sm leading-6 text-mb-muted">
            Sayt brauzerda ham töliq işlaydi.
          </p>
          <Link href="/" className={`${btnPrimary} mt-5 w-full`}>
            Bosh sahifaga ötiş
          </Link>
        </div>
      )}

      {state.kind === "choose" && (
        <div className={`${card} p-6`}>
          <h1 className="text-xl font-bold text-mb-ink">
            Xuş kelibsiz{state.name ? `, ${state.name}` : ""}!
          </h1>
          <p className="mt-2 text-sm leading-6 text-mb-muted">
            vepa.uz da hisobingiz bölsa, unga kiring: natijalar, guruh
            va Premium saqlanib qoladi. Bölmasa, Telegram bilan yangi
            hisob oçing.
          </p>

          <button
            type="button"
            disabled={creating}
            onClick={() => {
              setCreating(true);
              void authenticate("create");
            }}
            className={`${btnPrimary} mt-5 w-full`}
          >
            {creating ? (
              <LoadingLabel>Oçilmoqda...</LoadingLabel>
            ) : (
              "Yangi hisob oçiş"
            )}
          </button>

          <Link
            href="/auth/login?next=%2Ftg"
            className={`${btnGhost} mt-3 w-full`}
          >
            Menda hisob bor — kiriş
          </Link>

          <p className="mt-4 text-xs leading-5 text-mb-muted">
            Google bilan kirgan bölsangiz: saytdagi Profil sahifasida
            «Telegram’ga ulaş» tugmasini bosing.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="space-y-4">
          <AppAlert variant="error" title="Kirib bölmadi">
            {state.message}
          </AppAlert>
          <button
            type="button"
            onClick={() => {
              setState({ kind: "loading" });
              void authenticate();
            }}
            className={`${btnGhost} w-full`}
          >
            Qayta urinib köriş
          </button>
        </div>
      )}
    </main>
  );
}
