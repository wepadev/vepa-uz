import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "@/components/login-form";
import BrandMark from "@/components/ui/brand-mark";
import WorkedExample from "@/components/ui/worked-example";
import { getSafeNext } from "@/lib/safe-next";

type PageProps = {
  searchParams: Promise<{
    mode?: string | string[];
    next?: string | string[];
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

  const next = getSafeNext(
    Array.isArray(params.next) ? params.next[0] : params.next,
  );

  return (
    <main className="relative min-h-svh overflow-hidden bg-slate-50 text-slate-900">

      <div className="relative mx-auto grid min-h-svh max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between hero-board p-12 text-white lg:flex">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3 font-serif text-xl font-bold"
            >
              <Image src="/logo-white.png" alt="" width={44} height={44} priority className="h-11 w-11 shrink-0" />
              Vepa Ustoz
            </Link>
          </div>

          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-200">
              Matematika — aniq va tuşunarli
            </p>

            <h1 className="mt-5 text-[52px] font-bold leading-[1.08]">
              Darslar, testlar va natijalar — barçasi bir joyda.
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-8 text-blue-100">
              Email yoki Google hisobingiz orqali kiring. Yangi
              foydalanuvçilar şu sahifaning özida röyxatdan
              ötişi mumkin.
            </p>

            <WorkedExample className="mt-10 max-w-md rotate-[-1deg] text-mb-ink" />
          </div>

          <p className="text-sm text-blue-200">
            © Vepa Ustoz
          </p>
        </section>

        <section className="flex min-h-svh items-center justify-center px-3 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="mb-5 inline-flex min-h-11 items-center gap-2.5 font-serif text-xl font-bold text-mb-ink lg:hidden"
            >
              <BrandMark size={40} className="h-10 w-10" />
              Vepa Ustoz
            </Link>

            <LoginForm initialMode={initialMode} next={next} />
          </div>
        </section>
      </div>
    </main>
  );
}
