import Link from "next/link";
import { Lock, Play, RotateCcw } from "@/components/ui/icons";
import { notFound, redirect } from "next/navigation";

import EmptyState from "@/components/ui/empty-state";
import PremiumNote from "@/components/ui/premium-note";
import ProgressRing from "@/components/ui/progress-ring";
import { RowIndex, Tag } from "@/components/ui/row";
import { btnGhost, btnPrimary } from "@/lib/ui";

import { isMockExamCode } from "@/lib/mock";
import { requireSectionAccess } from "@/lib/require-section-access";
import PageHeader, { headerButton } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Testlar röyxati",
  description:
    "Mavzudagi barça testlar.",
};

const PASS_PERCENTAGE = 90;

type PageProps = {
  searchParams: Promise<{
    topicId?: string | string[];
    sectionId?: string | string[];
  }>;
};

type TopicRow = {
  id: number;
  section_id: number;
  title: string;
  description: string | null;
  order_number: number;
  is_free: boolean;
};

type SectionRow = {
  id: number;
  exam_type_id: number;
  title: string;
  description: string | null;
  order_number: number;
};

type ExamTypeRow = {
  id: number;
  code: string;
  title: string;
};

type TestRow = {
  id: number;
  section_id: number;
  topic_id: number | null;
  title: string;
  description: string | null;
  time_limit_minutes: number | string;
  order_number: number;
  created_at: string;
  is_free: boolean;
};

type QuestionRow = {
  id: number;
  test_id: number;
  block_id: number | null;
};

type QuestionBlockRow = {
  id: number;
  test_id: number;
  block_type: "written_parts" | "shared_options";
};

type LessonTestRow = {
  test_id: number | null;
};

type UserTestStatisticsRow = {
  test_id: number | string;
  attempts_count: number | string;
  last_attempt_at: string | null;
  best_attempt_id: string | null;
  best_percentage: number | string;
  test_rank: number | string;
  test_participants: number | string;
};

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercentage(value: number | string | null | undefined) {
  const number = toNumber(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatTimeLimit(value: number | string) {
  const minutes = Number(value);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "Vaqt körsatilmagan";
  }

  const totalSeconds = Math.round(minutes * 60);

  if (totalSeconds < 60) {
    return `${totalSeconds} soniya`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} soat`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes} daqiqa`);
  if (seconds > 0) parts.push(`${seconds} soniya`);

  return parts.join(" ");
}

