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
    return "Juda köp uriniş böldi. Birozdan keyin qayta urinib köring.";
  }

  if (
    normalized.includes("email") &&
    normalized.includes("invalid")
  ) {
    return "Email manzili notöğri.";
  }

  return "Tiklaş havolasini yuborib bölmadi. Qayta urinib köring.";
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
        "Agar bu email bilan akkaunt mavjud bölsa, parolni tiklaş havolasi yuborildi. Emailning Spam bölimini ham tekşiring.",
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
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7",
        className,
      )}
      {...props}
    >
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-mb-brand">
        Vepa Ustoz
      </p>

      <h1 className="mt-3 text-3xl font-bold text-slate-950">
        Parolni tiklaş
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
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
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
            title="Emailni tekşiring"
          >
            {success}
          </AppAlert>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-mb-brand px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-mb-brandDark disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? (
            <LoadingLabel>
              Havola yuborilmoqda...
            </LoadingLabel>
          ) : (
            "Tiklaş havolasini yuboriş"
          )}
        </button>
      </form>

      <a
        href="/auth/login"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        ← Kiriş sahifasiga qaytiş
      </a>
    </div>
  );
}
