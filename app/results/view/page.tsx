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
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import PageHeader from "@/components/ui/page-header";
import ProgressRing from "@/components/ui/progress-ring";
import { Tag } from "@/components/ui/row";
import { btnGhost, btnPrimary } from "@/lib/ui";

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

  // Savollar xaritasi: har bir savol bitta katak — bosilsa öşa savolga ötadi.
  const questionMap = displayItems.flatMap((item) => {
    const stateOf = (questionId: number) => {
      const answer = userAnswerMap.get(questionId);

      if (answer?.is_correct) return "ok" as const;

      return answer?.selected_answer ? ("bad" as const) : ("skip" as const);
    };

    if (item.kind === "question") {
      return [
        {
          anchor: `q-${item.question.id}`,
          label: String(item.question.order_number),
          state: stateOf(item.question.id),
        },
      ];
    }

    if (item.block.block_type === "self_study") return [];

    const isWrittenBlock = item.block.block_type === "written_parts";

    return (questionsByBlock.get(item.block.id) ?? []).map(
      (question, index) => ({
        anchor: `q-${question.id}`,
        label: isWrittenBlock
          ? `${item.block.order_number}${question.part_label ?? ""}`
          : String(item.block.order_number + index),
        state: stateOf(question.id),
      }),
    );
  });

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
        glyph="results"
        title={testTitle}
        subtitle={`Test natijasi · ${fullName}`}
        width="4xl"
      />

      <section className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
        {/*
          Natija kartasi: halqa — foiz, yonida bitta xulosa gapi va
          uçta son. Ilgari tört katak, kök taxta va yana tört katak
          ketma-ket kelardi — asosiy raqam ular orasida yöqolardi.
        */}
        <div className="rounded-2xl border border-mb-line bg-white p-4 sm:p-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <ProgressRing
              value={percentage}
              size={104}
              stroke={10}
              tone={
                percentage >= 90
                  ? "success"
                  : percentage >= 60
                    ? "brand"
                    : "danger"
              }
            >
              <span className="num text-2xl font-extrabold text-mb-ink">
                {formatPercentage(attempt.percentage)}%
              </span>
            </ProgressRing>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                <Tag tone="neutral">
                  {isRankingTest
                    ? "Reyting testi"
                    : isLessonTest
                      ? "Dars testi"
                      : "Arxiv testi"}
                </Tag>

                {isRankingTest && isPersonalBest && (
                  <Tag tone="accent">Şaxsiy rekord</Tag>
                )}
              </div>

              <h2 className="mt-2 text-xl font-extrabold leading-snug text-mb-ink sm:text-2xl">
                {percentage >= 90
                  ? "Zör natija!"
                  : percentage >= 60
                    ? "Yaxşi, yana ozgina qoldi"
                    : "Xatolarni körib, qayta uriniş kerak"}
              </h2>

              <p className="num mt-1 text-sm leading-5 text-mb-muted">
                {totalAnswerCount} tadan {correctCount} tasi töğri
                {unansweredCount > 0
                  ? ` · ${unansweredCount} ta javobsiz`
                  : ""}
              </p>
            </div>
          </div>

          <dl className="num mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 px-2 py-2.5">
              <dt className="text-xs font-semibold text-mb-muted">Töğri</dt>
              <dd className="mt-0.5 text-xl font-extrabold text-vp-success">
                {correctCount}
                <span className="text-sm font-semibold text-mb-muted">
                  /{totalAnswerCount}
                </span>
              </dd>
            </div>

            <div className="rounded-xl bg-slate-50 px-2 py-2.5">
              <dt className="text-xs font-semibold text-mb-muted">Ball</dt>
              <dd className="mt-0.5 text-xl font-extrabold text-mb-ink">
                {attempt.score}
                <span className="text-sm font-semibold text-mb-muted">
                  /{attempt.total_questions}
                </span>
              </dd>
            </div>

            <div className="rounded-xl bg-slate-50 px-2 py-2.5">
              <dt className="text-xs font-semibold text-mb-muted">Vaqt</dt>
              <dd className="mt-0.5 whitespace-nowrap text-xl font-extrabold text-mb-ink">
                {elapsedTime}
              </dd>
            </div>
          </dl>

          <p className="num mt-3 text-[13px] text-mb-muted">
            {formatDate(attempt.completed_at ?? attempt.started_at)}
          </p>
        </div>

        {isRankingTest ? (
          <section className="spotlight mt-3 rounded-2xl p-4 sm:p-6">
            <div className="relative">
              <p className="eyebrow !text-white/80">Bu testdagi örningiz</p>

              {profileRole === "admin" ? (
                <p className="mt-1 text-lg font-bold">
                  Admin hisobiga reyting berilmaydi
                </p>
              ) : testRank > 0 ? (
                <p className="num mt-1 text-4xl font-extrabold leading-none">
                  {testRank}
                  <span className="text-xl font-bold">-örin</span>
                  <span className="ml-2 text-sm font-semibold text-white/80">
                    {testParticipants} kişidan
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-lg font-bold">
                  Reyting uçun testni tugating
                </p>
              )}

              <dl className="num mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/10 px-2 py-2.5">
                  <dt className="text-xs font-semibold text-white/80">
                    Eng yaxşi
                  </dt>
                  <dd className="mt-0.5 text-lg font-extrabold">
                    {currentBestAttempt
                      ? `${formatPercentage(currentBestAttempt.percentage)}%`
                      : "—"}
                  </dd>
                </div>

                <div className="rounded-xl bg-white/10 px-2 py-2.5">
                  <dt className="text-xs font-semibold text-white/80">
                    Eng yaxşi vaqt
                  </dt>
                  <dd className="mt-0.5 whitespace-nowrap text-lg font-extrabold">
                    {currentBestAttempt
                      ? formatDurationSeconds(
                          currentBestAttempt.durationSeconds,
                        )
                      : "—"}
                  </dd>
                </div>

                <div className="rounded-xl bg-white/10 px-2 py-2.5">
                  <dt className="text-xs font-semibold text-white/80">
                    Uriniş
                  </dt>
                  <dd className="mt-0.5 text-lg font-extrabold">
                    {rankingStatistics
                      ? Number(rankingStatistics.attempts_count) || 0
                      : currentUserAttempts.length}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-sm font-semibold text-white/90">
                {differenceLabel}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href={retryHref}
                  className="press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-center text-sm font-bold text-blue-700 shadow-[inset_0_-3px_0_rgb(3_22_80/0.14)]"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {retryLabel}
                </Link>

                <Link
                  href={`/leaderboard?testId=${attempt.test_id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white/10 px-4 text-center text-sm font-bold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/20"
                >
                  Test reytingi
                </Link>
              </div>
            </div>
          </section>
        ) : isLessonTest && !lessonNavigation ? (
          <section className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-mb-line bg-white p-4">
            <p className="min-w-0 flex-1 text-sm leading-5 text-mb-muted">
              Dars testlari faqat dars progressingiz uçun — reytingga
              qöşilmaydi.
            </p>

            <Link href={retryHref} className={btnGhost}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {lessonRetryLabel}
            </Link>
          </section>
        ) : !isLessonTest ? (
          <p className="mt-3 rounded-2xl border border-mb-line bg-white px-4 py-3 text-sm leading-5 text-mb-muted">
            Bu test hozir Testlar bölimida faol emas, şuning uçun reytingga
            kirmaydi.
          </p>
        ) : null}

        {/* Dars testi: keyingi dars oçildimi */}
        {lessonNavigation && (
          <section
            className={
              passedLessonTest
                ? "mt-3 rounded-2xl border border-vp-success-line bg-vp-success-soft p-4 sm:p-5"
                : "mt-3 rounded-2xl border border-vp-warning-line bg-vp-warning-soft p-4 sm:p-5"
            }
          >
            <h2 className="text-lg font-extrabold text-vp-ink">
              {passedLessonTest
                ? "Keyingi dars oçildi"
                : "Keyingi dars hali oçilmadi"}
            </h2>

            <p className="num mt-1 text-sm leading-5 text-vp-ink/80">
              {passedLessonTest
                ? `Natijangiz ${formatPercentage(percentage)}% — darsni muvaffaqiyatli ötdingiz.`
                : `Natijangiz ${formatPercentage(percentage)}%. Keyingi dars uçun kamida 90% kerak.`}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {passedLessonTest ? (
                lessonNavigation.nextLessonId ? (
                  <a
                    href={`/lessons/view?lessonId=${lessonNavigation.nextLessonId}`}
                    className={btnPrimary}
                  >
                    Keyingi dars
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <a
                    href={`/lessons/category?categoryId=${lessonNavigation.categoryId}`}
                    className={btnPrimary}
                  >
                    Darslar röyxatiga qaytiş
                  </a>
                )
              ) : (
                <>
                  <Link href={retryHref} className={btnPrimary}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {lessonRetryLabel}
                  </Link>

                  <a
                    href={`/lessons/view?lessonId=${lessonNavigation.currentLessonId}`}
                    className={btnGhost}
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Darsga qaytiş
                  </a>
                </>
              )}
            </div>
          </section>
        )}

        <div className="mt-8">
          <h2 className="eyebrow">Savollar tahlili</h2>

          <p className="mt-1 text-sm text-mb-muted">
            Sizning javobingiz, töğri javob va yeçim
          </p>

          {questionMap.length > 1 && (
            <nav
              aria-label="Savollar xaritasi"
              className="num mt-4 flex flex-wrap gap-1.5"
            >
              {questionMap.map((entry) => (
                <a
                  key={entry.anchor}
                  href={`#${entry.anchor}`}
                  aria-label={`${entry.label}-savol: ${
                    entry.state === "ok"
                      ? "töğri"
                      : entry.state === "bad"
                        ? "notöğri"
                        : "javob berilmagan"
                  }`}
                  className={
                    entry.state === "ok"
                      ? "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-vp-success-line bg-vp-success-soft px-1.5 text-sm font-bold text-vp-success"
                      : entry.state === "bad"
                        ? "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-vp-danger-line bg-vp-danger-soft px-1.5 text-sm font-bold text-vp-danger"
                        : "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-dashed border-vp-line bg-vp-surface px-1.5 text-sm font-bold text-vp-muted"
                  }
                >
                  {entry.label}
                </a>
              ))}
            </nav>
          )}
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
                  id={`q-${question.id}`}
                  className={
                    isCorrect
                      ? "scroll-mt-20 rounded-2xl border border-emerald-200 bg-white p-5 sm:p-6"
                      : "scroll-mt-20 rounded-2xl border border-red-200 bg-white p-5 sm:p-6"
                  }
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="num shrink-0 text-lg font-extrabold text-mb-muted">
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
                  className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 sm:p-6"
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
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className={
                        isWritten
                          ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
                          : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
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
                          id={`q-${question.id}`}
                          className={
                            isCorrect
                              ? "scroll-mt-20 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5"
                              : "scroll-mt-20 rounded-xl border border-red-200 bg-red-50/30 p-4 sm:p-5"
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