export default async function TestListPage({ searchParams }: PageProps) {
  const params = await searchParams;

  /*
   * Eski havolalar (`?sectionId=`) hali ham ishlasin: endi bo'lim
   * ichida mavzular turadi, shuning uchun mavzular ro'yxatiga
   * yuboramiz. Bu bo'lmasa saqlab qo'yilgan havola 404 berardi.
   */
  const legacySectionId = Number(singleValue(params.sectionId));

  if (
    !singleValue(params.topicId) &&
    Number.isInteger(legacySectionId) &&
    legacySectionId > 0
  ) {
    redirect(`/tests/topics?sectionId=${legacySectionId}`);
  }

  const topicId = Number(singleValue(params.topicId));

  if (!Number.isInteger(topicId) || topicId <= 0) {
    notFound();
  }

  const { supabase, profile, isPremium } =
    await requireSectionAccess("tests");

  const { data: topicData, error: topicError } = await supabase
    .from("test_topics")
    .select("id, section_id, title, description, order_number, is_free")
    .eq("id", topicId)
    .eq("is_published", true)
    .maybeSingle();

  if (topicError) {
    throw new Error(`Mavzu yuklanmadi: ${topicError.message}`);
  }

  if (!topicData) {
    notFound();
  }

  const topic = topicData as TopicRow;

  const { data: sectionData, error: sectionError } = await supabase
    .from("test_sections")
    .select("id, exam_type_id, title, description, order_number")
    .eq("id", topic.section_id)
    .eq("is_published", true)
    .maybeSingle();

  if (sectionError) {
    throw new Error(`Bölim yuklanmadi: ${sectionError.message}`);
  }

  if (!sectionData) {
    notFound();
  }

  const section = sectionData as SectionRow;

  const { data: examTypeData, error: examTypeError } = await supabase
    .from("test_exam_types")
    .select("id, code, title")
    .eq("id", section.exam_type_id)
    .eq("is_published", true)
    .maybeSingle();

  if (examTypeError) {
    throw new Error(
      `Test yönalişi yuklanmadi: ${examTypeError.message}`,
    );
  }

  if (!examTypeData) {
    notFound();
  }

  const examType = examTypeData as ExamTypeRow;

  const [
    firstSectionResult,
    firstTopicResult,
    testsResult,
    lessonTestsResult,
    statisticsResult,
  ] =
    await Promise.all([
      supabase
        .from("test_sections")
        .select("id")
        .eq("exam_type_id", examType.id)
        .eq("is_published", true)
        .order("order_number", { ascending: true })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle(),

      /*
       * Bepul mavzu: birinchi bo'limning birinchi mavzusi.
       * Qoida db/34 dagi `free_topic_id()` bilan bir xil bo'lishi
       * shart — bu yerda tugma, u yerda testga kirish huquqi
       * hal bo'ladi, ikkisi bir xil javob berishi kerak.
       */
      supabase
        .from("test_topics")
        .select("id")
        .eq("section_id", section.id)
        .eq("is_published", true)
        .order("order_number", { ascending: true })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("tests")
        .select(`
          id,
          section_id,
          topic_id,
          title,
          description,
          time_limit_minutes,
          order_number,
          created_at,
          is_free
        `)
        .eq("topic_id", topic.id)
        .eq("is_published", true)
        .order("order_number", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("lesson_tests")
        .select("test_id"),
      supabase.rpc("get_user_test_statistics", {
        p_user_id: null,
        p_test_id: null,
      }),
    ]);

  if (firstSectionResult.error) {
    throw new Error(
      `Bepul bölim aniqlanmadi: ${firstSectionResult.error.message}`,
    );
  }

  if (firstTopicResult.error) {
    throw new Error(
      `Bepul mavzu aniqlanmadi: ${firstTopicResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(`Testlar yuklanmadi: ${testsResult.error.message}`);
  }

  if (lessonTestsResult.error) {
    throw new Error(
      `Dars testlari tekşirilmadi: ${lessonTestsResult.error.message}`,
    );
  }

  if (statisticsResult.error) {
    throw new Error(
      `Şaxsiy statistika yuklanmadi: ${statisticsResult.error.message}`,
    );
  }

  const lessonTestIds = new Set(
    ((lessonTestsResult.data ?? []) as LessonTestRow[])
      .map((row) => row.test_id)
      .filter((id): id is number => typeof id === "number"),
  );

  /*
   * Darsga biriktirilgan testlar ham şu yerda körinadi — ilgari ular
   * Testlardan yaşirilardi va mavzu "test qöşilmagan" bölib qolardi.
   */
  const tests = (testsResult.data ?? []) as TestRow[];

  const testIds = tests.map((test) => test.id);
  let questions: QuestionRow[] = [];
  let blocks: QuestionBlockRow[] = [];

  if (testIds.length > 0) {
    const [questionsResult, blocksResult] = await Promise.all([
      supabase
        .from("questions")
        .select("id, test_id, block_id")
        .in("test_id", testIds),
      supabase
        .from("question_blocks")
        .select("id, test_id, block_type")
        .in("test_id", testIds),
    ]);

    if (questionsResult.error) {
      throw new Error(
        `Savollar soni yuklanmadi: ${questionsResult.error.message}`,
      );
    }

    if (blocksResult.error) {
      throw new Error(
        `Savol bloklari yuklanmadi: ${blocksResult.error.message}`,
      );
    }

    questions = (questionsResult.data ?? []) as QuestionRow[];
    blocks = (blocksResult.data ?? []) as QuestionBlockRow[];
  }

  const blockMap = new Map(blocks.map((block) => [block.id, block]));
  const metricsByTest = new Map<
    number,
    { displayQuestionCount: number; maxScore: number; answerCount: number }
  >();
  /* Mock testda ball/foiz örniga "nechtadan nechta töğri" */
  const mockExam = isMockExamCode(examType.code);

  for (const test of tests) {
    const testQuestions = questions.filter(
      (question) => question.test_id === test.id,
    );
    const testBlocks = blocks.filter((block) => block.test_id === test.id);
    const standaloneCount = testQuestions.filter(
      (question) => question.block_id === null,
    ).length;
    const sharedQuestionCount = testQuestions.filter((question) => {
      if (question.block_id === null) return false;
      return blockMap.get(question.block_id)?.block_type === "shared_options";
    }).length;
    const writtenBlockCount = testBlocks.filter(
      (block) => block.block_type === "written_parts",
    ).length;

    metricsByTest.set(test.id, {
      displayQuestionCount:
        standaloneCount + sharedQuestionCount + writtenBlockCount,
      maxScore: testQuestions.length * 2,
      answerCount: testQuestions.length,
    });
  }

  const statisticsByTest = new Map<number, UserTestStatisticsRow>();

  for (const row of (statisticsResult.data ?? []) as UserTestStatisticsRow[]) {
    statisticsByTest.set(toNumber(row.test_id), row);
  }

  /*
   * Bepul qoidasi: yo'nalishning birinchi bo'limi, uning birinchi
   * mavzusi — o'sha mavzudagi barcha testlar bepul. Qolgan
   * mavzular ham, qolgan bo'limlar ham Premium. Avval "dastlabki
   * 3 ta test" degan qoida bor edi, u olib tashlandi.
   */
  const isFirstSection = firstSectionResult.data?.id === section.id;
  const isAutoFreeTopic =
    isFirstSection && firstTopicResult.data?.id === topic.id;

  /*
   * Mavzu qo'lda bepul qilingan bo'lsa ham ochiq. Bepullik bo'limdan
   * meros olinmaydi — har bir test darajasida hal bo'ladi (db/35).
   */
  const isFreeTopic = isAutoFreeTopic || topic.is_free;
  const isAdmin = profile.role === "admin";

  const solvedCount = tests.filter(
    (test) => statisticsByTest.get(test.id)?.best_attempt_id,
  ).length;
  const topicLocked = !isAdmin && !isPremium && !isFreeTopic;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref={`/tests/topics?sectionId=${section.id}`}
        backLabel={section.title}
        title={topic.title}
        subtitle={`${examType.title} · ${tests.length} test`}
        width="3xl"
        action={
          <Link href="/results" className={headerButton}>
            Natijalarim
          </Link>
        }
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {!tests.length ? (
          <EmptyState glyph="tests" title="Hozirça faol test yöq">
            Test naşr qilinganda şu yerda körinadi.
          </EmptyState>
        ) : (
          <>
            {/* Mavzu böyiça umumiy holat: neçta testdan neçtasi işlangan */}
            <div className="flex items-center gap-4 rounded-2xl border border-mb-line bg-white p-4">
              <ProgressRing
                value={(solvedCount / tests.length) * 100}
                size={56}
                stroke={6}
                tone={solvedCount === tests.length ? "success" : "brand"}
              >
                <span className="num text-sm font-bold text-mb-ink">
                  {solvedCount}/{tests.length}
                </span>
              </ProgressRing>

              <div className="min-w-0 flex-1">
                <p className="font-bold leading-5 text-mb-ink">
                  {solvedCount === 0
                    ? "Bu mavzuda hali test işlamadingiz"
                    : solvedCount === tests.length
                      ? "Mavzudagi hamma test işlangan"
                      : `${tests.length - solvedCount} ta test qoldi`}
                </p>
                <p className="mt-0.5 text-sm text-mb-muted">
                  {isFreeTopic
                    ? "Bu mavzudagi barça testlar bepul."
                    : isPremium || isAdmin
                      ? "Natija va tahlil test tugaşi bilan çiqadi."
                      : "Bu mavzu Premium tarifga kiradi."}
                </p>
              </div>
            </div>

            {topicLocked && tests.some((test) => !test.is_free) && (
              <PremiumNote className="mt-3">
                Qulfli testlar{" "}
                <b className="font-semibold text-vp-ink">Premium</b> bilan
                oçiladi.
              </PremiumNote>
            )}

            <ol className="mt-4 grid gap-3">
              {tests.map((test, index) => {
                const metrics = metricsByTest.get(test.id) ?? {
                  displayQuestionCount: 0,
                  maxScore: 0,
                  answerCount: 0,
                };
                const stats = statisticsByTest.get(test.id);
                const bestAttemptId = stats?.best_attempt_id ?? null;
                const bestPercentage = toNumber(stats?.best_percentage);
                const bestCorrect = Math.round(
                  (bestPercentage / 100) * metrics.answerCount,
                );
                const passed = bestPercentage >= PASS_PERCENTAGE;
                const isFree = test.is_free || isFreeTopic;
                const canStart = isAdmin || isPremium || isFree;
                const attempts = toNumber(stats?.attempts_count);

                return (
                  <li
                    key={test.id}
                    className="rounded-2xl border border-mb-line bg-white"
                  >
                    <div className="flex items-start gap-3 p-3.5 sm:p-4">
                      {bestAttemptId ? (
                        <ProgressRing
                          value={bestPercentage}
                          size={44}
                          stroke={5}
                          tone={passed ? "success" : "brand"}
                        >
                          <span className="num text-[11px] font-bold text-mb-ink">
                            {mockExam ? bestCorrect : Math.round(bestPercentage)}
                          </span>
                        </ProgressRing>
                      ) : (
                        <RowIndex
                          value={index + 1}
                          tone={canStart ? "plain" : "locked"}
                          className="h-11 w-11"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-base font-bold leading-snug text-mb-ink">
                            {test.title}
                          </h2>

                          <span className="flex shrink-0 gap-1">
                            {lessonTestIds.has(test.id) && (
                              <Tag tone="neutral">Dars testi</Tag>
                            )}
                            {isFree && !isPremium && !isAdmin && (
                              <Tag tone="free">Bepul</Tag>
                            )}
                          </span>
                        </div>

                        <p className="num mt-0.5 text-[13px] text-mb-muted">
                          {metrics.displayQuestionCount} savol ·{" "}
                          {!mockExam && `${metrics.maxScore} ball · `}
                          {formatTimeLimit(test.time_limit_minutes)}
                        </p>

                        {bestAttemptId && (
                          <p className="num mt-1.5 text-[13px] font-semibold text-slate-700">
                            Oxirgi natija{" "}
                            <span
                              className={
                                passed ? "text-vp-success" : "text-mb-brandDark"
                              }
                            >
                              {mockExam
                                ? `${bestCorrect}/${metrics.answerCount} töğri`
                                : `${formatPercentage(bestPercentage)}%`}
                            </span>
                            <span className="font-normal text-mb-muted">
                              {" "}
                              · {toNumber(stats?.test_rank)}-örin (
                              {toNumber(stats?.test_participants)} kişidan)
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 border-t border-mb-line px-2 py-2 sm:px-3">
                      <Link
                        href={`/leaderboard?testId=${test.id}`}
                        className="inline-flex min-h-10 items-center rounded-lg px-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      >
                        Reyting
                      </Link>

                      {bestAttemptId && (
                        <Link
                          href={`/results/view?attemptId=${bestAttemptId}`}
                          className="inline-flex min-h-10 items-center rounded-lg px-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                          Tahlil
                        </Link>
                      )}

                      {attempts > 0 && (
                        <span className="num hidden px-2 text-[13px] text-mb-muted sm:inline">
                          {attempts} uriniş
                        </span>
                      )}

                      <span className="flex-1" />

                      {canStart ? (
                        <Link
                          href={`/tests/take?testId=${test.id}`}
                          className={
                            bestAttemptId
                              ? `${btnGhost} min-h-10`
                              : `${btnPrimary} min-h-10`
                          }
                        >
                          {bestAttemptId ? (
                            <>
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
                              Qayta işlaş
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" aria-hidden="true" />
                              Boşlaş
                            </>
                          )}
                        </Link>
                      ) : (
                        <Link href="/pricing" className={`${btnGhost} min-h-10`}>
                          <Lock className="h-4 w-4" aria-hidden="true" />
                          Oçiş
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </main>
  );
}
