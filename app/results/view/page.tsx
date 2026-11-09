import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import MathText from "@/components/math-text";
import YouTubeEmbed from "@/components/youtube-embed";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import type { RankingTestRpcRow } from "@/lib/stats-types";
import { TEST_TOPIC_SELECT, testLabel } from "@/lib/test-label";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Natija tafsiloti",
  description:
    "Urinişdagi har bir savol böyiça tahlil.",
};

const QUESTION_IMAGE_BUCKET = "question-images";
const SIGNED_URL_SECONDS = 60 * 60 * 6;

type PageProps = {
  searchParams: Promise<{
    attemptId?: string;
    lessonId?: string;
  }>;
};

type SupabaseServerClient = Awaited<
  ReturnType<typeof createClient>
>;


type RankingAttemptRow = {
  id: string;
  user_id: string;
  test_id: number;
  percentage: number | string;
  started_at: string;
  completed_at: string | null;
};

type BestAttempt = RankingAttemptRow & {
  percentageNumber: number;
  durationSeconds: number;
};

type UserTestStatisticsRpcRow = {
  test_id: number | string;
  title: string;
  attempts_count: number | string;
  completed_attempts: number | string;
  last_attempt_at: string | null;
  best_attempt_id: string | null;
  best_percentage: number | string;
  best_duration_seconds:
    | number
    | string
    | null;
  best_completed_at: string | null;
  test_rank: number | string;
  test_participants: number | string;
  is_passed: boolean;
};

type LinkedLessonRow = {
  id: number;
  category_id: number;
  order_number: number;
  is_published: boolean;
};

type QuestionRow = {
  id: number;
  question_text: string;
  image_path: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  order_number: number;
  question_type: "multiple_choice" | "written";
  block_id: number | null;
  part_label: string | null;
};

type QuestionBlockRow = {
  id: number;
  block_type: "written_parts" | "shared_options" | "self_study";
  stimulus_text: string | null;
  image_path: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  option_f: string | null;
  order_number: number;
  /** Mustaqil ish videoyechimi (db/37). Migratsiyadan oldin ustun yo'q */
  solution_video_url?: string | null;
};

type AnswerKeyRow = {
  question_id: number;
  correct_answer: string;
  accepted_answers: string[];
  solution_text: string | null;
  solution_video_url: string | null;
};

type UserAnswerRow = {
  question_id: number;
  selected_answer: string;
  is_correct: boolean;
};

type LessonContextRow = {
  id: number;
  category_id: number;
  order_number: number;
};

type LessonOrderRow = {
  id: number;
  order_number: number;
};

async function getActiveClient() {
  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_active !== true) {
    redirect("/");
  }

  return {
    supabase,
    userId: user.id,
    profileRole: profile.role,
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "Tugallanmagan";
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatPercentage(
  value: number | string,
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}

function formatDuration(
  startedAt: string | null,
  completedAt: string | null,
) {
  if (!startedAt || !completedAt) {
    return "—";
  }

  const milliseconds =
    new Date(completedAt).getTime() -
    new Date(startedAt).getTime();

  if (
    !Number.isFinite(milliseconds) ||
    milliseconds < 0
  ) {
    return "—";
  }

  const totalSeconds = Math.floor(
    milliseconds / 1000,
  );

  const hours = Math.floor(
    totalSeconds / 3600,
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );

  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) =>
      String(value).padStart(2, "0"),
    )
    .join(":");
}


function getDurationSeconds(
  startedAt: string | null,
  completedAt: string | null,
) {
  if (!startedAt || !completedAt) {
    return Number.MAX_SAFE_INTEGER;
  }

  const milliseconds =
    new Date(completedAt).getTime() -
    new Date(startedAt).getTime();

  if (
    !Number.isFinite(milliseconds) ||
    milliseconds < 0
  ) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.floor(milliseconds / 1000);
}

function formatDurationSeconds(
  totalSeconds: number,
) {
  if (
    !Number.isFinite(totalSeconds) ||
    totalSeconds === Number.MAX_SAFE_INTEGER
  ) {
    return "—";
  }

  const hours = Math.floor(
    totalSeconds / 3600,
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );

  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) =>
      String(value).padStart(2, "0"),
    )
    .join(":");
}

function enrichAttempt(
  attempt: RankingAttemptRow,
): BestAttempt {
  return {
    ...attempt,
    percentageNumber:
      Number(attempt.percentage) || 0,
    durationSeconds:
      getDurationSeconds(
        attempt.started_at,
        attempt.completed_at,
      ),
  };
}

/*
 * Reyting tartibi:
 * 1) yuqori foiz;
 * 2) teng foizda kamroq vaqt;
 * 3) teng boʼlsa oldinroq yakunlangan urinish.
 */
function compareBestAttempts(
  first: BestAttempt,
  second: BestAttempt,
) {
  const percentageDifference =
    second.percentageNumber -
    first.percentageNumber;

  if (percentageDifference !== 0) {
    return percentageDifference;
  }

  const durationDifference =
    first.durationSeconds -
    second.durationSeconds;

  if (durationDifference !== 0) {
    return durationDifference;
  }

  return (
    new Date(
      first.completed_at ??
        first.started_at,
    ).getTime() -
    new Date(
      second.completed_at ??
        second.started_at,
    ).getTime()
  );
}

