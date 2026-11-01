"use client";

import type {
  FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import AppAlert from "@/components/ui/app-alert";
import { LoadingLabel } from "@/components/ui/spinner";

type ProfileFormProps = {
  initialFullName: string;
  email: string;
  provider: "email" | "google";
  role: string;
  access: {
    textbooks: boolean;
    lessons: boolean;
    tests: boolean;
  };
};

function translatePasswordError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("same password") ||
    normalized.includes("different from the old")
  ) {
    return "Yangi parol eski paroldan farq qilişi kerak.";
  }

  if (
    normalized.includes("reauthentication") ||
    normalized.includes("nonce")
  ) {
    return "Xavfsizlik uçun parolni tiklaş havolasi orqali yangilang.";
  }

  if (
    normalized.includes("password") &&
    normalized.includes("at least")
  ) {
    return "Parol kamida 8 ta belgidan iborat bölişi kerak.";
  }

  return "Parolni yangilab bölmadi. Qayta urinib köring.";
}

export default function ProfileForm({
  initialFullName,
  email,
  provider,
  role,
  access,
}: ProfileFormProps) {
  const router = useRouter();

  const [fullName, setFullName] =
    useState(initialFullName);
  const [nameLoading, setNameLoading] =
    useState(false);
  const [nameError, setNameError] =
    useState<string | null>(null);
  const [nameSuccess, setNameSuccess] =
    useState<string | null>(null);

  const [password, setPassword] =
    useState("");
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [
    passwordLoading,
    setPasswordLoading,
  ] = useState(false);
  const [
    passwordError,
    setPasswordError,
  ] = useState<string | null>(null);
  const [
    passwordSuccess,
    setPasswordSuccess,
  ] = useState<string | null>(null);

  async function updateName(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedName = fullName
      .trim()
      .replace(/\s+/g, " ");

    setNameError(null);
    setNameSuccess(null);

    if (normalizedName.length < 2) {
      setNameError(
        "Ism-familiya kamida 2 ta belgidan iborat bölişi kerak.",
      );
      return;
    }

    if (normalizedName.length > 120) {
      setNameError(
        "Ism-familiya 120 ta belgidan oşmasligi kerak.",
      );
      return;
    }

    setNameLoading(true);

    try {
      const supabase = createClient();

      const { error: profileError } =
        await supabase.rpc(
          "update_my_profile",
          {
            p_full_name: normalizedName,
          },
        );

      if (profileError) {
        throw profileError;
      }

      /*
       * Auth metadata ham yangilanadi. Asosiy ism
       * public.profiles jadvalidan olinadi.
       */
      const { error: metadataError } =
        await supabase.auth.updateUser({
          data: {
            full_name: normalizedName,
            name: normalizedName,
          },
        });

      if (metadataError) {
        console.error(
          "Auth metadata yangilanmadi:",
          metadataError,
        );
      }

      setFullName(normalizedName);
      setNameSuccess(
        "Ism-familiyangiz yangilandi.",
      );

      router.refresh();
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "";

      setNameError(
        message ||
          "Profilni yangilab bölmadi.",
      );
    } finally {
      setNameLoading(false);
    }
  }

  async function updatePassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setPasswordError(null);
    setPasswordSuccess(null);

    if (password.length < 8) {
      setPasswordError(
        "Parol kamida 8 ta belgidan iborat bölişi kerak.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError(
        "Parollar bir xil emas.",
      );
      return;
    }

    setPasswordLoading(true);

    try {
      const supabase = createClient();

      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        throw error;
      }

      setPassword("");
      setConfirmPassword("");
      setPasswordSuccess(
        "Parolingiz muvaffaqiyatli yangilandi.",
      );
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "";

      setPasswordError(
        translatePasswordError(message),
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  const accessItems = [
    {
      label: "Darsliklar",
      enabled: access.textbooks,
    },
    {
      label: "Darslar",
      enabled: access.lessons,
    },
    {
      label: "Testlar",
      enabled: access.tests,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Profil ma’lumotlari
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Ism-familiyani özgartiriş
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Bu ism boş sahifa, testlar va
            natijalarda körinadi.
          </p>

          <form
            onSubmit={updateName}
            className="mt-6 space-y-5"
          >
            <div>
              <label
                htmlFor="profile-full-name"
                className="text-sm font-semibold text-slate-700"
              >
                Ism-familiya
              </label>

              <input
                id="profile-full-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) =>
                  setFullName(
                    event.target.value,
                  )
                }
                maxLength={120}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                required
              />
            </div>

            {nameError && (
              <AppAlert
                variant="error"
                title="Profil yangilanmadi"
              >
                {nameError}
              </AppAlert>
            )}

            {nameSuccess && (
              <AppAlert
                variant="success"
                title="Profil yangilandi"
              >
                {nameSuccess}
              </AppAlert>
            )}

            <button
              type="submit"
              disabled={nameLoading}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3.5 font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              {nameLoading ? (
                <LoadingLabel>
                  Saqlanmoqda...
                </LoadingLabel>
              ) : (
                "Özgarişni saqlaş"
              )}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Akkaunt xavfsizligi
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Parolni yangilaş
          </h2>

          {provider === "google" ? (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
              <p className="font-semibold text-blue-900">
                Google orqali kirilgan
              </p>

              <p className="mt-1 text-sm leading-6 text-blue-700">
                Bu akkauntga Google hisobingiz orqali
                kirasiz. Google parolini Google
                akkauntingiz sozlamalaridan boşqaring.
              </p>
            </div>
          ) : (
            <form
              onSubmit={updatePassword}
              className="mt-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="profile-new-password"
                  className="text-sm font-semibold text-slate-700"
                >
                  Yangi parol
                </label>

                <div className="relative mt-2">
                  <input
                    id="profile-new-password"
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
                    minLength={8}
                    placeholder="Kamida 8 ta belgi"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 pr-20 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) =>
                          !current,
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
                  htmlFor="profile-confirm-password"
                  className="text-sm font-semibold text-slate-700"
                >
                  Parolni tasdiqlaş
                </label>

                <input
                  id="profile-confirm-password"
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
                  minLength={8}
                  placeholder="Parolni qayta kiriting"
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              {passwordError && (
                <AppAlert
                  variant="error"
                  title="Parol yangilanmadi"
                >
                  {passwordError}
                </AppAlert>
              )}

              {passwordSuccess && (
                <AppAlert
                  variant="success"
                  title="Parol yangilandi"
                >
                  {passwordSuccess}
                </AppAlert>
              )}

              <button
                type="submit"
                disabled={passwordLoading}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3.5 font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
              >
                {passwordLoading ? (
                  <LoadingLabel>
                    Yangilanmoqda...
                  </LoadingLabel>
                ) : (
                  "Parolni yangilaş"
                )}
              </button>

              <a
                href="/auth/forgot-password"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Email orqali tiklaş
              </a>
            </form>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Akkaunt
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Email
              </p>
              <p className="mt-1 break-all font-semibold text-slate-800">
                {email || "Körsatilmagan"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Kiriş usuli
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {provider === "google"
                  ? "Google hisobi"
                  : "Email va parol"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Hisob turi
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {role === "admin"
                  ? "Administrator"
                  : "Öquvçi"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
            Ruxsatlar
          </p>

          <h2 className="mt-2 text-xl font-bold text-slate-950">
            Platforma bölimlari
          </h2>

          <div className="mt-5 space-y-3">
            {accessItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <span className="font-semibold text-slate-700">
                  {item.label}
                </span>

                <span
                  className={
                    item.enabled
                      ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                      : "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700"
                  }
                >
                  {item.enabled
                    ? "Ruxsat bor"
                    : "Yopiq"}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Ruxsatlarni faqat administrator
            özgartiradi.
          </p>
        </section>
      </aside>
    </div>
  );
}
