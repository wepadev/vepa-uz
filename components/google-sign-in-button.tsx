"use client";

import { useState } from "react";

import AppAlert from "@/components/ui/app-alert";
import { Spinner } from "@/components/ui/spinner";
import { authCallbackUrl } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type GoogleSignInButtonProps = {
  compact?: boolean;
  fullWidth?: boolean;
  label?: string;
  className?: string;
  /** Kirgandan keyin qaytiladigan sahifa */
  next?: string;
};

export default function GoogleSignInButton({
  compact = false,
  fullWidth = false,
  label = "Google orqali kiriş",
  className,
  next = "/",
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            authCallbackUrl(next),
          queryParams: {
            prompt: "select_account",
          },
        },
      });

    if (error) {
      setErrorMessage(
        "Google orqali kirib bölmadi. Qayta urinib köring.",
      );

      setIsLoading(false);
    }
  }

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className={cn(
          compact
            ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60",
          fullWidth
            ? "w-full"
            : "w-full sm:w-auto",
          className,
        )}
      >
        {isLoading ? (
          <Spinner
            size="sm"
            className="text-blue-600"
            label="Google oçilmoqda"
          />
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0"
          >
            <path
              fill="#4285F4"
              d="M21.6 12.227c0-.709-.064-1.391-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.509h3.232c1.891-1.741 2.981-4.309 2.981-7.35Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.968-.895 6.619-2.423l-3.232-2.509c-.895.6-2.041.955-3.387.955-2.605 0-4.809-1.759-5.6-4.123H3.059v2.591A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.4 13.9A6.015 6.015 0 0 1 6.086 12c0-.659.114-1.3.314-1.9V7.509H3.059A10 10 0 0 0 2 12c0 1.614.386 3.141 1.059 4.491L6.4 13.9Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.964 2.995 14.695 2 12 2a10 10 0 0 0-8.941 5.509L6.4 10.1C7.191 7.736 9.395 5.977 12 5.977Z"
            />
          </svg>
        )}

        {isLoading
          ? "Google oçilmoqda..."
          : label}
      </button>

      {errorMessage && (
        <AppAlert
          variant="error"
          title="Google orqali kiriş amalga oşmadi"
          className="mt-3"
          compact
        >
          {errorMessage}
        </AppAlert>
      )}
    </div>
  );
}