function formatDifference(
  difference: number | null,
) {
  if (difference === null) {
    return "Birinçi tugallangan uriniş";
  }

  const absolute =
    Math.abs(difference);

  if (difference > 0) {
    return `Oldingi eng yaxşidan +${formatPercentage(
      absolute,
    )} foiz punkt`;
  }

  if (difference < 0) {
    return `Oldingi eng yaxşidan ${formatPercentage(
      absolute,
    )} foiz punkt past`;
  }

  return "Oldingi eng yaxşi natija bilan teng";
}

function MathValue({
  value,
}: {
  value: string | null | undefined;
}) {
  if (!value) {
    return null;
  }

  return <MathText content={value} />;
}

function getStandaloneOptions(
  question: QuestionRow,
) {
  return [
    ["A", question.option_a],
    ["B", question.option_b],
    ["C", question.option_c],
    ["D", question.option_d],
  ].filter(
    (
      option,
    ): option is [string, string] =>
      typeof option[1] === "string" &&
      option[1].trim().length > 0,
  );
}

function getSharedOptions(
  block: QuestionBlockRow,
) {
  return [
    ["A", block.option_a],
    ["B", block.option_b],
    ["C", block.option_c],
    ["D", block.option_d],
    ["E", block.option_e],
    ["F", block.option_f],
  ].filter(
    (
      option,
    ): option is [string, string] =>
      typeof option[1] === "string" &&
      option[1].trim().length > 0,
  );
}

async function createSignedUrlMap(
  supabase: SupabaseServerClient,
  rows: Array<{
    id: number;
    image_path: string | null;
  }>,
) {
  const result = new Map<number, string>();

  await Promise.all(
    rows.map(async (row) => {
      if (!row.image_path) {
        return;
      }

      const { data, error } = await supabase.storage
        .from(QUESTION_IMAGE_BUCKET)
        .createSignedUrl(
          row.image_path,
          SIGNED_URL_SECONDS,
        );

      if (!error && data?.signedUrl) {
        result.set(row.id, data.signedUrl);
      }
    }),
  );

  return result;
}

