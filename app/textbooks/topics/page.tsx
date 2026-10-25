import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import { BookOpen, ChevronRight, Play, Video } from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import TextbookLockedScreen from "@/components/textbook-locked-screen";
import TextbooksHeader from "@/components/textbooks-header";
import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mavzular",
  description: "Darslik mavzulari va ularning videoyechimlari.",
};

type PageProps = {
  searchParams: Promise<{
    textbookId?: string | string[];
  }>;
};

type TopicRow = {
  id: number;
  title: string;
  order_number: number;
  /** Mavzu videoyechimi — bitta videoda hamma misollar */
  video_url: string | null;
};

type ExampleCountRow = {
  topic_id: number;
  total: number;
  with_video: number;
};


function single(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export default async function TextbookTopicsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const textbookId = Number(
    single(params.textbookId),
  );

  if (
    !Number.isInteger(textbookId) ||
    textbookId <= 0
  ) {
    notFound();
  }

  const { supabase } = await requireSectionAccess(
    "textbooks",
  );

  const [textbookResult, topicsResult] = await Promise.all([
    supabase
      .from("textbooks")
      .select(`
        id,
        title,
        grade,
        author_name,
        book_type,
        cover_url,
        is_published
      `)
      .eq("id", textbookId)
      .eq("is_published", true)
      .maybeSingle(),

    supabase
      .from("topics")
      .select(`
        id,
        title,
        order_number,
        video_url
      `)
      .eq("textbook_id", textbookId)
      .order("order_number", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      }),
  ]);

  if (
    textbookResult.error ||
    !textbookResult.data
  ) {
    notFound();
  }

  if (topicsResult.error) {
    throw new Error(
      `Mavzular yuklanmadi: ${topicsResult.error.message}`,
    );
  }

  const textbook = textbookResult.data;

  /*
   * TOP kitoblar yechimlari Premium tarifda, maktab darsliklari
   * hamma uchun ochiq. Qoida bazadagi can_access_textbook()
   * funksiyasida — bu yerda faqat natijasini so'raymiz.
   *
   * RPC xato bersa (db/09 hali ishga tushirilmagan bo'lsa)
   * to'sib qo'ymaymiz — sayt avvalgidek ishlashda davom etadi.
   */
  const { data: canAccess, error: accessError } = await supabase.rpc(
    "can_access_textbook",
    { p_textbook_id: textbookId },
  );

  if (!accessError && canAccess === false) {
    return <TextbookLockedScreen title={textbook.title} />;
  }

  const topics =
    (topicsResult.data ??
      []) as TopicRow[];

  /*
   * TOP kitobda mavzu ichida misollar ro'yxati bo'ladi, har birining
   * o'z videosi bilan. Maktab darsligida esa avvalgidek bitta mavzu
   * videosi — u yerda misollarni ajratishning keragi yo'q.
   *
   * Sonlar bitta RPC bilan olinadi: har bir mavzu uchun alohida
   * so'rov yuborilmasin.
   */
  const isPopular = textbook.book_type === "popular";

  const exampleCounts = new Map<
    number,
    { total: number; withVideo: number }
  >();

  if (isPopular) {
    const { data: countRows, error: countError } = await supabase.rpc(
      "topic_example_counts",
      { p_textbook_id: textbookId },
    );

    /*
     * Xato bersa (db/33 hali ishga tushirilmagan) to'sib qo'ymaymiz —
     * sahifa mavzu videolari bilan avvalgidek ishlayveradi.
     */
    if (!countError) {
      for (const row of (countRows ?? []) as ExampleCountRow[]) {
        exampleCounts.set(row.topic_id, {
          total: row.total,
          withVideo: row.with_video,
        });
      }
    }
  }

  const backHref =
    textbook.book_type === "school"
      ? "/textbooks/school"
      : "/textbooks/popular";

  const bookLabel =
    textbook.book_type === "school"
      ? `${textbook.grade}-sinf darsligi`
      : "TOP kitob";

  /*
   * Kitob kartasidagi belgi. Maktab darsligida — videosi bor
   * mavzular soni, TOP kitobda — misol videolarining umumiy soni.
   */
  const withVideo = isPopular
    ? [...exampleCounts.values()].reduce(
        (sum, item) => sum + item.withVideo,
        0,
      )
    : topics.filter((topic) => Boolean(topic.video_url)).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <TextbooksHeader
        backHref={backHref}
        backLabel={
          textbook.book_type === "school"
            ? "Maktab darsliklari"
            : "TOP kitoblar"
        }
        title="Mavzular"
        subtitle={textbook.title}
      />

      <section className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
        {/* Kitob kartasi — qaysi kitob ichidasiz */}
        <div className="flex gap-4 rounded-2xl border border-mb-line bg-white p-4 shadow-sm">
          <span className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-1">
            {textbook.cover_url ? (
              <img
                loading="lazy"
                decoding="async"
                src={textbook.cover_url}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain drop-shadow"
              />
            ) : (
              <BookOpen
                className="h-8 w-8 text-blue-300"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
          </span>

          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-lg font-bold leading-6 text-mb-ink">
              {textbook.title}
            </span>

            <span className="mt-0.5 text-sm text-mb-muted">
              {bookLabel}
              {textbook.author_name ? ` · ${textbook.author_name}` : ""}
            </span>

            <span className="mt-auto flex flex-wrap gap-1.5 pt-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {topics.length} ta mavzu
              </span>

              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <Video
                  className="h-3 w-3"
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
                {withVideo} ta videoyechim
              </span>
            </span>
          </span>
        </div>

        {topics.length === 0 ? (
          <AppAlert
            variant="info"
            title="Hozircha mavzu mavjud emas"
            className="mt-4"
          >
            Ustozingiz mavzu qo‘shgach shu yerda ko‘rinadi.
          </AppAlert>
        ) : (
          <div className="mt-4 grid gap-2.5">
            {topics.map((topic) => {
              const counts = exampleCounts.get(topic.id);
              const exampleTotal = counts?.total ?? 0;
              const exampleVideos = counts?.withVideo ?? 0;

              /*
               * TOP kitobda mavzu misollari bilan ochiladi — mavzu
               * darajasidagi video u yerda ishlatilmaydi.
               */
              const empty = isPopular
                ? exampleVideos === 0
                : !topic.video_url;

              const caption = isPopular
                ? exampleTotal === 0
                  ? "Misol qo‘shilmagan"
                  : `${exampleTotal} ta misol · ${exampleVideos} ta video`
                : empty
                  ? "Video qo‘shilmagan"
                  : `${topic.order_number}-mavzu · videoyechim`;

              const row = (
                <>
                  <span
                    className={
                      empty
                        ? "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-400"
                        : "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mb-brand text-white shadow-sm"
                    }
                  >
                    {empty ? (
                      topic.order_number
                    ) : (
                      <Play
                        className="h-5 w-5"
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-6 text-mb-ink">
                      {topic.title}
                    </span>

                    <span className="mt-0.5 block text-xs text-mb-muted">
                      {caption}
                    </span>
                  </span>

                  {!empty && (
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-mb-muted transition-transform sm:group-hover:translate-x-0.5"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  )}
                </>
              );

              return empty ? (
                <div
                  key={topic.id}
                  className="flex items-center gap-3 rounded-2xl border border-mb-line bg-white px-3 py-3 opacity-60 shadow-sm"
                >
                  {row}
                </div>
              ) : (
                <Link
                  key={topic.id}
                  href={`/textbooks/solutions?textbookId=${textbookId}&topicId=${topic.id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-mb-line bg-white px-3 py-3 shadow-sm transition sm:hover:-translate-y-0.5 sm:hover:border-blue-300 sm:hover:shadow-md"
                >
                  {row}
                </Link>
              );
            })}
          </div>
        )}

      </section>
    </main>
  );
}
