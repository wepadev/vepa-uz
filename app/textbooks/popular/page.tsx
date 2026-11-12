import Link from "next/link";
import { Lock } from "lucide-react";

import EmptyState from "@/components/ui/empty-state";
import { Glyph } from "@/components/ui/glyph";
import PremiumNote from "@/components/ui/premium-note";
import TextbooksHeader from "@/components/textbooks-header";
import {
  hasActivePremium,
  requireSectionAccess,
} from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "TOP kitoblar",
  description:
    "Ommabop qöllanmalar: misollarning yozma yeçimi va mavzu videolari.",
};

type TextbookRow = {
  id: number;
  title: string;
  grade: number | null;
  cover_url: string | null;
  author_name: string | null;
  book_type: "school" | "popular";
};

type TopicRow = {
  textbook_id: number;
};

export default async function TextbookSectionPage() {
  const { supabase, profile } = await requireSectionAccess("textbooks");

  /*
   * TOP kitoblar Premium tarifda. Bu yerdagi tekshiruv faqat
   * ko'rinish uchun — asosiy to'siq darslik ichida va bazada.
   */
  const hasPremium = hasActivePremium(profile);

  const textbooksResult = await supabase
      .from("textbooks")
      .select(`
        id,
        title,
        grade,
        cover_url,
        author_name,
        book_type
      `)
      .eq("is_published", true)
      .eq("book_type", "popular")
      .order("title", {
        ascending: true,
      });

  if (textbooksResult.error) {
    throw new Error(
      `Darsliklar yuklanmadi: ${textbooksResult.error.message}`,
    );
  }

  const textbooks =
    (textbooksResult.data ??
      []) as TextbookRow[];

  /*
   * Mavzular sonini sanash uchun faqat shu ro'yxatdagi darsliklarni
   * so'raymiz. Ilgari butun `topics` jadvali yuklanardi.
   */
  const textbookIds = textbooks.map((book) => book.id);

  const topicsResult = textbookIds.length
    ? await supabase
        .from("topics")
        .select("textbook_id")
        .in("textbook_id", textbookIds)
    : { data: [], error: null };

  if (topicsResult.error) {
    throw new Error(
      `Mavzular soni yuklanmadi: ${topicsResult.error.message}`,
    );
  }

  const topics =
    (topicsResult.data ??
      []) as TopicRow[];

  const topicCountMap =
    new Map<number, number>();

  for (const topic of topics) {
    topicCountMap.set(
      topic.textbook_id,
      (topicCountMap.get(
        topic.textbook_id,
      ) ?? 0) + 1,
    );
  }

  const totalTopics = [...topicCountMap.values()].reduce(
    (sum, value) => sum + value,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <TextbooksHeader
        backHref="/textbooks"
        backLabel="Darslik yeçimlari"
        glyph="top"
        title="TOP kitoblar"
        subtitle={`${textbooks.length} kitob · ${totalTopics} mavzu`}
      />

      <section className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {!hasPremium && textbooks.length > 0 && (
          <PremiumNote>
            TOP kitoblar yeçimlari{" "}
            <b className="font-semibold text-vp-ink">Premium</b> bilan oçiladi.
            Maktab darsliklari hamma uçun bepul.
          </PremiumNote>
        )}

        {textbooks.length === 0 ? (
          <EmptyState glyph="top" title="Hozirça kitob yöq">
            Kitob qöşilişi bilan şu yerda körinadi.
          </EmptyState>
        ) : (
          /*
           * Kitob javoni ko'rinishi: muqova katta, nom pastda.
           * Muqova bu bo'limning asosiy belgisi — o'quvchi kitobni
           * nomidan ko'ra rasmidan tezroq taniydi.
           */
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {textbooks.map((textbook) => {
              const topicCount = topicCountMap.get(textbook.id) ?? 0;
              const empty = topicCount === 0;

              const card = (
                <>
                  <span className="relative block overflow-hidden rounded-2xl border border-mb-line bg-white">
                    <span className="flex aspect-[3/4] items-center justify-center p-2">
                      {textbook.cover_url ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={textbook.cover_url}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-contain drop-shadow-md transition-transform duration-300 sm:group-hover:scale-[1.03]"
                        />
                      ) : (
                        <Glyph name="top" className="h-14 w-14" />
                      )}
                    </span>

                    {!hasPremium && !empty && (
                      <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-mb-line">
                        <Lock className="h-4 w-4" aria-label="Premium" />
                      </span>
                    )}

                    {empty && (
                      <span className="absolute inset-x-2 bottom-2 rounded-lg bg-slate-900/70 px-2 py-1 text-center text-[11px] font-bold text-white">
                        Tayyorlanmoqda
                      </span>
                    )}
                  </span>

                  <span className="mt-2 block px-0.5">
                    <span className="block text-[15px] font-bold leading-5 text-mb-ink">
                      {textbook.title}
                    </span>

                    {textbook.author_name && (
                      <span className="mt-0.5 block truncate text-xs text-mb-muted">
                        {textbook.author_name}
                      </span>
                    )}

                    <span className="mt-1 block text-xs font-semibold text-mb-muted">
                      {empty ? "Tayyorlanmoqda" : `${topicCount} mavzu`}
                    </span>
                  </span>
                </>
              );

              return empty ? (
                <div key={textbook.id} className="opacity-60">
                  {card}
                </div>
              ) : (
                <Link
                  key={textbook.id}
                  href={`/textbooks/topics?textbookId=${textbook.id}`}
                  className="press group block rounded-2xl"
                >
                  {card}
                </Link>
              );
            })}
          </div>
        )}

      </section>
    </main>
  );
}
