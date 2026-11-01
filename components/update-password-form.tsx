"use client";

import type {
  ComponentPropsWithoutRef,
  FormEvent,
} from "react";
import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import AppAlert from "@/components/ui/app-alert";
import { LoadingLabel, Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type SessionState =
  | "checking"
  | "ready"
  | "invalid";

function translateUpdateError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("same password") ||
    normalized.includes("different from the old")
  ) {
    return "Yangi parol oldingi paroldan farq qilişi kerak.";
  }

  if (
    normalized.includes("password") &&
    normalized.includes("at least")
  ) {
    return "Parol kamida 8 ta belgidan iborat bölişi kerak.";
  }

  if (
    normalized.includes("session") ||
    normalized.includes("jwt")
  ) {
    return "Tiklaş havolasi eskirgan yoki notöğri.";
  }

  return "Parolni yangilab bölmadi. Qayta urinib köring.";
}

export function UpdatePasswordForm({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const router = useRouter();

  const [password, setPassword] =
    useState("");
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [sessionState, setSessionState] =
    useState<SessionState>("checking");
  const [isLoading, setIsLoading] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);
  const [success, setSuccess] = useState<
    string | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    async function checkRecoverySession() {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      setSessionState(
        !userError && user
          ? "ready"
          : "invalid",
      );
    }

    void checkRecoverySession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    if (sessionState !== "ready") {
      setError(
        "Tiklaş havolasi eskirgan yoki notöğri.",
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Parol kamida 8 ta belgidan iborat bölişi kerak.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Parollar bir xil emas.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        throw updateError;
      }

      setSuccess(
        "Parolingiz muvaffaqiyatli yangilandi. Kiriş sahifasiga ötilmoqda...",
      );

      await supabase.auth.signOut();

      window.setTimeout(() => {
        router.replace("/auth/login");
        router.refresh();
      }, 1200);
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "";

      setError(translateUpdateError(message));
      setIsLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7",
        className,
      )}
      {...props}
    >
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
        Vepa Ustoz
      </p>

      <h1 className="mt-3 text-3xl font-bold text-slate-950">
        Yangi parol
      </h1>

      <p className="mt-2 leading-6 text-slate-500">
        Akkauntingiz uçun yangi parolni ikki marta
        kiriting.
      </p>

      {sessionState === "checking" && (
        <AppAlert
          variant="info"
          title="Havola tekşirilmoqda"
          className="mt-7"
        >
          <span className="inline-flex items-center gap-2">
            <Spinner size="sm" />
            Tiklaş havolasi tekşirilmoqda...
          </span>
        </AppAlert>
      )}

      {sessionState === "invalid" && (
        <div className="mt-7 space-y-4">
          <AppAlert
            variant="error"
            title="Tiklaş havolasi işlamaydi"
          >
            Tiklaş havolasi eskirgan, işlatilgan yoki
            notöğri.
          </AppAlert>

          <a
            href="/auth/forgot-password"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-center font-bold text-white transition hover:bg-blue-700"
          >
            Yangi havola oliş
          </a>

          <a
            href="/auth/login"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Kiriş sahifasiga qaytiş
          </a>
        </div>
      )}

      {sessionState === "ready" && (
        <form
          onSubmit={handleSubmit}
          className="mt-7 space-y-5"
        >
          <div>
            <label
              htmlFor="new-password"
              className="text-sm font-semibold text-slate-700"
            >
              Yangi parol
            </label>

            <div className="relative mt-2">
              <input
                id="new-password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="Kamida 8 ta belgi"
                minLength={8}
                required
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 pr-20 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                className="absolute inset-y-0 right-3 my-auto h-fit rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                {showPassword
                  ? "Yaşiriş"
                  : "Körsatiş"}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-new-password"
              className="text-sm font-semibold text-slate-700"
            >
              Yangi parolni tasdiqlaş
            </label>

            <input
              id="confirm-new-password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              placeholder="Parolni qayta kiriting"
              minLength={8}
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {error && (
            <AppAlert
              variant="error"
              title="Parol yangilanmadi"
            >
              {error}
            </AppAlert>
          )}

          {success && (
            <AppAlert
              variant="success"
              title="Parol yangilandi"
            >
              {success}
            </AppAlert>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? (
              <LoadingLabel>
                Parol yangilanmoqda...
              </LoadingLabel>
            ) : (
              "Yangi parolni saqlaş"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
