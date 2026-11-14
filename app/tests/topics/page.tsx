import Link from "next/link";
import { notFound } from "next/navigation";

import EmptyState from "@/components/ui/empty-state";
import { isMockExamCode } from "@/lib/mock";
import PageHeader, { headerButton } from "@/components/ui/page-header";
import PremiumNote from "@/components/ui/premium-note";
import { RowIndex, RowLink, RowList, RowLock, Tag } from "@/components/ui/row";
import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mavzular",
  description: "Tanlangan bölimdagi test mavzulari.",
};

type PageProps = {
  searchParams: Promise<{
    sectionId?: string | string[];
  }>;
};

type SectionRow = {
  id: number;
  exam_type_id: number;
  title: string;
  description: string | null;
};

type ExamTypeRow = {
  id: number;
  code: string;
  title: string;
};

type TopicRow = {
  id: number;
  title: string;
  description: string | null;
  order_number: number;
  is_free: boolean;
};

type TestRow = {
  id: number;
  topic_id: number | null;
};

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TestTopicsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sectionId = Number(singleValue(params.sectionId));

  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    notFound();
  }

  const { supabase, profile } = await requireSectionAccess("tests");

  const { data: sectionData, error: sectionError } = await supabase
    .from("test_sections")
    .select("id, exam_type_id, title, description")
    .eq("id", sectionId)
    .eq("is_published", true)
    .maybeSingle();

  if (sectionError) {
    throw new Error(`Bölim yuklanmadi: ${sectionError.message}`);
  }

  if (!sectionData) notFound();

  const section = sectionData as SectionRow;

  const { data: examTypeData, error: examTypeError } = await supabase
    .from("test_exam_types")
    .select("id, code, title")
    .eq("id", section.exam_type_id)
    .eq("is_published", true)
    .maybeSingle();

  if (examTypeError) {
    throw new Error(`Test yönalişi yuklanmadi: ${examTypeError.message}`);
  }

  if (!examTypeData) notFound();

  const examType = examTypeData as ExamTypeRow;
  /* Mock yönalişida mavzu — yil, test — variant (db/43) */
  const isMock = isMockExamCode(examType.code);
  const unit = isMock ? "variant" : "test";

  const [topicsResult, firstSectionResult, testsResult] =
    await Promise.all([
      supabase
        .from("test_topics")
        .select("id, title, description, order_number, is_free")
        .eq("section_id", section.id)
        .eq("is_published", true)
        .order("order_number", { ascending: true })
        .order("id", { ascending: true }),

      /*
       * Bepul mavzu qaysi ekanini aniqlash uchun yo'nalishning
       * birinchi nashr qilingan bo'limi kerak. Qoida db/34 dagi
       * `free_topic_id()` bilan bir xil: birinchi bo'lim, uning
       * birinchi mavzusi.
       */
      supabase
        .from("test_sections")
        .select("id")
        .eq("exam_type_id", examType.id)
        .eq("is_published", true)
        .order("order_number", { ascending: true })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("tests")
        .select("id, topic_id")
        .eq("is_published", true)
        .not("topic_id", "is", null),
    ]);

  if (topicsResult.error) {
    throw new Error(`Mavzular yuklanmadi: ${topicsResult.error.message}`);
  }

  if (firstSectionResult.error) {
    throw new Error(
      `Bepul bölim aniqlanmadi: ${firstSectionResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(`Testlar soni yuklanmadi: ${testsResult.error.message}`);
  }

  const topics = (topicsResult.data ?? []) as TopicRow[];
  const testCountByTopic = new Map<number, number>();

  for (const test of (testsResult.data ?? []) as TestRow[]) {
    if (test.topic_id === null) continue;

    testCountByTopic.set(
      test.topic_id,
      (testCountByTopic.get(test.topic_id) ?? 0) + 1,
    );
  }

  /*
   * Avtomatik bepul mavzu: birinchi bo'limning birinchi mavzusi.
   * Undan tashqari admin istalgan mavzuni qo'lda bepul qilishi
   * mumkin (`is_free`) — bo'lim Premium bo'lsa ham u ochiq qoladi.
   * Qoida db/35 dagi `math_booster_is_test_free()` bilan bir xil.
   */
  const isFirstSection = firstSectionResult.data?.id === section.id;
  const freeTopicId = isFirstSection ? topics[0]?.id ?? null : null;

  const totalTests = topics.reduce(
    (sum, topic) => sum + (testCountByTopic.get(topic.id) ?? 0),
    0,
  );
  const hasLockedTopic = topics.some(
    (topic) => topic.id !== freeTopicId && !topic.is_free,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref={`/tests/sections?exam=${encodeURIComponent(examType.code)}`}
        backLabel={examType.title}
        title={section.title}
        subtitle={
          topics.length
            ? `${topics.length} ${isMock ? "yil" : "mavzu"} · ${totalTests} ${unit}`
            : section.description || "Mavzuni tanlang"
        }
        action={
          profile.role === "admin" ? (
            <Link
              href={`/admin/tests/section?sectionId=${section.id}`}
              className={headerButton}
            >
              Boşqariş
            </Link>
          ) : (
            <Link href="/results" className={headerButton}>
              Natijalarim
            </Link>
          )
        }
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {!topics.length ? (
          <EmptyState
            glyph={isMock ? "mock" : "tests"}
            title={isMock ? "Tez orada" : "Hozirça mavzu qöşilmagan"}
          >
            {isMock
              ? "Bu bölimga variantlar tayyorlanmoqda."
              : "Mavzular naşr qilinganda şu yerda körinadi."}
          </EmptyState>
        ) : (
          <>
            <p className="eyebrow">{isMock ? "Yilni tanlang" : "Mavzuni tanlang"}</p>

            <RowList className="mt-3">
              {topics.map((topic, index) => {
                const isFree = topic.id === freeTopicId || topic.is_free;
                const testCount = testCountByTopic.get(topic.id) ?? 0;

                return (
                  <RowLink
                    key={topic.id}
                    href={`/tests/list?topicId=${topic.id}`}
                    lead={<RowIndex value={index + 1} />}
                    title={topic.title}
                    meta={
                      testCount > 0 ? `${testCount} ${unit}` : `${isMock ? "Variant" : "Test"} qöşilmagan`
                    }
                    muted={testCount === 0}
                    trail={
                      isFree ? <Tag tone="free">Bepul</Tag> : <RowLock />
                    }
                  />
                );
              })}
            </RowList>

            {hasLockedTopic && (
              <PremiumNote className="mt-4">
                Qulfli {isMock ? "variantlar" : "mavzular"}{" "}
                <b className="font-semibold text-vp-ink">Premium</b> bilan
                oçiladi.
              </PremiumNote>
            )}
          </>
        )}
      </section>
    </main>
  );
}
