import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "@/components/login-form";
import BrandMark from "@/components/ui/brand-mark";

type PageProps = {
  searchParams: Promise<{
    mode?: string | string[];
  }>;
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const rawMode = Array.isArray(params.mode)
    ? params.mode[0]
    : params.mode;

  const initialMode =
    rawMode === "signup" ? "signup" : "login";

  return (
    <main className="relative min-h-svh overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />

      <div className="relative mx-auto grid min-h-svh max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between bg-mb-brand p-12 text-white lg:flex">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3 text-xl font-bold"
            >
              <Image src="/logo-white.png" alt="" width={44} height={44} priority className="h-11 w-11 shrink-0" />
              Vepa Ustoz
            </Link>
          </div>

          <div className="max-w-xl">
            <p className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20">
              Matematika — aniq va tushunarli
            </p>

            <h1 className="mt-6 text-5xl font-bold leading-tight">
              Darslar, testlar va natijalar — barchasi bir joyda.
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-8 text-blue-100">
              Email yoki Google hisobingiz orqali kiring. Yangi
              foydalanuvchilar shu sahifaning o‘zida ro‘yxatdan
              o‘tishi mumkin.
            </p>

            <div className="mt-9 grid gap-4 sm:grid-cols-3">
              {[
                ["01", "Darsliklar"],
                ["02", "Darslar"],
                ["03", "Testlar"],
              ].map(([number, label]) => (
                <div
                  key={number}
                  className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15"
                >
                  <p className="text-sm font-bold text-blue-200">
                    {number}
                  </p>
                  <p className="mt-2 font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-blue-200">
            © Vepa Ustoz
          </p>
        </section>

        <section className="flex min-h-svh items-center justify-center px-3 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="mb-5 inline-flex min-h-11 items-center gap-3 text-xl font-bold text-blue-700 lg:hidden"
            >
              <BrandMark size={40} className="h-10 w-10" />
              Vepa Ustoz
            </Link>

            <LoginForm initialMode={initialMode} />
          </div>
        </section>
      </div>
    </main>
  );
}
