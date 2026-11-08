import Link from "next/link";
import { BookMarked, Crown } from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
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
        title="TOP kitoblar"
        subtitle="Imtihonga tayyorlaniş töplamlari"
        chips={[
          `${textbooks.length} ta kitob`,
          `${totalTopics} ta mavzu`,
        ]}
      />

      <section className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        {!hasPremium && textbooks.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Crown
              className="h-5 w-5 shrink-0 text-amber-600"
              strokeWidth={2}
              aria-hidden="true"
            />

            <p className="text-sm leading-6 text-amber-900">
              TOP kitoblar yeçimlari Premium tarifda oçiladi.
              Maktab darsliklari esa hamma uçun bepul.
            </p>
          </div>
        )}

        {textbooks.length === 0 ? (
          <AppAlert variant="info" title="Hozirça kitob mavjud emas">
            Ustozingiz kitob qöşgaç şu yerda körinadi.
          </AppAlert>
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
                  <span className="relative block overflow-hidden rounded-2xl bg-slate-100">
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
                        <BookMarked
                          className="h-12 w-12 text-blue-300"
                          strokeWidth={1.4}
                          aria-hidden="true"
                        />
                      )}
                    </span>

                    {!hasPremium && !empty && (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[11px] font-bold text-amber-950 shadow-sm">
                        <Crown
                          className="h-3 w-3"
                          strokeWidth={2.6}
                          aria-hidden="true"
                        />
                        Premium
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
                      {empty ? "Mavzu yöq" : `${topicCount} ta mavzu`}
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
                  className="group block rounded-2xl transition sm:hover:-translate-y-1"
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
