import Link from "next/link";
import { Crown, Lock } from "lucide-react";

type TextbookLockedScreenProps = {
  /** Darslik nomi — bo'lmasa umumiy matn chiqadi */
  title?: string | null;
};

/**
 * TOP kitob yechimlariga premiumsiz kirilganda ko'rinadigan ekran.
 *
 * Maktab darsliklari hamma uchun ochiq, TOP kitoblar esa Premium
 * tarifda. Shuning uchun bu yerda "bepul bo'limga o'tish" havolasi
 * ham bor — o'quvchi quruq to'siqqa emas, alternativaga tushadi.
 */
export default function TextbookLockedScreen({
  title,
}: TextbookLockedScreenProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-2xl px-3 py-6 sm:px-6 sm:py-12">
        <Link
          href="/textbooks"
          className="inline-flex min-h-8 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
        >
          ← Darslik yechimlari
        </Link>

        <div className="mt-3 rounded-2xl border border-blue-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <Lock className="h-7 w-7" strokeWidth={1.9} aria-hidden="true" />
          </span>

          <h1 className="mt-5 text-xl font-bold leading-snug text-mb-ink sm:text-2xl">
            TOP kitoblar yechimlari Premium tarifda
          </h1>

          <p className="mt-2 text-sm leading-6 text-mb-muted">
            {title
              ? `“${title}” yechimlarini ochish uchun Premium kerak.`
              : "Bu kitob yechimlarini ochish uchun Premium kerak."}{" "}
            Maktab darsliklari yechimlari esa hamma uchun bepul.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link
              href="/pricing"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white transition hover:bg-blue-700"
            >
              <Crown className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              Premium olish
            </Link>

            <Link
              href="/textbooks/school"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Maktab darsliklari
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