export default async function ResultViewPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const attemptId = String(
    params.attemptId ?? "",
  ).trim();

  const lessonIdText = String(
    params.lessonId ?? "",
  ).trim();

  const lessonId = lessonIdText
    ? Number(lessonIdText)
    : null;

  if (!attemptId) {
    notFound();
  }

  if (
    lessonId !== null &&
    (
      !Number.isInteger(lessonId) ||
      lessonId <= 0
    )
  ) {
    notFound();
  }

  const {
    supabase,
    userId,
    profileRole,
  } = await getActiveClient();

  const {
    data: attempt,
    error: attemptError,
  } = await supabase
    .from("attempts")
    .select(`
      id,
      user_id,
      test_id,
      score,
      total_questions,
      percentage,
      started_at,
      completed_at
    `)
    .eq("id", attemptId)
    .eq("user_id", userId)
    .single();

  if (attemptError || !attempt) {
    notFound();
  }

  let lessonNavigation:
    | {
        currentLessonId: number;
        categoryId: number;
        nextLessonId: number | null;
      }
    | null = null;

  /*
   * Test qaysi darslarga biriktirilgani `lesson_tests` jadvalida.
   * Bitta test bir nechta darsda ishlatilishi mumkin.
   */
  const { data: linkRows, error: linkError } = await supabase
    .from("lesson_tests")
    .select("lesson_id")
    .eq("test_id", attempt.test_id);

  if (linkError) {
    throw new Error(
      `Dars testi aniqlanmadi: ${linkError.message}`,
    );
  }

  const linkedLessonIds = (
    (linkRows ?? []) as Array<{ lesson_id: number }>
  ).map((row) => row.lesson_id);

  if (lessonId !== null) {
    const {
      data: lessonData,
      error: lessonError,
    } = await supabase
      .from("lessons")
      .select(`
        id,
        category_id,
        order_number
      `)
      .eq("id", lessonId)
      .in("id", linkedLessonIds.length > 0 ? linkedLessonIds : [-1])
      .eq("is_published", true)
      .maybeSingle();

    if (lessonError) {
      throw new Error(
        `Dars ma’lumoti yuklanmadi: ${lessonError.message}`,
      );
    }

    if (!lessonData) {
      notFound();
    }

    const lesson =
      lessonData as LessonContextRow;

    const {
      data: categoryLessonsData,
      error: categoryLessonsError,
    } = await supabase
      .from("lessons")
      .select("id, order_number")
      .eq(
        "category_id",
        lesson.category_id,
      )
      .eq("is_published", true)
      .order("order_number", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      });

    if (categoryLessonsError) {
      throw new Error(
        `Keyingi dars aniqlanmadi: ${categoryLessonsError.message}`,
      );
    }

    const categoryLessons =
      (categoryLessonsData ??
        []) as LessonOrderRow[];

    const lessonIndex =
      categoryLessons.findIndex(
        (item) =>
          item.id === lesson.id,
      );

    if (lessonIndex < 0) {
      notFound();
    }

    lessonNavigation = {
      currentLessonId: lesson.id,
      categoryId: lesson.category_id,
      nextLessonId:
        categoryLessons[
          lessonIndex + 1
        ]?.id ?? null,
    };
  }

  const [
    profileResult,
    testResult,
    questionsResult,
    blocksResult,
    userAnswersResult,
    linkedLessonsResult,
    rankingTestsResult,
    currentUserAttemptsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, is_active")
      .eq("id", attempt.user_id)
      .maybeSingle(),

    supabase
      .from("tests")
      .select(`title, is_published, ${TEST_TOPIC_SELECT}`)
      .eq("id", attempt.test_id)
      .maybeSingle(),

    supabase
      .from("questions")
      .select(`
        id,
        question_text,
        image_path,
        option_a,
        option_b,
        option_c,
        option_d,
        order_number,
        question_type,
        block_id,
        part_label
      `)
      .eq("test_id", attempt.test_id)
      .order("order_number", {
        ascending: true,
      }),

    supabase
      .from("question_blocks")
      /*
       * `*` — `solution_video_url` (db/37) migratsiya ishga
       * tushirilmagan bazada ham so'rov buzilmasin.
       */
      .select("*")
      .eq("test_id", attempt.test_id)
      .order("order_number", {
        ascending: true,
      }),

    supabase
      .from("user_answers")
      .select(`
        question_id,
        selected_answer,
        is_correct
      `)
      .eq("attempt_id", attemptId),

    supabase
      .from("lessons")
      .select(`
        id,
        category_id,
        order_number,
        is_published
      `)
      .in("id", linkedLessonIds.length > 0 ? linkedLessonIds : [-1])
      .order("order_number", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      }),

    supabase.rpc(
      "get_ranking_tests",
    ),

    supabase
      .from("attempts")
      .select(`
        id,
        user_id,
        test_id,
        percentage,
        started_at,
        completed_at
      `)
      .eq("user_id", userId)
      .eq("test_id", attempt.test_id)
      .order("started_at", {
        ascending: false,
      }),
  ]);

  if (profileResult.error) {
    throw new Error(
      "Öquvçi ma’lumotlari yuklanmadi.",
    );
  }

  if (testResult.error) {
    throw new Error(
      "Test ma’lumotlari yuklanmadi.",
    );
  }

  if (questionsResult.error) {
    throw new Error(
      "Savollar yuklanmadi.",
    );
  }

  if (blocksResult.error) {
    throw new Error(
      "Savol bloklari yuklanmadi.",
    );
  }

  if (userAnswersResult.error) {
    throw new Error(
      "Öquvçi javoblari yuklanmadi.",
    );
  }

  if (linkedLessonsResult.error) {
    throw new Error(
      `Dars testi aniqlanmadi: ${linkedLessonsResult.error.message}`,
    );
  }

  if (rankingTestsResult.error) {
    throw new Error(
      `Reyting testlari yuklanmadi: ${rankingTestsResult.error.message}`,
    );
  }

  if (currentUserAttemptsResult.error) {
    throw new Error(
      `Şaxsiy urinişlar yuklanmadi: ${currentUserAttemptsResult.error.message}`,
    );
  }

  const questions =
    (questionsResult.data ??
      []) as QuestionRow[];

  const blocks =
    (blocksResult.data ??
      []) as QuestionBlockRow[];

  const userAnswers =
    (userAnswersResult.data ??
      []) as UserAnswerRow[];

  const questionIds = questions.map(
    (question) => question.id,
  );

  let answerKeys: AnswerKeyRow[] = [];

  if (questionIds.length > 0) {
    const {
      data: answerKeysData,
      error: answerKeysError,
    } = await supabase
      .from("answer_keys")
      .select(`
        question_id,
        correct_answer,
        accepted_answers,
        solution_text,
        solution_video_url
      `)
      .in("question_id", questionIds);

    if (answerKeysError) {
      throw new Error(
        "Töğri javoblar yuklanmadi.",
      );
    }

    answerKeys =
      (answerKeysData ??
        []) as AnswerKeyRow[];
  }

  const userAnswerMap = new Map(
    userAnswers.map((answer) => [
      answer.question_id,
      answer,
    ]),
  );

  const answerKeyMap = new Map(
    answerKeys.map((answer) => [
      answer.question_id,
      answer,
    ]),
  );

  const questionImageUrlMap =
    await createSignedUrlMap(
      supabase,
      questions,
    );

  const blockImageUrlMap =
    await createSignedUrlMap(
      supabase,
      blocks,
    );

  const questionsByBlock = new Map<
    number,
    QuestionRow[]
  >();

  for (const question of questions) {
    if (question.block_id === null) {
      continue;
    }

    const blockQuestions =
      questionsByBlock.get(question.block_id) ??
      [];

    blockQuestions.push(question);

    questionsByBlock.set(
      question.block_id,
      blockQuestions,
    );
  }

  for (const blockQuestions of questionsByBlock.values()) {
    blockQuestions.sort(
      (a, b) =>
        a.order_number - b.order_number,
    );
  }

  const standaloneQuestions = questions
    .filter(
      (question) =>
        question.block_id === null,
    )
    .sort(
      (a, b) =>
        a.order_number -
        b.order_number,
    );

  const displayItems = [
    ...standaloneQuestions.map((question) => ({
      kind: "question" as const,
      order: question.order_number,
      question,
    })),
    ...blocks.map((block) => ({
      kind: "block" as const,
      order: block.order_number,
      block,
    })),
  ].sort((a, b) => a.order - b.order);

  const fullName =
    profileResult.data?.full_name ||
    "Ism kiritilmagan";

  const testTitle =
    testLabel(testResult.data) ||
    "Noma’lum test";

  const percentage =
    Number(attempt.percentage) || 0;

  const passedLessonTest =
    lessonNavigation !== null &&
    percentage >= 90;

  const correctCount = userAnswers.filter(
    (answer) =>
      answer.is_correct === true,
  ).length;

  const totalAnswerCount =
    userAnswers.length;

  const unansweredCount =
    userAnswers.filter(
      (answer) =>
        !answer.selected_answer?.trim(),
    ).length;

  const elapsedTime = formatDuration(
    attempt.started_at,
    attempt.completed_at,
  );


