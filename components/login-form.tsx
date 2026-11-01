"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import GoogleSignInButton from "@/components/google-sign-in-button";
import { authCallbackUrl } from "@/lib/safe-next";
import AppAlert from "@/components/ui/app-alert";
import { LoadingLabel } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

function translateAuthError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalid login credentials")) {
    return "Email yoki parol notöğri.";
  }

  if (lowerMessage.includes("email not confirmed")) {
    return "Avval emailingizga yuborilgan tasdiqlaş havolasini bosing.";
  }

  if (lowerMessage.includes("user already registered")) {
    return "Bu email bilan akkaunt allaqaçon mavjud.";
  }

  if (lowerMessage.includes("password should be at least")) {
    return "Parol kamida 6 ta belgidan iborat bölişi kerak.";
  }

  if (lowerMessage.includes("signup is disabled")) {
    return "Email orqali röyxatdan ötiş Supabase sozlamalarida öçirilgan.";
  }

  if (lowerMessage.includes("rate limit")) {
    return "Juda köp uriniş böldi. Birozdan keyin qayta urinib köring.";
  }

  return message || "Noma’lum xatolik yuz berdi.";
}

export function LoginForm({
  className,
  initialMode = "login",
  next = "/",
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  initialMode?: AuthMode;
  /** Kirgandan keyin qaytiladigan sahifa (allaqachon tekshirilgan) */
  next?: string;
}) {
  const router = useRouter();

  const [mode, setMode] =
    useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [error, setError] = useState<string | null>(
    null,
  );
  const [success, setSuccess] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] =
    useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    setError(null);
    setSuccess(null);

    if (!normalizedEmail) {
      setError("Email manzilini kiriting.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Parol kamida 6 ta belgidan iborat bölişi kerak.",
      );
      return;
    }

    if (mode === "signup") {
      if (fullName.trim().length < 2) {
        setError("Ism-familiyangizni kiriting.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Parollar bir xil emas.");
        return;
      }
    }

    const supabase = createClient();

    setIsLoading(true);

    try {
      if (mode === "login") {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

        if (loginError) {
          throw loginError;
        }

        router.push(next);
        router.refresh();
        return;
      }

      const { data, error: signupError } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              name: fullName.trim(),
            },
            emailRedirectTo:
              authCallbackUrl(next),
          },
        });

      if (signupError) {
        throw signupError;
      }

      if (data.session) {
        router.push(next);
        router.refresh();
        return;
      }

      setSuccess(
        "Röyxatdan ötiş muvaffaqiyatli. Emailingizga yuborilgan tasdiqlaş havolasini bosing.",
      );
      setPassword("");
      setConfirmPassword("");
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Noma’lum xatolik yuz berdi.";

      setError(translateAuthError(message));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/50 sm:p-7",
        className,
      )}
      {...props}
    >
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
          Vepa Ustoz
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:mt-3 sm:text-3xl">
          {mode === "login"
            ? "Xuş kelibsiz"
            : "Yangi akkaunt"}
        </h1>

        <p className="mt-1.5 text-sm leading-6 text-slate-500 sm:mt-2 sm:text-base">
          {mode === "login"
            ? "Akkauntingizga kirib öqişni davom ettiring."
            : "Email orqali bepul röyxatdan öting."}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => changeMode("login")}
          className={
            mode === "login"
              ? "min-h-11 rounded-xl bg-white px-3 py-3 text-sm font-bold text-blue-700 shadow-sm"
              : "min-h-11 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
          }
        >
          Kiriş
        </button>

        <button
          type="button"
          onClick={() => changeMode("signup")}
          className={
            mode === "signup"
              ? "min-h-11 rounded-xl bg-white px-3 py-3 text-sm font-bold text-blue-700 shadow-sm"
              : "min-h-11 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
          }
        >
          Röyxatdan ötiş
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-5 space-y-4 sm:mt-6 sm:space-y-5"
      >
        {mode === "signup" && (
          <div>
            <label
              htmlFor="fullName"
              className="text-sm font-semibold text-slate-700"
            >
              Ism-familiya
            </label>

            <input
              id="fullName"
              type="text"
              autoComplete="name"
              enterKeyHint="next"
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              placeholder="Masalan: Ali Valiyev"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="text-sm font-semibold text-slate-700"
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="next"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="name@example.com"
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="password"
              className="text-sm font-semibold text-slate-700"
            >
              Parol
            </label>

            {mode === "login" && (
              <a
                href="/auth/forgot-password"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Parolni unutdingizmi?
              </a>
            )}
          </div>

          <div className="relative mt-2">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Kamida 6 ta belgi"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 pr-20 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
              minLength={6}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword((current) => !current)
              }
              aria-label={showPassword ? "Parolni yaşiriş" : "Parolni körsatiş"}
              className="absolute inset-y-1 right-1.5 my-auto flex min-h-10 items-center rounded-xl px-3 text-xs font-bold text-slate-500 transition active:bg-slate-100 hover:bg-slate-100 hover:text-slate-800"
            >
              {showPassword ? "Yaşiriş" : "Körsatiş"}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <div>
            <label
              htmlFor="confirmPassword"
              className="text-sm font-semibold text-slate-700"
            >
              Parolni tasdiqlaş
            </label>

            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              enterKeyHint="go"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Parolni qayta kiriting"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
              minLength={6}
            />
          </div>
        )}

        {error && (
          <AppAlert
            variant="error"
            title="Kiriş amalga oşmadi"
          >
            {error}
          </AppAlert>
        )}

        {success && (
          <AppAlert
            variant="success"
            title="Muvaffaqiyatli"
          >
            {success}
          </AppAlert>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-2xl bg-blue-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? (
            <LoadingLabel>
              {mode === "login"
                ? "Kirilmoqda..."
                : "Akkaunt yaratilmoqda..."}
            </LoadingLabel>
          ) : mode === "login" ? (
            "Kiriş"
          ) : (
            "Röyxatdan ötiş"
          )}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          yoki
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <GoogleSignInButton
        next={next}
        fullWidth
        label="Google orqali davom etiş"
      />

      <p className="mt-5 text-center text-xs leading-5 text-slate-400">
        Davom etiş orqali platformadan foydalaniş
        qoidalariga rozilik bildirasiz.
      </p>
    </div>
  );
}
