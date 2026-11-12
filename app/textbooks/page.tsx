import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { GlyphTile } from "@/components/ui/glyph";
import TextbooksHeader from "@/components/textbooks-header";

import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Darslik yeçimlari",
  description:
    "Maktab darsliklari va TOP kitoblar yeçimlari: har bir misolning yozma yeçimi va mavzu videosi.",
};

type TextbookRow = {
  id: number;
  book_type: "school" | "popular";
};

type TopicRow = {
  textbook_id: number;
};

export default async function TextbooksPage() {
  const { supabase } = await requireSectionAccess("textbooks");

  const [
    textbooksResult,
    topicsResult,
  ] = await Promise.all([
    supabase
      .from("textbooks")
      .select("id, book_type")
      .eq("is_published", true),

    supabase
      .from("topics")
      .select("textbook_id"),
  ]);

  if (textbooksResult.error) {
    throw new Error(
      `Darsliklar yuklanmadi: ${textbooksResult.error.message}`,
    );
  }

  if (topicsResult.error) {
    throw new Error(
      `Mavzular soni yuklanmadi: ${topicsResult.error.message}`,
    );
  }

  const textbooks =
    (textbooksResult.data ??
      []) as TextbookRow[];

  const topics =
    (topicsResult.data ??
      []) as TopicRow[];

  const publishedIds = new Set(
    textbooks.map((book) => book.id),
  );

  const totalTopics = topics.filter(
    (topic) =>
      publishedIds.has(topic.textbook_id),
  ).length;

  const schoolCount = textbooks.filter(
    (book) => book.book_type === "school",
  ).length;

  const popularCount = textbooks.filter(
    (book) => book.book_type === "popular",
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <TextbooksHeader
        backHref="/"
        backLabel="Boş sahifa"
        glyph="solutions"
        title="Darslik yeçimlari"
        subtitle={`${textbooks.length} kitob · ${totalTopics} mavzu`}
      />

      <section className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        <p className="eyebrow">Qaysi kitobdan?</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                href: "/textbooks/school",
                glyph: "school",
                title: "Maktab darsliklari",
                text: "5–11-sinf darsliklaridagi masalalar yeçimi.",
                meta: `${schoolCount} darslik`,
              },
              {
                href: "/textbooks/popular",
                glyph: "top",
                title: "TOP kitoblar",
                text: "Imtihonga tayyorlaniş töplamlari yeçimi.",
                meta: `${popularCount} kitob`,
              },
            ] as const
          ).map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="edge group flex items-center gap-4 rounded-2xl border border-mb-line bg-white p-4 sm:flex-col sm:items-start sm:p-5"
            >
              <GlyphTile name={card.glyph} size="lg" />

              <span className="min-w-0 flex-1 sm:w-full">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-lg font-bold leading-6 text-mb-ink">
                    {card.title}
                  </span>

                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>

                <span className="mt-0.5 block text-sm leading-5 text-mb-muted">
                  {card.text}
                </span>

                <span className="num mt-2 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {card.meta}
                </span>
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-5 text-sm leading-6 text-mb-muted">
          Har bir masalaning yozma yeçimi va mavzu videosi bir joyda.
        </p>
      </section>
    </main>
  );
}