const linkedLessons =
  (linkedLessonsResult.data ??
    []) as LinkedLessonRow[];

const rankingTests =
  (rankingTestsResult.data ??
    []) as RankingTestRpcRow[];

const currentUserAttempts =
  (currentUserAttemptsResult.data ??
    []) as RankingAttemptRow[];

const isLessonTest =
  linkedLessons.length > 0;

/*
 * Uy vazifasi testlari qayta ishlanmaydi — "Qayta ishlash" tugmasi
 * o'rniga vazifalar sahifasiga yo'naltiramiz.
 *
 * db/06 hali ishga tushirilmagan bo'lsa RPC xato beradi; bunday
 * holatda oddiy test deb hisoblaymiz va sahifa ishlashda davom etadi.
 */
const groupOnlyResult = await supabase.rpc(
  "is_group_only_test",
  { p_test_id: attempt.test_id },
);

const isGroupOnlyTest =
  groupOnlyResult.data === true;

const isRankingTest =
  rankingTests.some(
    (rankingTest) =>
      Number(
        rankingTest.test_id,
      ) === attempt.test_id,
  );

let rankingStatistics:
  | UserTestStatisticsRpcRow
  | null = null;

if (
  isRankingTest &&
  profileRole !== "admin"
) {
  const {
    data: rankingStatisticsData,
    error: rankingStatisticsError,
  } = await supabase.rpc(
    "get_user_test_statistics",
    {
      p_user_id: null,
      p_test_id: attempt.test_id,
    },
  );

  if (rankingStatisticsError) {
    throw new Error(
      `Test reytingi yuklanmadi: ${rankingStatisticsError.message}`,
    );
  }

  rankingStatistics =
    (rankingStatisticsData ??
      [])[0] as
      | UserTestStatisticsRpcRow
      | undefined ??
    null;
}

const currentBestAttempt =
  rankingStatistics
    ?.best_attempt_id
    ? {
        id:
          rankingStatistics
            .best_attempt_id,
        percentage:
          rankingStatistics
            .best_percentage,
        durationSeconds:
          Number(
            rankingStatistics
              .best_duration_seconds,
          ) || 0,
      }
    : null;

const testRank =
  isRankingTest
    ? Number(
        rankingStatistics
          ?.test_rank,
      ) || 0
    : 0;

const testParticipants =
  isRankingTest
    ? Number(
        rankingStatistics
          ?.test_participants,
      ) || 0
    : 0;

const currentAttemptTime =
  new Date(
    attempt.completed_at ??
      attempt.started_at,
  ).getTime();

const previousCompletedAttempts =
  currentUserAttempts
    .filter((rankingAttempt) => {
      if (!rankingAttempt.completed_at) {
        return false;
      }

      const attemptTime =
        new Date(
          rankingAttempt.completed_at,
        ).getTime();

      return (
        attemptTime <
        currentAttemptTime
      );
    })
    .map(enrichAttempt)
    .sort(compareBestAttempts);

const previousBestAttempt =
  previousCompletedAttempts[0] ??
  null;

const differenceFromPreviousBest =
  attempt.completed_at
    ? previousBestAttempt
      ? percentage -
        previousBestAttempt
          .percentageNumber
      : null
    : null;

const isPersonalBest =
  Boolean(
    currentBestAttempt &&
      currentBestAttempt.id ===
        attempt.id,
  );

const retryLessonId =
  lessonNavigation
    ?.currentLessonId ??
  linkedLessons.find(
    (linkedLesson) =>
      linkedLesson.is_published ===
      true,
  )?.id ??
  null;

