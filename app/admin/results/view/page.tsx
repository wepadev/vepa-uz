import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import MathText from "@/components/math-text";
import AnswerCorrection from "@/components/admin/answer-correction";
import PrintResultButton from "@/components/admin/print-result-button";
import YouTubeEmbed from "@/components/youtube-embed";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { TEST_TOPIC_SELECT, testLabel } from "@/lib/test-label";
import BackLink from "@/components/ui/back-link";

export const dynamic = "force-dynamic";

/*
 * Javobni qo'lda to'g'rilash.
 *
 * DIQQAT: bu yerda ataylab createClient() ishlatiladi, createAdminClient()
 * emas. Chaqirilayotgan funksiyalar ichida public.is_teacher() tekshiruvi
 * bor, u esa auth.uid() ga tayanadi. Xizmat kaliti bilan auth.uid() bo'sh
 * bo'ladi va funksiya "faqat o'qituvchi uchun" deb rad etadi.
 */
async function setAnswerCorrectness(formData: FormData) {
  "use server";

  const attemptId = String(formData.get("attemptId") ?? "");
  const questionId = Number(formData.get("questionId"));
  const isCorrect = formData.get("isCorrect") === "1";

  const supabase = await requireAdmin();

  if (!attemptId || !Number.isInteger(questionId)) {
    throw new Error("Ma’lumot notöğri.");
  }

  const { error } = await supabase.rpc("set_answer_correctness", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_is_correct: isCorrect,
  });

  if (error) {
    throw new Error(`Baho özgartirilmadi: ${error.message}`);
  }

  revalidatePath("/admin/results/view");
  revalidatePath("/admin/assignments/view");
}

async function addAnswerToKey(formData: FormData) {
  "use server";

  const questionId = Number(formData.get("questionId"));
  const answer = String(formData.get("answer") ?? "").trim();
  const attemptId = String(formData.get("attemptId") ?? "");

  const supabase = await requireAdmin();

  if (!Number.isInteger(questionId) || !answer) {
    throw new Error("Ma’lumot notöğri.");
  }

  const { error } = await supabase.rpc("add_accepted_answer_smart", {
    p_question_id: questionId,
    p_answer: answer,
  });

  if (error) {
    throw new Error(`Kalitga qöşilmadi: ${error.message}`);
  }

  // Shu o'quvchining bahosini ham darhol to'g'rilaymiz
  if (attemptId) {
    await supabase.rpc("set_answer_correctness", {
      p_attempt_id: attemptId,
      p_question_id: questionId,
      p_is_correct: true,
    });
  }

  revalidatePath("/admin/results/view");
  revalidatePath("/admin/assignments/view");
}

const QUESTION_IMAGE_BUCKET = "question-images";
const SIGNED_URL_SECONDS = 60 * 60 * 6;

type PageProps = {
  searchParams: Promise<{
    attemptId?: string;
  }>;
};

type AdminSupabaseClient = ReturnType<
  typeof createAdminClient
>;

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
};

type AnswerKeyRow = {
  question_id: number;
  correct_answer: string;
  accepted_answers: string[] | null;
  solution_text: string | null;
  solution_video_url: string | null;
};

type UserAnswerRow = {
  question_id: number;
  selected_answer: string;
  is_correct: boolean;
};

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
    timeZone: "Asia/Tashkent",
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
  supabase: AdminSupabaseClient,
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

