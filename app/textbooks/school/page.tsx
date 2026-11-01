import Link from "next/link";
import { ChevronRight, School } from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import TextbooksHeader from "@/components/textbooks-header";
import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Maktab darsliklari",
  description:
    "5–11-sinf maktab darsliklari: misollarning yozma yeçimi va mavzu videolari.",
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
  const { supabase } = await requireSectionAccess("textbooks");

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
      .eq("book_type", "school")
      .order("grade", {
        ascending: true,
        nullsFirst: false,
      })
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

  /*
   * Darsliklar sinflarga bo'lib chiqariladi. Ilgari hammasi
   * bitta uzun ro'yxat edi va o'quvchi o'z sinfini ko'z bilan
   * qidirib topardi.
   */
  const grades = [
    ...new Set(textbooks.map((book) => book.grade)),
  ].sort((a, b) => (a ?? 99) - (b ?? 99));

  const totalTopics = [...topicCountMap.values()].reduce(
    (sum, value) => sum + value,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <TextbooksHeader
        backHref="/textbooks"
        backLabel="Darslik yeçimlari"
        title="Maktab darsliklari"
        subtitle="Sinfingizni tanlang"
        chips={[
          `${textbooks.length} ta darslik`,
          `${totalTopics} ta mavzu`,
        ]}
      />

      <section className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        {textbooks.length === 0 ? (
          <AppAlert
            variant="info"
            title="Hozirça darslik mavjud emas"
          >
            Ustozingiz darslik qöşgaç şu yerda körinadi.
          </AppAlert>
        ) : (
          <div className="space-y-7">
            {grades.map((grade) => (
              <div key={grade ?? "boshqa"}>
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-mb-muted">
                    {grade ? `${grade}-sinf` : "Boşqa"}
                  </h2>

                  <span className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {textbooks
                    .filter((book) => book.grade === grade)
                    .map((textbook) => {
                      const topicCount =
                        topicCountMap.get(textbook.id) ?? 0;

                      const empty = topicCount === 0;

                      const card = (
                        <>
                          {textbook.cover_url ? (
                            /*
                             * `object-contain`: muqova rasmi qanday
                             * o'lchamda bo'lsa ham kesilmaydi. Kitob
                             * suratlari kvadrat ham, uzunchoq ham
                             * bo'lishi mumkin.
                             */
                            <img
                              loading="lazy"
                              decoding="async"
                              src={textbook.cover_url}
                              alt=""
                              aria-hidden="true"
                              className="h-24 w-[70px] shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-0.5"
                            />
                          ) : (
                            <span className="grid h-24 w-[70px] shrink-0 place-items-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700">
                              <School
                                className="h-7 w-7"
                                strokeWidth={1.7}
                                aria-hidden="true"
                              />
                            </span>
                          )}

                          <span className="flex min-w-0 flex-1 flex-col self-stretch">
                            <span className="text-[15px] font-bold leading-6 text-mb-ink">
                              {textbook.title}
                            </span>

                            {textbook.author_name && (
                              <span className="mt-0.5 truncate text-xs text-mb-muted">
                                {textbook.author_name}
                              </span>
                            )}

                            <span className="mt-auto pt-2 text-sm font-semibold text-mb-muted">
                              {empty
                                ? "Mavzu qöşilmagan"
                                : `${topicCount} ta mavzu`}
                            </span>
                          </span>

                          {!empty && (
                            <ChevronRight
                              className="h-5 w-5 shrink-0 self-center text-mb-muted"
                              strokeWidth={2.2}
                              aria-hidden="true"
                            />
                          )}
                        </>
                      );

                      return empty ? (
                        <div
                          key={textbook.id}
                          className="flex gap-3 rounded-2xl border border-mb-line bg-white p-3 opacity-60 shadow-sm"
                        >
                          {card}
                        </div>
                      ) : (
                        <Link
                          key={textbook.id}
                          href={`/textbooks/topics?textbookId=${textbook.id}`}
                          className="flex gap-3 rounded-2xl border border-mb-line bg-white p-3 shadow-sm transition sm:hover:-translate-y-0.5 sm:hover:border-blue-300 sm:hover:shadow-md"
                        >
                          {card}
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