const retryHref =
  isGroupOnlyTest
    ? "/homework"
    : isLessonTest
      ? retryLessonId
        ? `/tests/take?testId=${attempt.test_id}&lessonId=${retryLessonId}`
        : "/lessons"
      : `/tests/take?testId=${attempt.test_id}`;

const retryLabel =
  isGroupOnlyTest
    ? "Uy vazifalarimga qaytiş"
    : "Testni qayta işlaş";

const lessonRetryLabel =
  isGroupOnlyTest
    ? "Uy vazifalarimga qaytiş"
    : retryLessonId
      ? "Dars testini qayta işlaş"
      : "Darslarga qaytiş";

const differenceLabel =
  attempt.completed_at
    ? formatDifference(
        differenceFromPreviousBest,
      )
    : "Uriniş tugallanmagan";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref={
          lessonNavigation
            ? `/lessons/view?lessonId=${lessonNavigation.currentLessonId}`
            : "/results"
        }
        backLabel={lessonNavigation ? "Darsga qaytiş" : "Natijalarim"}
        backNative={Boolean(lessonNavigation)}
        title="Test natijasi"
        subtitle={`${fullName} — ${testTitle}`}
        width="7xl"
      />

      <section className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10">
        {/*
          To'rt ko'rsatkich bitta qatorda.
          Ilgari 2×2 katta kartalar edi va telefonda vaqt qiymati
          ikki qatorga bo'linib ketardi ("00:01:3" / "0").
        */}
        <div className="grid grid-cols-4 divide-x divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-1.5 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs sm:normal-case sm:tracking-normal">
              Foiz
            </p>

            <p
              className={
                percentage >= 80
                  ? "mt-1 whitespace-nowrap text-lg font-bold text-emerald-600 sm:text-2xl"
                  : percentage >= 60
                    ? "mt-1 whitespace-nowrap text-lg font-bold text-mb-brand sm:text-2xl"
                    : "mt-1 whitespace-nowrap text-lg font-bold text-red-600 sm:text-2xl"
              }
            >
              {formatPercentage(attempt.percentage)}%
            </p>
          </div>

          <div className="px-1.5 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs sm:normal-case sm:tracking-normal">
              <span className="sm:hidden">Töğri</span>
              <span className="hidden sm:inline">Töğri javoblar</span>
            </p>

            <p className="mt-1 whitespace-nowrap text-lg font-bold text-emerald-600 sm:text-2xl">
              {correctCount}/{totalAnswerCount}
            </p>
          </div>

          <div className="px-1.5 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs sm:normal-case sm:tracking-normal">
              Ball
            </p>

            <p className="mt-1 whitespace-nowrap text-lg font-bold text-mb-brand sm:text-2xl">
              {attempt.score}
              <span className="text-slate-400">
                /{attempt.total_questions}
              </span>
            </p>
          </div>

          <div className="px-1.5 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs sm:normal-case sm:tracking-normal">
              <span className="sm:hidden">Vaqt</span>
              <span className="hidden sm:inline">Sarflangan vaqt</span>
            </p>

            <p className="mt-1 whitespace-nowrap font-mono text-[13px] font-bold tabular-nums text-mb-brand sm:text-xl">
              {elapsedTime}
            </p>
          </div>
        </div>