export default async function AdminResultViewPage({
  searchParams,
}: PageProps) {
  await requireAdmin();

  const params = await searchParams;

  const attemptId = String(
    params.attemptId ?? "",
  ).trim();

  if (!attemptId) {
    notFound();
  }

  const adminSupabase = createAdminClient();

  const {
    data: attempt,
    error: attemptError,
  } = await adminSupabase
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
    .single();

  if (attemptError || !attempt) {
    notFound();
  }

  const [
    profileResult,
    testResult,
    questionsResult,
    blocksResult,
    userAnswersResult,
    authUserResult,
  ] = await Promise.all([
    adminSupabase
      .from("profiles")
      .select("full_name, is_active")
      .eq("id", attempt.user_id)
      .maybeSingle(),

    adminSupabase
      .from("tests")
      .select(`title, ${TEST_TOPIC_SELECT}`)
      .eq("id", attempt.test_id)
      .maybeSingle(),

    adminSupabase
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

    adminSupabase
      .from("question_blocks")
      .select(`
        id,
        block_type,
        stimulus_text,
        image_path,
        option_a,
        option_b,
        option_c,
        option_d,
        option_e,
        option_f,
        order_number
      `)
      .eq("test_id", attempt.test_id)
      .order("order_number", {
        ascending: true,
      }),

    adminSupabase
      .from("user_answers")
      .select(`
        question_id,
        selected_answer,
        is_correct
      `)
      .eq("attempt_id", attemptId),

    adminSupabase.auth.admin.getUserById(
      attempt.user_id,
    ),
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
    } = await adminSupabase
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
      adminSupabase,
      questions,
    );

  const blockImageUrlMap =
    await createSignedUrlMap(
      adminSupabase,
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
    profileResult.data?.full_name?.trim() ||
    "Ism kiritilmagan";

  const email =
    authUserResult.data.user?.email ||
    "Email topilmadi";

  const userIsActive =
    profileResult.data?.is_active ?? false;

  const testTitle =
    testLabel(testResult.data) ||
    "Noma’lum test";

  const percentage =
    Number(attempt.percentage) || 0;

  const answeredAnswers =
    userAnswers.filter(
      (answer) =>
        Boolean(
          answer.selected_answer?.trim(),
        ),
    );

  const answeredCount =
    answeredAnswers.length;

  const correctCount =
    answeredAnswers.filter(
      (answer) =>
        answer.is_correct === true,
    ).length;

  const wrongCount =
    answeredAnswers.filter(
      (answer) =>
        answer.is_correct !== true,
    ).length;

  /*
   * DIQQAT: attempts.total_questions ustunida savollar soni emas,
   * MAKSIMAL BALL turadi (masalan 15 ta savol × 2 ball = 30).
   * Ilgari shu qiymat savollar soni deb olinardi va "Javobsiz"
   * 30 − 15 = 15 bo'lib chiqardi — hamma savolga javob berilgan
   * bo'lsa ham.
   *
   * Savollar sonini testning o'zidan olamiz.
   */
  const totalQuestionCount =
    questions.length || userAnswers.length;

  const unansweredCount =
    Math.max(
      totalQuestionCount - answeredCount,
      0,
    );

  const completionStatus =
    attempt.completed_at
      ? "Tugallangan"
      : "Jarayonda";

  const elapsedTime = formatDuration(
    attempt.started_at,
    attempt.completed_at,
  );

  return (
    <main className="admin-result-print-page min-h-screen bg-slate-50 text-slate-900 print:bg-white">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          html,
          body {
            background: #ffffff !important;
          }

          .sticky:has(
            nav[aria-label="Administrator menyusi"]
          ) {
            display: none !important;
          }

          .admin-result-print-page .print-hidden {
            display: none !important;
          }

          .admin-result-print-page article,
          .admin-result-print-page .print-card,
          .admin-result-print-page section section {
            break-inside: avoid;
            box-shadow: none !important;
          }

          .admin-result-print-page iframe {
            display: none !important;
          }
        }
      `}</style>

      <header className="border-b border-slate-200 bg-white print:border-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <BackLink
                href="/admin/results"
                label="Natijalar"
                className="mb-2 print-hidden"
              />

              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                Batafsil test natijasi
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {fullName} — {testTitle}
              </p>
            </div>

            <PrintResultButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:px-0 print:py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <article className="print-card rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-bold text-slate-500">
              Foiz
            </p>

            <p
              className={
                percentage >= 80
                  ? "mt-2 text-3xl font-bold text-emerald-600"
                  : percentage >= 60
                    ? "mt-2 text-3xl font-bold text-mb-brand"
                    : "mt-2 text-3xl font-bold text-red-600"
              }
            >
              {formatPercentage(
                attempt.percentage,
              )}
              %
            </p>
          </article>

          <article className="print-card rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
            <p className="text-sm font-bold text-emerald-700">
              Töğri
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {correctCount}
            </p>
          </article>

          <article className="print-card rounded-2xl border border-red-200 bg-red-50/60 p-5 shadow-sm">
            <p className="text-sm font-bold text-red-700">
              Notöğri
            </p>

            <p className="mt-2 text-3xl font-bold text-red-700">
              {wrongCount}
            </p>
          </article>

          <article className="print-card rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
            <p className="text-sm font-bold text-amber-700">
              Javobsiz
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-700">
              {unansweredCount}
            </p>
          </article>

          <article className="print-card rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
            <p className="text-sm font-bold text-blue-700">
              Ball
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-700">
              {attempt.score}
              <span className="text-lg text-blue-400">
                {" "}
                / {attempt.total_questions}
              </span>
            </p>
          </article>

          <article className="print-card rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
            <p className="text-sm font-bold text-blue-700">
              Vaqt
            </p>

            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-blue-700">
              {elapsedTime}
            </p>
          </article>
        </div>

        <div className="print-card mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <p className="font-semibold text-slate-500">
                Öquvçi
              </p>

              <p className="mt-1 font-bold text-slate-950">
                {fullName}
              </p>

              <span
                className={
                  userIsActive
                    ? "mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700"
                    : "mt-2 inline-flex rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700"
                }
              >
                {userIsActive
                  ? "Faol akkaunt"
                  : "Faol emas"}
              </span>
            </div>

            <div>
              <p className="font-semibold text-slate-500">
                Email
              </p>

              <p className="mt-1 break-all font-bold text-slate-950">
                {email}
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-500">
                Test
              </p>

              <p className="mt-1 font-bold text-slate-950">
                {testTitle}
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-500">
                Holati
              </p>

              <span
                className={
                  attempt.completed_at
                    ? "mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                    : "mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"
                }
              >
                {completionStatus}
              </span>
            </div>

            <div>
              <p className="font-semibold text-slate-500">
                Boşlangan
              </p>

              <p className="mt-1 font-bold text-slate-950">
                {formatDate(
                  attempt.started_at,
                )}
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-500">
                Tugallangan
              </p>

              <p className="mt-1 font-bold text-slate-950">
                {formatDate(
                  attempt.completed_at,
                )}
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
                      ? "rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6"
                      : "rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-6"
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

                  {question.question_type ===
                  "written" ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Öquvçi javobi
                        </p>

                        <div className="mt-2 font-semibold">
                          {selectedAnswer ? (
                            <MathValue
                              value={selectedAnswer}
                            />
                          ) : (
                            <span className="text-slate-400">
                              Javob berilmagan
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                          Töğri javob
                        </p>

                        <div className="mt-2 font-semibold text-emerald-950">
                          <MathValue
                            value={correctAnswer}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
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
                  )}

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
                    <div className="print-hidden mt-6">
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

                  <div className="print-hidden">
                    <AnswerCorrection
                      attemptId={attempt.id}
                      questionId={question.id}
                      studentAnswer={selectedAnswer}
                      isCorrect={isCorrect}
                      setCorrectness={setAnswerCorrectness}
                      addToKey={addAnswerToKey}
                    />
                  </div>
                </article>
              );
            }

            const block = item.block;

            /* Mustaqil ish: javob ham, ball ham yo'q — faqat shartini ko'rsatamiz */
            if (block.block_type === "self_study") {
              return (
                <article
                  key={`block-${block.id}`}
                  className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 shadow-sm sm:p-6"
                >
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Mustaqil iş · ball berilmaydi
                  </span>

                  <h3 className="mt-3 text-lg font-bold">
                    {block.order_number}-savol
                  </h3>

                  {block.stimulus_text && (
                    <div className="mt-4 text-base leading-8">
                      <MathValue value={block.stimulus_text} />
                    </div>
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
                            (
                              answerKey.accepted_answers
                                ?.length ?? 0
                            ) > 0 && (
                              <div className="mt-3 text-sm text-slate-500">
                                Qabul qilinadigan boşqa javoblar:
                                <div className="mt-1">
                                  <MathValue
                                    value={(
                                      answerKey.accepted_answers ??
                                      []
                                    ).join(", ")}
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
                            <div className="print-hidden mt-5">
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

                          <div className="print-hidden">
                            <AnswerCorrection
                              attemptId={attempt.id}
                              questionId={question.id}
                              studentAnswer={selectedAnswer}
                              isCorrect={isCorrect}
                              setCorrectness={setAnswerCorrectness}
                              addToKey={addAnswerToKey}
                            />
                          </div>
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
