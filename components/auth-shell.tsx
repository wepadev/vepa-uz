import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import BrandMark from "@/components/ui/brand-mark";

/**
 * Kiriş, parolni tiklaş va yangi parol sahifalari uçun yagona qolip.
 *
 * Katta ekranda çapda kök panel (nima uçun kirayotganingiz), öngda
 * forma. Telefonda panel yöq — faqat logo va forma: odam bu sahifaga
 * bitta iş uçun keladi.
 */
export default function AuthShell({
  eyebrow,
  title,
  text,
  points,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  /** Raqamlangan qisqa qadamlar yoki afzalliklar */
  points: string[];
  children: ReactNode;
}) {
  return (
    <main className="min-h-svh bg-slate-50 text-slate-900">
      <div className="mx-auto grid min-h-svh max-w-7xl lg:grid-cols-[1fr_1fr]">
        <section className="spotlight hidden flex-col justify-between p-12 lg:flex">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-xl font-extrabold"
          >
            <Image
              src="/logo-white.png"
              alt=""
              width={44}
              height={44}
              priority
              className="h-11 w-11 shrink-0"
            />
            Vepa Ustoz
          </Link>

          <div className="max-w-lg">
            <p className="eyebrow !text-white/80">{eyebrow}</p>

            <h1 className="mt-4 text-[44px] font-extrabold leading-[1.08]">
              {title}
            </h1>

            <p className="mt-4 text-lg leading-8 text-white/80">{text}</p>

            <ol className="mt-8 grid gap-2.5">
              {points.map((point, index) => (
                <li
                  key={point}
                  className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3"
                >
                  <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-sm font-extrabold text-blue-700">
                    {index + 1}
                  </span>
                  <span className="font-semibold">{point}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-sm text-white/70">© 2026 Vepa Ustoz</p>
        </section>

        <section className="flex min-h-svh items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="mb-6 inline-flex min-h-11 items-center gap-2.5 text-xl font-extrabold text-mb-ink lg:hidden"
            >
              <BrandMark size={40} className="h-10 w-10" />
              Vepa Ustoz
            </Link>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
