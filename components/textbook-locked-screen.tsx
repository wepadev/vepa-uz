import Link from "next/link";
import BackLink from "@/components/ui/back-link";
import { Crown } from "@/components/ui/icons";
import { GlyphTile } from "@/components/ui/glyph";
import { btnAccent, btnGhost } from "@/lib/ui";

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
        <BackLink href="/textbooks" label="Darslik yeçimlari" />

        <div className="mt-3 rounded-2xl border border-mb-line bg-white p-6 text-center sm:p-8">
          <GlyphTile name="locked" size="lg" className="mx-auto" />

          <h1 className="mt-5 text-xl font-bold leading-snug text-mb-ink sm:text-2xl">
            TOP kitoblar yeçimlari Premium tarifda
          </h1>

          <p className="mt-2 text-sm leading-6 text-mb-muted">
            {title
              ? `“${title}” yeçimlarini oçiş uçun Premium kerak.`
              : "Bu kitob yeçimlarini oçiş uçun Premium kerak."}{" "}
            Maktab darsliklari yeçimlari esa hamma uçun bepul.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link
              href="/pricing"
              className={`${btnAccent} min-h-12`}
            >
              <Crown className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              Premium oliş
            </Link>

            <Link
              href="/textbooks/school"
              className={`${btnGhost} min-h-12`}
            >
              Maktab darsliklari
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