{isRankingTest ? (
  <section className="mt-6 overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">
    <div className="bg-mb-brand p-5 text-white sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
              Reyting testi
            </span>

            {isPersonalBest && (
              <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-bold text-emerald-950">
                Şaxsiy rekord
              </span>
            )}
          </div>

          <h2 className="mt-3 text-2xl font-bold">
            Reyting va şaxsiy natija
          </h2>

          <p className="mt-2 text-sm leading-6 text-blue-100">
            Har bir öquvçining eng yaxşi tugallangan
            urinişi hisoblanadi. Teng foizda tezroq
            tugatgan öquvçi yuqorida turadi.
          </p>
        </div>

        {profileRole === "admin" ? (
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm font-bold backdrop-blur">
            Admin hisobiga reyting berilmaydi
          </div>
        ) : testRank > 0 ? (
          <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-center backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-100">
              Test reytingi
            </p>

            <p className="mt-1 text-4xl font-bold">
              {testRank}/{testParticipants}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm font-bold backdrop-blur">
            Reyting uçun testni tugating
          </div>
        )}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
      <div className="rounded-2xl bg-blue-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-mb-brand">
          Eng yaxşi foiz
        </p>

        <p className="mt-2 text-2xl font-bold text-blue-950">
          {currentBestAttempt
            ? `${formatPercentage(
                currentBestAttempt.percentage,
              )}%`
            : "—"}
        </p>
      </div>

      <div className="rounded-2xl bg-blue-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-mb-brand">
          Eng yaxşi vaqt
        </p>

        <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-blue-950">
          {currentBestAttempt
            ? formatDurationSeconds(
                currentBestAttempt.durationSeconds,
              )
            : "—"}
        </p>
      </div>

      <div className="rounded-2xl bg-emerald-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
          Jami uriniş
        </p>

        <p className="mt-2 text-2xl font-bold text-emerald-950">
          {rankingStatistics
            ? Number(
                rankingStatistics
                  .attempts_count,
              ) || 0
            : currentUserAttempts.length}
        </p>
      </div>

      <div className="rounded-2xl bg-amber-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
          Oldingi natijaga farq
        </p>

        <p
          className={
            differenceFromPreviousBest === null
              ? "mt-2 text-sm font-bold leading-6 text-amber-950"
              : differenceFromPreviousBest > 0
                ? "mt-2 text-sm font-bold leading-6 text-emerald-700"
                : differenceFromPreviousBest < 0
                  ? "mt-2 text-sm font-bold leading-6 text-red-700"
                  : "mt-2 text-sm font-bold leading-6 text-amber-950"
          }
        >
          {differenceLabel}
        </p>
      </div>
    </div>

    <div className="flex flex-col gap-3 border-t border-slate-100 p-5 sm:flex-row sm:p-6">
      <Link
        href={retryHref}
        className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-mb-brand px-5 py-3 text-center font-bold text-white transition hover:bg-mb-brandDark"
      >
        {retryLabel}
      </Link>

      <Link
        href={`/leaderboard?testId=${attempt.test_id}`}
        className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-center font-bold text-blue-700 transition hover:bg-blue-100"
      >
        Test reytingini köriş
      </Link>
    </div>
  </section>
) : isLessonTest ? (
  <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm sm:p-6">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-mb-brand px-3 py-1 text-xs font-bold text-white">
            Dars testi
          </span>

          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
            Reytingga kirmaydi
          </span>
        </div>

        <h2 className="mt-3 text-xl font-bold text-blue-950 sm:text-2xl">
          Bu natija faqat dars progressingiz uçun
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-800">
          Darsga biriktirilgan testlar umumiy reytingga
          va testlar reytingiga qöşilmaydi.
        </p>
      </div>

      <Link
        href={retryHref}
        className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-mb-brand px-6 py-3 text-center font-bold text-white transition hover:bg-mb-brandDark"
      >
        {lessonRetryLabel}
      </Link>
    </div>
  </section>
) : (
  <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-100 p-5 shadow-sm sm:p-6">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div>
        <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-bold text-white">
          Arxiv testi
        </span>

        <h2 className="mt-3 text-xl font-bold text-slate-950">
          Bu test reytingga kirmaydi
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Test hozir Testlar bölimida faol emas yoki
          darsga biriktirilgan.
        </p>
      </div>
    </div>
  </section>
)}

        {lessonNavigation && (
          <section
            className={
              passedLessonTest
                ? "mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6"
                : "mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6"
            }
          >
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p
                  className={
                    passedLessonTest
                      ? "text-xs font-bold uppercase tracking-[0.16em] text-emerald-700"
                      : "text-xs font-bold uppercase tracking-[0.16em] text-amber-700"
                  }
                >
                  Dars testi
                </p>

                <h2
                  className={
                    passedLessonTest
                      ? "mt-2 text-xl font-bold text-emerald-950 sm:text-2xl"
                      : "mt-2 text-xl font-bold text-amber-950 sm:text-2xl"
                  }
                >
                  {passedLessonTest
                    ? "Tabriklaymiz, testdan ötdingiz!"
                    : "Keyingi dars hali oçilmadi"}
                </h2>

                <p
                  className={
                    passedLessonTest
                      ? "mt-2 text-sm leading-6 text-emerald-800"
                      : "mt-2 text-sm leading-6 text-amber-800"
                  }
                >
                  {passedLessonTest
                    ? `Natijangiz ${formatPercentage(
                        percentage,
                      )}%. Keyingi darsga ötişingiz mumkin.`
                    : `Natijangiz ${formatPercentage(
                        percentage,
                      )}%. Keyingi dars uçun kamida 90% kerak.`}
                </p>
              </div>

              {passedLessonTest ? (
                lessonNavigation.nextLessonId ? (
                  <a
                    href={`/lessons/view?lessonId=${lessonNavigation.nextLessonId}`}
                    className="gap-1.5 inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-center font-bold text-white transition hover:bg-emerald-700"
                  >
                    Keyingi dars
                    <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
                  </a>
                ) : (
                  <a
                    href={`/lessons/category?categoryId=${lessonNavigation.categoryId}`}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-center font-bold text-white transition hover:bg-emerald-700"
                  >
                    Darslar röyxatiga qaytiş
                  </a>
                )
              ) : (
                <a
                  href={`/lessons/view?lessonId=${lessonNavigation.currentLessonId}`}
                  className="gap-1.5 inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600 px-6 py-3 text-center font-bold text-white transition hover:bg-amber-700"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
                  Darsga qaytiş
                </a>
              )}
            </div>
          </section>
        )}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4 text-sm sm:gap-5 lg:grid-cols-5">
            <div>
              <p className="text-slate-500">
                Öquvçi
              </p>

              <p className="mt-1 font-semibold">
                {fullName}
              </p>
            </div>

            <div>
              <p className="text-slate-500">
                Test
              </p>

              <p className="mt-1 font-semibold">
                {testTitle}
              </p>
            </div>

            <div>
              <p className="text-slate-500">
                Boşlangan
              </p>

              <p className="mt-1 font-semibold">
                {formatDate(
                  attempt.started_at,
                )}
              </p>
            </div>

            <div>
              <p className="text-slate-500">
                Tugallangan
              </p>

              <p className="mt-1 font-semibold">
                {formatDate(
                  attempt.completed_at,
                )}
              </p>
            </div>

            <div>
              <p className="text-slate-500">
                Javobsiz
              </p>

              <p className="mt-1 font-semibold">
                {unansweredCount} ta
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-2xl font-bold">
            Savollar tahlili
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Öquvçi javobi, töğri javob va yeçimlar
          </p>
        </div>

        <div className="mt-5 space-y-6">
          {displayItems.map((item) => {
            if (item.kind === "question") {
              const question = item.question;

              const userAnswer =
                userAnswerMap.get(question.id);

              const answerKey =
                answerKeyMap.get(question.id);

              const selectedAnswer =
                userAnswer?.selected_answer ??
                "";

              const correctAnswer =
                answerKey?.correct_answer ??
                "";

              const isCorrect =
                userAnswer?.is_correct ??
                false;

              const imageUrl =
                questionImageUrlMap.get(
                  question.id,
                );

              return (
                <article
                  key={`question-${question.id}`}
                  className={
                    isCorrect
                      ? "rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6"
                      : "rounded-3xl border border-red-200 bg-white p-5 shadow-sm sm:p-6"
                  }
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="shrink-0 text-lg font-bold">
                        {question.order_number}.
                      </span>

                      <div className="min-w-0 text-lg font-semibold leading-8">
                        <MathValue
                          value={
                            question.question_text
                          }
                        />
                      </div>
                    </div>

                    <span
                      className={
                        isCorrect
                          ? "shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                          : selectedAnswer
                            ? "shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                            : "shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                      }
                    >
                      {isCorrect
                        ? "Töğri"
                        : selectedAnswer
                          ? "Notöğri"
                          : "Javob berilmagan"}
                    </span>
                  </div>

                  {imageUrl && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={imageUrl}
                        alt={`${question.order_number}-savol çizmasi`}
                        className="mx-auto max-h-[520px] w-auto max-w-full rounded-xl object-contain"
                      />
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {getStandaloneOptions(
                      question,
                    ).map(
                      ([letter, optionText]) => {
                        const isSelected =
                          selectedAnswer ===
                          letter;

                        const isRightAnswer =
                          correctAnswer ===
                          letter;

                        let optionClass =
                          "rounded-xl border border-slate-200 bg-slate-50 px-4 py-4";

                        if (
                          isSelected &&
                          isRightAnswer
                        ) {
                          optionClass =
                            "rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-4 text-emerald-800";
                        } else if (
                          isSelected &&
                          !isRightAnswer
                        ) {
                          optionClass =
                            "rounded-xl border border-red-400 bg-red-50 px-4 py-4 text-red-800";
                        } else if (
                          isRightAnswer
                        ) {
                          optionClass =
                            "rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-emerald-800";
                        }

                        return (
                          <div
                            key={letter}
                            className={optionClass}
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="shrink-0 font-bold">
                                {letter})
                              </span>

                              <div className="min-w-0 flex-1">
                                <MathValue
                                  value={
                                    optionText
                                  }
                                />
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {isSelected && (
                                <span className="text-xs font-semibold">
                                  Öquvçi tanlagan
                                </span>
                              )}

                              {isRightAnswer && (
                                <span className="text-xs font-semibold">
                                  Töğri javob
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>

                  {answerKey?.solution_text && (
                    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                      <p className="mb-2 text-sm font-bold">
                        Yeçim
                      </p>

                      <MathValue
                        value={
                          answerKey.solution_text
                        }
                      />
                    </div>
                  )}

                  {answerKey?.solution_video_url && (
                    <div className="mt-6">
                      <h3 className="mb-3 text-lg font-bold">
                        Videoyeçim
                      </h3>

                      <YouTubeEmbed
                        url={
                          answerKey.solution_video_url
                        }
                        title={`${question.order_number}-savol videoyeçimi`}
                      />
                    </div>
                  )}
                </article>
              );
            }

            const block = item.block;

            if (block.block_type === "self_study") {
              const selfImageUrl =
                blockImageUrlMap.get(block.id);

              return (
                <article
                  key={`block-${block.id}`}
                  className="rounded-3xl border border-dashed border-slate-300 bg-white p-5 shadow-sm sm:p-6"
                >
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Mustaqil iş · ball berilmaydi
                  </span>

                  <h3 className="mt-3 text-lg font-bold">
                    {block.order_number}-savol
                  </h3>

                  {block.stimulus_text && (
                    <div className="mt-5 text-base leading-8 sm:text-lg">
                      <MathValue value={block.stimulus_text} />
                    </div>
                  )}

                  {selfImageUrl && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={selfImageUrl}
                        alt={`${block.order_number}-savol çizmasi`}
                        className="mx-auto max-h-[560px] w-auto max-w-full rounded-xl object-contain"
                      />
                    </div>
                  )}

                  {block.solution_video_url ? (
                    <div className="mt-6">
                      <h4 className="mb-3 font-bold">Videoyeçim</h4>

                      <YouTubeEmbed
                        url={block.solution_video_url}
                        title={`${block.order_number}-savol videoyeçimi`}
                      />
                    </div>
                  ) : (
                    <p className="mt-5 text-sm text-slate-500">
                      Videoyeçim hali qöşilmagan.
                    </p>
                  )}
                </article>
              );
            }

            const blockQuestions =
              questionsByBlock.get(block.id) ??
              [];

            const isWritten =
              block.block_type ===
              "written_parts";

            const imageUrl =
              blockImageUrlMap.get(block.id);

            return (
              <article
                key={`block-${block.id}`}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className={
                        isWritten
                          ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
                          : "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                      }
                    >
                      {isWritten
                        ? "a)–b) yozma savol"
                        : "Umumiy A–F variantli savollar"}
                    </span>

                    <h3 className="mt-3 text-lg font-bold">
                      {isWritten
                        ? `${block.order_number}-savol`
                        : `${block.order_number}–${block.order_number + 2}-savollar`}
                    </h3>
                  </div>
                </div>

                {block.stimulus_text && (
                  <div className="mt-5 text-base leading-8 sm:text-lg">
                    <MathValue
                      value={
                        block.stimulus_text
                      }
                    />
                  </div>
                )}

                {imageUrl && (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={imageUrl}
                      alt="Umumiy savol çizmasi"
                      className="mx-auto max-h-[560px] w-auto max-w-full rounded-xl object-contain"
                    />
                  </div>
                )}

                {!isWritten && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {getSharedOptions(
                      block,
                    ).map(
                      ([letter, optionText]) => (
                        <div
                          key={letter}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
                        >
                          <div className="flex items-start gap-3">
                            <span className="shrink-0 font-bold">
                              {letter})
                            </span>

                            <div className="min-w-0">
                              <MathValue
                                value={
                                  optionText
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}

                <div className="mt-6 space-y-5">
                  {blockQuestions.map(
                    (question, index) => {
                      const userAnswer =
                        userAnswerMap.get(
                          question.id,
                        );

                      const answerKey =
                        answerKeyMap.get(
                          question.id,
                        );

                      const selectedAnswer =
                        userAnswer?.selected_answer ??
                        "";

                      const correctAnswer =
                        answerKey?.correct_answer ??
                        "";

                      const isCorrect =
                        userAnswer?.is_correct ??
                        false;

                      const displayLabel =
                        isWritten
                          ? `${question.part_label ?? ""})`
                          : `${block.order_number + index}.`;

                      return (
                        <section
                          key={question.id}
                          className={
                            isCorrect
                              ? "rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5"
                              : "rounded-2xl border border-red-200 bg-red-50/30 p-5"
                          }
                        >
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="shrink-0 font-bold text-blue-700">
                                {displayLabel}
                              </span>

                              <div className="min-w-0 font-semibold leading-7">
                                <MathValue
                                  value={
                                    question.question_text
                                  }
                                />
                              </div>
                            </div>

                            <span
                              className={
                                isCorrect
                                  ? "shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                                  : selectedAnswer
                                    ? "shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                                    : "shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                              }
                            >
                              {isCorrect
                                ? "Töğri"
                                : selectedAnswer
                                  ? "Notöğri"
                                  : "Javob berilmagan"}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Öquvçi javobi
                              </p>

                              <div className="mt-2 font-semibold">
                                {selectedAnswer ? (
                                  <MathValue
                                    value={
                                      selectedAnswer
                                    }
                                  />
                                ) : (
                                  <span className="text-slate-400">
                                    Javob berilmagan
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                Töğri javob
                              </p>

                              <div className="mt-2 font-semibold text-emerald-900">
                                <MathValue
                                  value={
                                    correctAnswer
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {isWritten &&
                            answerKey &&
                            answerKey.accepted_answers.length >
                              0 && (
                              <div className="mt-3 text-sm text-slate-500">
                                Qabul qilinadigan boşqa javoblar:
                                <div className="mt-1">
                                  <MathValue
                                    value={answerKey.accepted_answers.join(
                                      ", ",
                                    )}
                                  />
                                </div>
                              </div>
                            )}

                          {answerKey?.solution_text && (
                            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                              <p className="mb-2 text-sm font-bold">
                                Yeçim
                              </p>

                              <MathValue
                                value={
                                  answerKey.solution_text
                                }
                              />
                            </div>
                          )}

                          {answerKey?.solution_video_url && (
                            <div className="mt-5">
                              <h4 className="mb-3 font-bold">
                                Videoyeçim
                              </h4>

                              <YouTubeEmbed
                                url={
                                  answerKey.solution_video_url
                                }
                                title={`${displayLabel} savol videoyeçimi`}
                              />
                            </div>
                          )}
                        </section>
                      );
                    },
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
