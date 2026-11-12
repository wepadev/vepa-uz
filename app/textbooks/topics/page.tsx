import { notFound } from "next/navigation";

import { Play } from "@/components/ui/icons";

import EmptyState from "@/components/ui/empty-state";
import { Glyph } from "@/components/ui/glyph";
import { RowIndex, RowLink, RowList } from "@/components/ui/row";
import TextbookLockedScreen from "@/components/textbook-locked-screen";
import TextbooksHeader from "@/components/textbooks-header";
import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mavzular",
  description: "Darslik mavzulari va ularning videoyeçimlari.",
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
        title={textbook.title}
        subtitle={`${bookLabel}${textbook.author_name ? ` · ${textbook.author_name}` : ""}`}
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Kitob kartasi — qaysi kitob içidasiz va unda nima bor */}
        <div className="flex items-center gap-4 rounded-2xl border border-mb-line bg-white p-3.5">
          <span className="grid-plane flex h-24 w-[70px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-mb-line bg-mb-tintSoft p-0.5">
            {textbook.cover_url ? (
              <img
                loading="lazy"
                decoding="async"
                src={textbook.cover_url}
                alt=""
                aria-hidden="true"
                className="h-full w-full bg-white object-contain"
              />
            ) : (
              <Glyph name={isPopular ? "top" : "school"} className="h-9 w-9" />
            )}
          </span>

          <dl className="grid flex-1 grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-xs font-semibold text-mb-muted">Mavzular</dt>
              <dd className="num mt-0.5 text-xl font-extrabold text-mb-ink">
                {topics.length}
              </dd>
            </div>

            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-xs font-semibold text-mb-muted">
                Videoyeçimlar
              </dt>
              <dd className="num mt-0.5 text-xl font-extrabold text-mb-brandDark">
                {withVideo}
              </dd>
            </div>
          </dl>
        </div>

        {topics.length === 0 ? (
          <EmptyState
            glyph="solutions"
            title="Hozirça mavzu yöq"
            className="mt-4"
          >
            Mavzu qöşilişi bilan şu yerda körinadi.
          </EmptyState>
        ) : (
          <>
            <p className="eyebrow mt-6">Mavzular</p>

            <RowList className="mt-3">
              {topics.map((topic) => {
                const counts = exampleCounts.get(topic.id);
                const exampleTotal = counts?.total ?? 0;
                const exampleVideos = counts?.withVideo ?? 0;

                /*
                 * TOP kitobda mavzu misollari bilan oçiladi — mavzu
                 * darajasidagi video u yerda işlatilmaydi.
                 */
                const empty = isPopular
                  ? exampleVideos === 0
                  : !topic.video_url;

                const caption = isPopular
                  ? exampleTotal === 0
                    ? "Misol qöşilmagan"
                    : `${exampleTotal} misol · ${exampleVideos} video`
                  : empty
                    ? "Yeçim tayyorlanmoqda"
                    : "Videoyeçim";

                return (
                  <RowLink
                    key={topic.id}
                    href={
                      empty
                        ? undefined
                        : `/textbooks/solutions?textbookId=${textbookId}&topicId=${topic.id}`
                    }
                    lead={
                      <RowIndex
                        value={topic.order_number}
                        className={
                          empty ? "text-slate-400" : "bg-mb-tint text-mb-brandDark"
                        }
                      />
                    }
                    title={topic.title}
                    meta={caption}
                    trail={
                      empty ? null : (
                        <Play
                          className="h-4 w-4 shrink-0 text-mb-brand"
                          fill="currentColor"
                          strokeWidth={0}
                          aria-hidden="true"
                        />
                      )
                    }
                  />
                );
              })}
            </RowList>
          </>
        )}
      </section>
    </main>
  );
}
