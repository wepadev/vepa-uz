import Link from "next/link";
import { notFound } from "next/navigation";

import { Video } from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import TextbookLockedScreen from "@/components/textbook-locked-screen";
import TextbooksHeader from "@/components/textbooks-header";
import TopicExampleList, {
  type TopicExample,
} from "@/components/topic-example-list";
import YouTubeEmbed from "@/components/youtube-embed";
import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mavzu videosi",
  description: "Mavzudagi misollarning videoyechimi.",
};

type PageProps = {
  searchParams: Promise<{
    textbookId?: string | string[];
    topicId?: string | string[];
  }>;
};

type TopicRow = {
  id: number;
  title: string;
  order_number: number;
  video_url: string | null;
};

type ExampleRow = {
  id: number;
  label: string;
  video_url: string | null;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TextbookSolutionsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const textbookId = Number(single(params.textbookId));
  const topicId = Number(single(params.topicId));

  if (
    !Number.isInteger(textbookId) ||
    !Number.isInteger(topicId) ||
    textbookId <= 0 ||
    topicId <= 0
  ) {
    notFound();
  }

  const { supabase } = await requireSectionAccess("textbooks");

  const [textbookResult, topicsResult] = await Promise.all([
    supabase
      .from("textbooks")
      .select(`
        id,
        title,
        grade,
        author_name,
        book_type
      `)
      .eq("id", textbookId)
      .eq("is_published", true)
      .maybeSingle(),

    /*
     * Butun darslikning mavzulari olinadi: joriy mavzu ham,
     * oldingi-keyingi havolalar ham shu ro'yxatdan chiqadi.
     * Mavzular soni kam, shuning uchun bitta so'rov yetarli.
     */
    supabase
      .from("topics")
      .select(`
        id,
        title,
        order_number,
        video_url
      `)
      .eq("textbook_id", textbookId)
      .order("order_number", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (
    textbookResult.error ||
    !textbookResult.data ||
    topicsResult.error
  ) {
    notFound();
  }

  const textbook = textbookResult.data;
  const topics = (topicsResult.data ?? []) as TopicRow[];

  const index = topics.findIndex((row) => row.id === topicId);

  if (index < 0) {
    notFound();
  }

  const topic = topics[index];
  const previous = index > 0 ? topics[index - 1] : null;
  const next = index < topics.length - 1 ? topics[index + 1] : null;

  /*
   * Premium to'sig'i mavzular ro'yxatida ham bor, lekin bu yerda
   * takrorlanadi: o'quvchi to'g'ridan-to'g'ri havola bilan kirishi
   * mumkin. Qoida bazada — bu yerda faqat natijasi so'raladi.
   */
  const { data: canAccess, error: accessError } = await supabase.rpc(
    "can_access_textbook",
    { p_textbook_id: textbookId },
  );

  if (!accessError && canAccess === false) {
    return <TextbookLockedScreen title={textbook.title} />;
  }

  /*
   * Misollar ro'yxati faqat TOP kitoblarda. Maktab darsligida
   * avvalgidek bitta mavzu videosi qoladi — u yerda mavzu kichik,
   * misollarni ajratishning keragi yo'q.
   */
  const isPopular = textbook.book_type === "popular";

  const examplesResult = isPopular
    ? await supabase
        .from("topic_examples")
        .select(`
          id,
          label,
          video_url
        `)
        .eq("topic_id", topicId)
        .order("order_number", { ascending: true })
        .order("id", { ascending: true })
    : { data: [], error: null };

  /*
   * Jadval hali yaratilmagan bo'lsa (db/33 ishga tushirilmagan)
   * sahifa qulab tushmasin — mavzu videosi baribir ko'rinadi.
   */
  const examples: TopicExample[] = examplesResult.error
    ? []
    : ((examplesResult.data ?? []) as ExampleRow[]).map((row) => ({
        id: row.id,
        label: row.label,
        videoUrl: row.video_url,
      }));

  const withVideo = examples.filter(
    (example) => Boolean(example.videoUrl),
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <TextbooksHeader
        backHref={`/textbooks/topics?textbookId=${textbookId}`}
        backLabel="Mavzular"
        title={topic.title}
        subtitle={textbook.title}
        chips={
          isPopular && examples.length > 0
            ? [
                `${topic.order_number}-mavzu`,
                `${examples.length} ta misol`,
              ]
            : [`${topic.order_number}-mavzu`]
        }
      />

      <section className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
        {/*
          Maktab darsligi: mavzuga bitta video.
          TOP kitob: misollar ro'yxati, har birining o'z videosi —
          u yerda mavzu darajasidagi video umuman ishlatilmaydi.
        */}
        {!isPopular &&
          (topic.video_url ? (
            <div className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2.5">
                <Video
                  className="h-4 w-4 text-blue-700"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />

                <p className="text-sm font-bold text-blue-800">
                  Videoyechim
                </p>
              </div>

              <div className="p-3 sm:p-4">
                <YouTubeEmbed url={topic.video_url} />
              </div>
            </div>
          ) : (
            <AppAlert variant="info" title="Video hali qo‘shilmagan">
              Ustozingiz shu mavzuning videoyechimini qo‘shgach, u shu
              yerda ochiladi.
            </AppAlert>
          ))}

        {isPopular &&
          (examples.length > 0 ? (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-bold text-mb-ink">
                  Misollar
                </h2>

                <p className="shrink-0 text-xs font-semibold text-mb-muted">
                  {withVideo} ta videoyechim
                </p>
              </div>

              <div className="mt-2.5">
                <TopicExampleList examples={examples} />
              </div>
            </div>
          ) : (
            <AppAlert
              variant="info"
              title="Misollar hali qo‘shilmagan"
            >
              Ustozingiz shu mavzuning misollarini qo‘shgach, har
              birining videoyechimi shu yerda ochiladi.
            </AppAlert>
          ))}

        {/* Mavzular orasida yurish */}
        <div className="mt-4 flex items-center justify-between gap-2">
          {previous ? (
            <Link
              href={`/textbooks/solutions?textbookId=${textbookId}&topicId=${previous.id}`}
              className="inline-flex min-h-11 max-w-[45%] items-center rounded-xl border border-mb-line bg-white px-3 text-sm font-semibold text-mb-brand shadow-sm transition sm:hover:bg-slate-50"
            >
              <span className="truncate">← {previous.title}</span>
            </Link>
          ) : (
            <span />
          )}

          {next ? (
            <Link
              href={`/textbooks/solutions?textbookId=${textbookId}&topicId=${next.id}`}
              className="inline-flex min-h-11 max-w-[45%] items-center rounded-xl border border-mb-line bg-white px-3 text-sm font-semibold text-mb-brand shadow-sm transition sm:hover:bg-slate-50"
            >
              <span className="truncate">{next.title} →</span>
            </Link>
          ) : (
            <span />
          )}
        </div>
      </section>
    </main>
  );
}
