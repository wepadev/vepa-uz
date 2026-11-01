import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";
import EditQuestionForm from "@/components/admin/edit-question-form";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.is_active !== true
  ) {
    redirect("/");
  }

  return supabase;
}

async function updateQuestion(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const supabase = await requireAdmin();

  const testId = Number(
    formData.get("testId"),
  );

  const questionId = Number(
    formData.get("questionId"),
  );

  const questionText = String(
    formData.get("questionText") ?? "",
  ).trim();

  const optionA = String(
    formData.get("optionA") ?? "",
  ).trim();

  const optionB = String(
    formData.get("optionB") ?? "",
  ).trim();

  const optionC = String(
    formData.get("optionC") ?? "",
  ).trim();

  const optionD = String(
    formData.get("optionD") ?? "",
  ).trim();

  const correctAnswer = String(
    formData.get("correctAnswer") ?? "",
  ).trim();

  const solutionText = String(
    formData.get("solutionText") ?? "",
  ).trim();

  const solutionVideoUrl = String(
    formData.get("solutionVideoUrl") ?? "",
  ).trim();

  if (
    !Number.isInteger(testId) ||
    !Number.isInteger(questionId) ||
    testId <= 0 ||
    questionId <= 0
  ) {
    return {
      status: "error",
      message:
        "Savol ma’lumotlari notöğri. Sahifani yangilang.",
      errors: {},
    };
  }

  const errors: Record<string, string> = {};

  if (!questionText) {
    errors.questionText =
      "Savol matnini kiriting.";
  }

  if (!optionA) {
    errors.optionA =
      "A javob variantini kiriting.";
  }

  if (!optionB) {
    errors.optionB =
      "B javob variantini kiriting.";
  }

  if (!optionC) {
    errors.optionC =
      "C javob variantini kiriting.";
  }

  if (!optionD) {
    errors.optionD =
      "D javob variantini kiriting.";
  }

  if (
    !["A", "B", "C", "D"].includes(
      correctAnswer,
    )
  ) {
    errors.correctAnswer =
      "Töğri javobni tanlang.";
  }

  if (
    solutionVideoUrl &&
    !/^https?:\/\/.+/i.test(
      solutionVideoUrl,
    )
  ) {
    errors.solutionVideoUrl =
      "Video havolasini https:// bilan töliq kiriting.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message:
        "Qizil bilan körsatilgan joylarni töğrilang.",
      errors,
    };
  }

  const {
    data: existingQuestion,
    error: existingError,
  } = await supabase
    .from("questions")
    .select("id")
    .eq("id", questionId)
    .eq("test_id", testId)
    .single();

  if (
    existingError ||
    !existingQuestion
  ) {
    return {
      status: "error",
      message:
        "Tahrirlanadigan savol topilmadi.",
      errors: {},
    };
  }

  const { error: questionError } =
    await supabase
      .from("questions")
      .update({
        question_text: questionText,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
      })
      .eq("id", questionId)
      .eq("test_id", testId);

  if (questionError) {
    return {
      status: "error",
      message:
        "Savol matnini yangilab bölmadi.",
      errors: {},
    };
  }

  const { error: answerError } =
    await supabase
      .from("answer_keys")
      .upsert(
        {
          question_id: questionId,
          correct_answer: correctAnswer,
          solution_text:
            solutionText || null,
          solution_video_url:
            solutionVideoUrl || null,
        },
        {
          onConflict: "question_id",
        },
      );

  if (answerError) {
    return {
      status: "error",
      message:
        "Töğri javob yoki yeçimni yangilab bölmadi.",
      errors: {},
    };
  }

  revalidatePath(
    "/admin/tests/manage",
  );

  revalidatePath("/tests");
  revalidatePath("/tests/take");
  revalidatePath("/results/view");

  redirect(
    `/admin/tests/manage?testId=${testId}`,
  );
}

type PageProps = {
  searchParams: Promise<{
    testId?: string;
    questionId?: string;
  }>;
};

export default async function EditQuestionPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const testId = Number(params.testId);
  const questionId = Number(
    params.questionId,
  );

  if (
    !Number.isInteger(testId) ||
    !Number.isInteger(questionId) ||
    testId <= 0 ||
    questionId <= 0
  ) {
    notFound();
  }

  const supabase = await requireAdmin();

  const {
    data: question,
    error: questionError,
  } = await supabase
    .from("questions")
    .select(`
      id,
      test_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      order_number
    `)
    .eq("id", questionId)
    .eq("test_id", testId)
    .single();

  if (
    questionError ||
    !question
  ) {
    notFound();
  }

  const {
    data: answer,
    error: answerError,
  } = await supabase
    .from("answer_keys")
    .select(`
      correct_answer,
      solution_text,
      solution_video_url
    `)
    .eq("question_id", questionId)
    .maybeSingle();

  if (answerError) {
    throw new Error(
      "Savol javobini yuklab bölmadi.",
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">
          <Link
            href={`/admin/tests/manage?testId=${testId}`}
            className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
          >
            ← Savollar röyxatiga qaytiş
          </Link>

          <h1 className="text-xl font-bold sm:text-2xl">
            {question.order_number}-savolni
            tahrirlaş
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Savol raqami özgarmaydi.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <EditQuestionForm
          testId={testId}
          questionId={questionId}
          questionText={
            question.question_text
          }
          optionA={question.option_a}
          optionB={question.option_b}
          optionC={question.option_c}
          optionD={question.option_d}
          correctAnswer={
            answer?.correct_answer ?? "A"
          }
          solutionText={
            answer?.solution_text ?? ""
          }
          solutionVideoUrl={
            answer?.solution_video_url ?? ""
          }
          action={updateQuestion}
        />
      </section>
    </main>
  );
}