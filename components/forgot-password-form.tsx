"use client";

import type {
  ComponentPropsWithoutRef,
  FormEvent,
} from "react";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import AppAlert from "@/components/ui/app-alert";
import { LoadingLabel } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function translateResetError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit")) {
    return "Juda ko‘p urinish bo‘ldi. Birozdan keyin qayta urinib ko‘ring.";
  }

  if (
    normalized.includes("email") &&
    normalized.includes("invalid")
  ) {
    return "Email manzili noto‘g‘ri.";
  }

  return "Tiklash havolasini yuborib bo‘lmadi. Qayta urinib ko‘ring.";
}

export function ForgotPasswordForm({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);
  const [success, setSuccess] = useState<
    string | null
  >(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedEmail =
      email.trim().toLowerCase();

    setError(null);
    setSuccess(null);

    if (!normalizedEmail) {
      setError("Email manzilini kiriting.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const callbackUrl = new URL(
        "/auth/callback",
        window.location.origin,
      );

      callbackUrl.searchParams.set(
        "next",
        "/auth/update-password",
      );

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: callbackUrl.toString(),
          },
        );

      if (resetError) {
        throw resetError;
      }

      setSuccess(
        "Agar bu email bilan akkaunt mavjud bo‘lsa, parolni tiklash havolasi yuborildi. Emailning Spam bo‘limini ham tekshiring.",
      );
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "";

      setError(translateResetError(message));
    } finally {
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
        Parolni tiklash
      </h1>

      <p className="mt-2 leading-6 text-slate-500">
        Akkauntingizga biriktirilgan email manzilini
        kiriting.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-7 space-y-5"
      >
        <div>
          <label
            htmlFor="recovery-email"
            className="text-sm font-semibold text-slate-700"
          >
            Email
          </label>

          <input
            id="recovery-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="name@example.com"
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            required
          />
        </div>

        {error && (
          <AppAlert
            variant="error"
            title="Havola yuborilmadi"
          >
            {error}
          </AppAlert>
        )}

        {success && (
          <AppAlert
            variant="success"
            title="Emailni tekshiring"
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
              Havola yuborilmoqda...
            </LoadingLabel>
          ) : (
            "Tiklash havolasini yuborish"
          )}
        </button>
      </form>

      <a
        href="/auth/login"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        ← Kirish sahifasiga qaytish
      </a>
    </div>
  );
}
