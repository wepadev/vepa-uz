"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import GoogleSignInButton from "@/components/google-sign-in-button";
import AppAlert from "@/components/ui/app-alert";
import { LoadingLabel } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

function translateAuthError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalid login credentials")) {
    return "Email yoki parol noto‘g‘ri.";
  }

  if (lowerMessage.includes("email not confirmed")) {
    return "Avval emailingizga yuborilgan tasdiqlash havolasini bosing.";
  }

  if (lowerMessage.includes("user already registered")) {
    return "Bu email bilan akkaunt allaqachon mavjud.";
  }

  if (lowerMessage.includes("password should be at least")) {
    return "Parol kamida 6 ta belgidan iborat bo‘lishi kerak.";
  }

  if (lowerMessage.includes("signup is disabled")) {
    return "Email orqali ro‘yxatdan o‘tish Supabase sozlamalarida o‘chirilgan.";
  }

  if (lowerMessage.includes("rate limit")) {
    return "Juda ko‘p urinish bo‘ldi. Birozdan keyin qayta urinib ko‘ring.";
  }

  return message || "Noma’lum xatolik yuz berdi.";
}

export function LoginForm({
  className,
  initialMode = "login",
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  initialMode?: AuthMode;
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
        "Parol kamida 6 ta belgidan iborat bo‘lishi kerak.",
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

        router.push("/");
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
              `${window.location.origin}/auth/callback`,
          },
        });

      if (signupError) {
        throw signupError;
      }

      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }

      setSuccess(
        "Ro‘yxatdan o‘tish muvaffaqiyatli. Emailingizga yuborilgan tasdiqlash havolasini bosing.",
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
            ? "Xush kelibsiz"
            : "Yangi akkaunt"}
        </h1>

        <p className="mt-1.5 text-sm leading-6 text-slate-500 sm:mt-2 sm:text-base">
          {mode === "login"
            ? "Akkauntingizga kirib o‘qishni davom ettiring."
            : "Email orqali bepul ro‘yxatdan o‘ting."}
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
          Kirish
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
          Ro‘yxatdan o‘tish
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
              aria-label={showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"}
              className="absolute inset-y-1 right-1.5 my-auto flex min-h-10 items-center rounded-xl px-3 text-xs font-bold text-slate-500 transition active:bg-slate-100 hover:bg-slate-100 hover:text-slate-800"
            >
              {showPassword ? "Yashirish" : "Ko‘rsatish"}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <div>
            <label
              htmlFor="confirmPassword"
              className="text-sm font-semibold text-slate-700"
            >
              Parolni tasdiqlash
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
            title="Kirish amalga oshmadi"
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
            "Kirish"
          ) : (
            "Ro‘yxatdan o‘tish"
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
        fullWidth
        label="Google orqali davom etish"
      />

      <p className="mt-5 text-center text-xs leading-5 text-slate-400">
        Davom etish orqali platformadan foydalanish
        qoidalariga rozilik bildirasiz.
      </p>
    </div>
  );
}
