import { requireAdmin } from "@/lib/require-admin";
import { gradeAnswers } from "@/lib/answer-check";
import {
  ANSWER_TOPICS,
  TEST_LABELS,
  findAnswerTopic,
} from "@/lib/answer-keys";
import TestChecker, {
  type CheckState,
  type TopicOption,
} from "@/components/admin/test-checker";

export const metadata = {
  title: "Test tekşiriş",
};

/*
 * Javoblar kaliti ataylab SERVERDA qoladi: agar u brauzerga
 * yuborilsa, sahifa admin uchun bo'lsa ham, bundle fayli orqali
 * o'quvchi qo'liga tushishi mumkin edi. Shuning uchun mijozga
 * faqat mavzu nomi va savollar soni beriladi, tekshirish esa
 * shu yerdagi server action'da bajariladi.
 */

async function checkAnswersAction(
  _previousState: CheckState,
  formData: FormData,
): Promise<CheckState> {
  "use server";

  await requireAdmin();

  const topicN = Number(formData.get("topicN"));
  const slot = Number(formData.get("slot"));
  const answers = String(formData.get("answers") ?? "");

  const topic = findAnswerTopic(topicN);

  if (!topic) {
    return { status: "error", message: "Mavzu topilmadi." };
  }

  if (!Number.isInteger(slot) || slot < 0 || slot >= topic.variants.length) {
    return { status: "error", message: "Test turi notöğri." };
  }

  const variant = topic.variants[slot];

  if (!answers.trim()) {
    return {
      status: "error",
      message: "Javoblarni kiriting — masalan ABCDABCD.",
    };
  }

  const result = gradeAnswers(answers, variant.answers);

  if (result.givenCount === 0) {
    return {
      status: "error",
      message:
        "A, B, C yoki D harfi topilmadi. Javoblarni harflar bilan yozing.",
    };
  }

  return {
    status: "done",
    topicTitle: `${topic.n}. ${topic.title}`,
    testLabel: `${TEST_LABELS[slot]} · ${result.expectedCount} ta savol`,
    result,
  };
}

export default async function TestCheckPage() {
  await requireAdmin();

  const topics: TopicOption[] = ANSWER_TOPICS.map((topic) => ({
    n: topic.n,
    title: topic.title,
    counts: topic.variants.map((variant) => variant.answers.length),
  }));

  const totalQuestions = ANSWER_TOPICS.reduce(
    (sum, topic) =>
      sum +
      topic.variants.reduce(
        (inner, variant) => inner + variant.answers.length,
        0,
      ),
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-mb-line bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold text-mb-ink sm:text-2xl">
            Test tekşiriş
          </h1>

          <p className="mt-1 text-sm text-mb-muted">
            “Matematika 0 dan” töplami böyiça javoblarni kalit bilan
            soliştiradi — {ANSWER_TOPICS.length} ta mavzu,{" "}
            {totalQuestions.toLocaleString("uz-UZ")} ta javob.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <TestChecker
          topics={topics}
          testLabels={TEST_LABELS}
          action={checkAnswersAction}
        />
      </section>
    </main>
  );
}
