import Image from "next/image";
import Link from "next/link";

import { UpdatePasswordForm } from "@/components/update-password-form";
import BrandMark from "@/components/ui/brand-mark";

export default function UpdatePasswordPage() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-slate-50 text-slate-900">

      <div className="relative mx-auto grid min-h-svh max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between hero-board p-12 text-white lg:flex">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-xl font-bold"
          >
            <Image src="/logo-white.png" alt="" width={44} height={44} priority className="h-11 w-11 shrink-0" />
            Vepa Ustoz
          </Link>

          <div className="max-w-xl">
            <p className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20">
              Yangi parol
            </p>

            <h1 className="mt-6 text-5xl font-bold leading-tight">
              Akkauntingiz uçun yangi parol yarating.
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-8 text-blue-100">
              Esda saqlaş oson, lekin boşqalar topişi
              qiyin bölgan paroldan foydalaning.
            </p>

            <div className="mt-9 rounded-3xl bg-white/10 p-6 ring-1 ring-white/15">
              <p className="font-bold">
                Xavfsiz parol tavsiyasi
              </p>

              <p className="mt-2 leading-7 text-blue-100">
                Kamida 8 ta belgi, katta-kiçik harf va
                raqam aralaşmasidan foydalaning.
              </p>
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

            <UpdatePasswordForm />
          </div>
        </section>
      </div>
    </main>
  );
}
