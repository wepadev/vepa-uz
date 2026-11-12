import Link from "next/link";
import BackLink from "@/components/ui/back-link";
import { Crown } from "@/components/ui/icons";
import { GlyphTile } from "@/components/ui/glyph";
import { btnAccent, btnGhost } from "@/lib/ui";

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

        <div className="mt-3 rounded-2xl border border-mb-line bg-white p-6 text-center sm:p-8">
          <GlyphTile name="locked" size="lg" className="mx-auto" />

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
              className={`${btnAccent} min-h-12`}
            >
              <Crown className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              Premium oliş
            </Link>

            <Link
              href={backHref}
              className={`${btnGhost} min-h-12`}
            >
              Bepul testlar
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
