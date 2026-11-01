import Image from "next/image";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import BrandMark from "@/components/ui/brand-mark";

export default function ForgotPasswordPage() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />

      <div className="relative mx-auto grid min-h-svh max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between bg-mb-brand p-12 text-white lg:flex">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-xl font-bold"
          >
            <Image src="/logo-white.png" alt="" width={44} height={44} priority className="h-11 w-11 shrink-0" />
            Vepa Ustoz
          </Link>

          <div className="max-w-xl">
            <p className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20">
              Akkaunt xavfsizligi
            </p>

            <h1 className="mt-6 text-5xl font-bold leading-tight">
              Parolingizni xavfsiz tarzda tiklang.
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-8 text-blue-100">
              Email manzilingizni kiriting. Sizga yangi
              parol örnatiş uçun maxsus havola yuboriladi.
            </p>

            <div className="mt-9 space-y-3">
              {[
                "Emailingizga tiklaş havolasi yuboriladi",
                "Havola orqali yangi parol örnatasiz",
                "Yangi parol bilan qayta kirasiz",
              ].map((text, index) => (
                <div
                  key={text}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/15 text-sm font-bold">
                    {index + 1}
                  </span>
                  <p className="font-medium">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-blue-200">
            © 2026 Vepa Ustoz
          </p>
        </section>

        <section className="flex min-h-svh items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="mb-7 inline-flex items-center gap-3 text-xl font-bold text-blue-700 lg:hidden"
            >
              <BrandMark size={40} className="h-10 w-10" />
              Vepa Ustoz
            </Link>

            <ForgotPasswordForm />
          </div>
        </section>
      </div>
    </main>
  );
}
