import Link from "next/link";

import { ArrowRight, BookMarked, School } from "lucide-react";

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
        title="Darslik yeçimlari"
        subtitle="Maktab darsliklari va TOP kitoblar"
        chips={[
          `${textbooks.length} ta kitob`,
          `${totalTopics} ta mavzu`,
        ]}
      />

      <section className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {/*
            Ikonka plitkasi "content" ohangida (sariq) — darsliklar
            va videodarslar bitta guruhga kiradi. Havola o'qi doim
            brend ko'kida: rang bo'limni aytadi, amalni emas.
          */}
          {[
            {
              href: "/textbooks/school",
              icon: School,
              title: "Maktab darsliklari",
              text: "5–11-sinf darslik yeçimlari.",
              meta: `${schoolCount} ta darslik`,
              tone: "bg-amber-50 text-amber-700",
              ghost: "text-amber-50",
              hover: "hover:border-amber-300",
            },
            {
              href: "/textbooks/popular",
              icon: BookMarked,
              title: "TOP kitoblar",
              text: "Imtihonga tayyorlaniş töplamlari.",
              meta: `${popularCount} ta kitob`,
              tone: "bg-amber-50 text-amber-700",
              ghost: "text-amber-50",
              hover: "hover:border-amber-300",
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group relative flex flex-col overflow-hidden rounded-3xl border border-mb-line bg-white p-5 shadow-sm transition sm:p-6 sm:hover:-translate-y-0.5 sm:hover:shadow-md ${card.hover}`}
            >
              {/* Orqa fondagi yirik ikonka — bezak */}
              <card.icon
                className={`pointer-events-none absolute -right-5 -top-5 h-28 w-28 ${card.ghost}`}
                strokeWidth={1.1}
                aria-hidden="true"
              />

              <span
                className={`grid h-14 w-14 place-items-center rounded-2xl ${card.tone}`}
              >
                <card.icon
                  className="h-7 w-7"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
              </span>

              <p className="mt-4 text-xl font-bold text-mb-ink">
                {card.title}
              </p>

              <p className="mt-1 flex-1 text-sm leading-6 text-mb-muted">
                {card.text}
              </p>

              <span className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-mb-muted">
                {card.meta}

                <ArrowRight
                  className="h-5 w-5 text-mb-brand transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
