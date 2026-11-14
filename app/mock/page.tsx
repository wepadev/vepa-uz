import Link from "next/link";

import { ChevronRight } from "@/components/ui/icons";
import EmptyState from "@/components/ui/empty-state";
import { GlyphTile } from "@/components/ui/glyph";
import PageHeader, { headerButton } from "@/components/ui/page-header";
import { examGlyph } from "@/lib/exam-visuals";
import { MOCK_EXAMS } from "@/lib/mock";
import { requireSectionAccess } from "@/lib/require-section-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mock testlar",
  description:
    "Milliy sertifikat, Attestatsiya va SAT formatidagi vaqtli töliq mock testlar.",
};

type ExamTypeRow = {
  id: number;
  code: string;
  title: string;
  description: string | null;
};

type SectionRow = { id: number; exam_type_id: number };
type TopicRow = { id: number; section_id: number };
type TestRow = { id: number; topic_id: number | null };

/**
 * Mock testlar bölimi.
 *
 * Yönalişlar (db/43): Milliy sertifikat, Attestatsiya, SAT. Har biri
 * oddiy test katalogi kabi işlaydi — bölim, yil, variant — faqat
 * /tests da emas, şu yerda turadi.
 */
export default async function MockPage() {
  const { supabase, profile } = await requireSectionAccess("tests");

  const [examsResult, sectionsResult, topicsResult, testsResult] =
    await Promise.all([
      supabase
        .from("test_exam_types")
        .select("id, code, title, description")
        .like("code", "mock-%")
        .eq("is_published", true),
      supabase
        .from("test_sections")
        .select("id, exam_type_id")
        .eq("is_published", true),
      supabase
        .from("test_topics")
        .select("id, section_id")
        .eq("is_published", true),
      supabase
        .from("tests")
        .select("id, topic_id")
        .eq("is_published", true)
        .not("topic_id", "is", null),
    ]);

  if (examsResult.error) {
    throw new Error(`Mock yönalişlari yuklanmadi: ${examsResult.error.message}`);
  }

  const exams = (examsResult.data ?? []) as ExamTypeRow[];
  const sectionExam = new Map(
    ((sectionsResult.data ?? []) as SectionRow[]).map((row) => [
      row.id,
      row.exam_type_id,
    ]),
  );
  const topicExam = new Map<number, number>();
  for (const topic of (topicsResult.data ?? []) as TopicRow[]) {
    const examId = sectionExam.get(topic.section_id);
    if (examId !== undefined) topicExam.set(topic.id, examId);
  }

  const testCount = new Map<number, number>();
  for (const test of (testsResult.data ?? []) as TestRow[]) {
    const examId = test.topic_id === null ? undefined : topicExam.get(test.topic_id);
    if (examId === undefined) continue;
    testCount.set(examId, (testCount.get(examId) ?? 0) + 1);
  }

  /* Tartib va qisqa izoh lib/mock.ts dan */
  const ordered = MOCK_EXAMS.map((meta) => ({
    meta,
    exam: exams.find((exam) => exam.code === meta.code),
  })).filter(
    (row): row is { meta: (typeof MOCK_EXAMS)[number]; exam: ExamTypeRow } =>
      Boolean(row.exam),
  );

  const total = ordered.reduce(
    (sum, row) => sum + (testCount.get(row.exam.id) ?? 0),
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        glyph="mock"
        title="Mock testlar"
        subtitle={
          total > 0
            ? `${total} ta töliq variant · haqiqiy imtihon vaqti bilan`
            : "Haqiqiy imtihon formatida töliq testlar"
        }
        action={
          profile.role === "admin" ? (
            <Link href="/admin/tests" className={headerButton}>
              Boşqariş
            </Link>
          ) : (
            <Link href="/results" className={headerButton}>
              Natijalarim
            </Link>
          )
        }
      />

      <section className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        <p className="eyebrow">Imtihon turini tanlang</p>

        {!ordered.length ? (
          <EmptyState glyph="mock" title="Hozirça mock test yöq" className="mt-3">
            Mock testlar qöşilişi bilan şu yerda çiqadi.
          </EmptyState>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {ordered.map(({ meta, exam }) => {
              const count = testCount.get(exam.id) ?? 0;
              const empty = count === 0;

              const body = (
                <>
                  <GlyphTile name={examGlyph(exam.code)} size="lg" />

                  <span className="min-w-0 flex-1 lg:w-full">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-lg font-bold leading-6 text-mb-ink">
                        {exam.title}
                      </span>

                      {!empty && (
                        <ChevronRight
                          className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      )}
                    </span>

                    <span className="mt-0.5 block line-clamp-2 text-sm leading-5 text-mb-muted">
                      {meta.hint}
                    </span>

                    <span className="num mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                      {empty ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500">
                          Tez orada
                        </span>
                      ) : (
                        <span className="rounded-md bg-mb-tintSoft px-2 py-0.5 text-mb-brandDark">
                          {count} variant
                        </span>
                      )}
                    </span>
                  </span>
                </>
              );

              const className =
                "edge group flex items-center gap-4 rounded-2xl border border-mb-line bg-white p-4 lg:flex-col lg:items-start lg:gap-5 lg:p-5";

              return empty ? (
                <div key={exam.id} className={`${className} opacity-70`}>
                  {body}
                </div>
              ) : (
                <Link
                  key={exam.id}
                  href={`/tests/sections?exam=${encodeURIComponent(exam.code)}`}
                  className={className}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-mb-line bg-white p-4 sm:p-5">
          <p className="text-base font-bold text-mb-ink">Mock qanday işlaydi</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-mb-muted">
            <li>· Variant haqiqiy imtihondagidek: 1–32 test, 33–35 moslaştiriş, 36–45 a) va b) javobli savollar.</li>
            <li>· Taymer boşlanadi; internet uzilsa javoblaringiz saqlanib qoladi.</li>
            <li>· a) va b) javoblarni matematik klaviatura bilan yozasiz: kasr, ildiz, daraja, π.</li>
            <li>· Tugatgaç natija va har savolning yeçimi darrov çiqadi.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
