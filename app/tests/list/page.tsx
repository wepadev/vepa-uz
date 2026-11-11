import Link from "next/link";
import { ClipboardCheck, Crown, Trophy } from "lucide-react";
import { notFound, redirect } from "next/navigation";

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

  const tests = ((testsResult.data ?? []) as TestRow[]).filter(
    (test) => !lessonTestIds.has(test.id),
  );

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
    { displayQuestionCount: number; maxScore: number }
  >();

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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref={`/tests/topics?sectionId=${section.id}`}
        backLabel={`${section.title} mavzulari`}
        title={topic.title}
        subtitle={topic.description || "Testni tanlang va işlaşni boşlang."}
        width="7xl"
        chips={[isAdmin ? "Admin" : isPremium ? "Premium faol" : "Bepul tarif"]}
        action={
          <Link href="/results" className={headerButton}>
            Natijalarim
          </Link>
        }
      />

      <section className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-12">
        <div className="hero-board rounded-3xl p-6 text-white sm:p-8">
          <p className="text-sm font-bold text-blue-100">
            {examType.title} · {section.title}
          </p>
          <h2 className="mt-2 text-3xl font-bold">{topic.title} testlari</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100">
            {isAutoFreeTopic
              ? "Bu yönalişning birinçi mavzusi — undagi barça testlar bepul."
              : topic.is_free
                ? "Bu mavzudagi barça testlar bepul oçilgan."
                : "Uşbu mavzudagi testlar Premium tarifga kiradi."}
          </p>
        </div>

        {!tests.length ? (
          <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-lg font-bold text-slate-700">
              Hozirça faol test yöq
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Administrator testni naşr qilganda şu yerda körinadi.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-2.5 sm:mt-7 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tests.map((test) => {
              const metrics = metricsByTest.get(test.id) ?? {
                displayQuestionCount: 0,
                maxScore: 0,
              };
              const stats = statisticsByTest.get(test.id);
              const bestAttemptId = stats?.best_attempt_id ?? null;
              const bestPercentage = toNumber(stats?.best_percentage);
              const passed = bestPercentage >= PASS_PERCENTAGE;
              const isFree = test.is_free || isFreeTopic;
              const canStart = isAdmin || isPremium || isFree;

              return (
                <article
                  key={test.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm transition sm:rounded-3xl sm:hover:shadow-[0_8px_24px_rgba(16,24,40,0.10)]"
                >
                  <div
                    className={
                      isFree
                        ? "hidden h-1.5 bg-emerald-500 sm:block"
                        : "hidden h-1.5 bg-mb-brand sm:block"
                    }
                  />
                  <div className="flex flex-1 flex-col p-3.5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mb-tint text-mb-brand sm:h-12 sm:w-12 sm:rounded-2xl">
                        <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.9} aria-hidden="true" />
                      </span>
                      <div className="flex flex-wrap justify-end gap-2">
                        <span
                          className={
                            isFree
                              ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                              : "inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700"
                          }
                        >
                          {isFree ? (
                            "Bepul"
                          ) : (
                            <>
                              <Crown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                              Premium
                            </>
                          )}
                        </span>
                        {passed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            <Trophy className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                            90%+
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-2.5 text-[15px] font-bold leading-snug text-mb-ink sm:mt-5 sm:text-xl sm:leading-7">
                      {test.title}
                    </h3>
                    <p className="mt-1 line-clamp-1 flex-1 text-[13px] leading-5 text-mb-muted sm:mt-2 sm:line-clamp-none sm:text-sm sm:leading-6">
                      {test.description || "Matematika testi"}
                    </p>

                    <p className="mt-2 text-[12px] font-medium text-mb-muted sm:hidden">
                      {metrics.displayQuestionCount} savol · {metrics.maxScore} ball ·{" "}
                      {formatTimeLimit(test.time_limit_minutes)}
                    </p>

                    <div className="mt-5 hidden grid-cols-3 gap-2 sm:grid">
                      <div className="rounded-2xl bg-slate-50 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Savollar
                        </p>
                        <p className="mt-1 font-bold">
                          {metrics.displayQuestionCount}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Ball
                        </p>
                        <p className="mt-1 font-bold text-blue-700">
                          {metrics.maxScore}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Vaqt
                        </p>
                        <p className="mt-1 text-xs font-bold text-blue-700">
                          {formatTimeLimit(test.time_limit_minutes)}
                        </p>
                      </div>
                    </div>

                    {bestAttemptId && (
                      <div className="mt-2.5 rounded-xl border border-blue-100 bg-blue-50 p-2.5 sm:mt-4 sm:rounded-2xl sm:p-4">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-brand sm:text-[11px]">
                              Eng yaxşi natija
                            </p>
                            <p
                              className={
                                passed
                                  ? "mt-0.5 text-lg font-bold text-emerald-600 sm:mt-1 sm:text-2xl"
                                  : "mt-0.5 text-lg font-bold text-blue-700 sm:mt-1 sm:text-2xl"
                              }
                            >
                              {formatPercentage(bestPercentage)}%
                            </p>
                          </div>
                          <p className="text-sm font-bold text-blue-900">
                            {toNumber(stats?.test_rank)}/
                            {toNumber(stats?.test_participants)}
                          </p>
                        </div>
                      </div>
                    )}

                    {canStart ? (
                      <Link
                        href={`/tests/take?testId=${test.id}`}
                        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-mb-brand px-5 text-center text-sm font-bold text-white transition hover:bg-mb-brandDark sm:mt-5 sm:min-h-12 sm:rounded-2xl sm:text-base"
                      >
                        {bestAttemptId ? "Qayta işlaş" : "Testni boşlaş"}
                      </Link>
                    ) : (
                      <Link
                        href="/pricing"
                        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-mb-brand px-5 text-center text-sm font-bold text-white transition hover:bg-mb-brandDark sm:mt-5 sm:min-h-12 sm:rounded-2xl sm:text-base"
                      >
                        Premium orqali oçiş
                      </Link>
                    )}

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Link
                        href={`/leaderboard?testId=${test.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-center text-sm font-bold text-blue-700 hover:bg-blue-100"
                      >
                        Reyting
                      </Link>
                      {bestAttemptId ? (
                        <Link
                          href={`/results/view?attemptId=${bestAttemptId}`}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Natijam
                        </Link>
                      ) : (
                        <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-3 py-2.5 text-center text-sm font-bold text-slate-500">
                          Uriniş: {toNumber(stats?.attempts_count)}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
