import Link from "next/link";
import BackLink from "@/components/ui/back-link";
import { Crown, Lock } from "lucide-react";

type TestLockedScreenProps = {
  title: string;
  backHref: string;
};

/**
 * Premium talab qiladigan testga kirilganda ko'rinadigan ekran.
 *
 * Ilgari bunday holatda o'quvchi boshlash ekranini ko'rib, "Boshlash"
 * bosgandan keyingina qizil xato olardi. Endi darhol tushunarli
 * javob va Premium sahifasiga havola beriladi.
 */
export default function TestLockedScreen({
  title,
  backHref,
}: TestLockedScreenProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-2xl px-3 py-6 sm:px-6 sm:py-12">
        <BackLink href={backHref} label="Orqaga" />

        <div className="mt-3 rounded-2xl border border-blue-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-blue-700">
            <Lock className="h-7 w-7" strokeWidth={1.9} aria-hidden="true" />
          </span>

          <h1 className="mt-5 text-xl font-bold leading-snug text-mb-ink sm:text-2xl">
            Bu test Premium tarifda
          </h1>

          <p className="mt-2 text-sm leading-6 text-mb-muted">
            “{title}” testini oçiş uçun Premium tarif kerak.
            “Bepul” belgisi bor testlarni esa hoziroq işlaşingiz
            mumkin.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link
              href="/pricing"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white transition hover:bg-blue-700"
            >
              <Crown className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              Premium oliş
            </Link>

            <Link
              href={backHref}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Bepul testlar
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
