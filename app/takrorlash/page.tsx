import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import ReviewSession, {
  type ReviewQuestion,
} from "@/components/review-session";
import PageHeader from "@/components/ui/page-header";
import { shuffleOptions } from "@/lib/shuffle";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Haftalik takrorlaş",
  description:
    "Hafta davomida xato qilgan savollaringiz haftada bir marta qaytadi.",
};

/** Bir seansda nechta savol beriladi */
const SESSION_SIZE = 10;

type ProgressRow = {
  due_count: number | string;
  learning_count: number | string;
  mastered_count: number | string;
  total_count: number | string;
};

type QuestionRow = {
  question_id: number | string;
  question_text: string | null;
  stimulus_text: string | null;
  image_path: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  question_type: string | null;
  part_label: string | null;
  test_title: string | null;
  stage: number | string;
  wrong_count: number | string;
};

const QUESTION_IMAGE_BUCKET = "question-images";

function toNumber(value: number | string | null | undefined) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

export default async function ReviewPage() {
  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  /*
   * Avval yangi xatolarni yig'amiz, keyin ro'yxatni o'qiymiz.
   *
   * Yig'ish alohida chaqiruv bo'lgani ma'qul: test yuborilganda
   * trigger bilan qilinsa, `submit_timed_test` ning ichki tartibiga
   * bog'liq bo'lib qolardi. Bu yerda esa tartib aniq.
   */
  const collectResult = await supabase.rpc("collect_review_items");

  /*
   * db/15 hali ishga tushirilmagan bo'lsa sahifa buzilmasin —
   * tushunarli xabar ko'rsatamiz.
   */
  const migrationMissing = Boolean(collectResult.error);

  const [progressResult, questionsResult] = migrationMissing
    ? [{ data: null }, { data: null }]
    : await Promise.all([
        supabase.rpc("review_progress"),
        supabase.rpc("due_review_questions", { p_limit: SESSION_SIZE }),
      ]);

  const progress = (
    Array.isArray(progressResult.data)
      ? progressResult.data[0]
      : progressResult.data
  ) as ProgressRow | null;

  const rows = (questionsResult.data ?? []) as QuestionRow[];

  /*
   * Rasmlar yopiq saqlagichda — har biri uchun vaqtinchalik havola
   * yasaymiz. Seans uzoq davom etishi mumkin, shuning uchun 6 soat.
   */
  const imagePaths = rows
    .map((row) => row.image_path)
    .filter((path): path is string => Boolean(path));

  const imageUrls = new Map<string, string>();

  if (imagePaths.length > 0) {
    const { data } = await supabase.storage
      .from(QUESTION_IMAGE_BUCKET)
      .createSignedUrls(imagePaths, 60 * 60 * 6);

    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        imageUrls.set(item.path, item.signedUrl);
      }
    }
  }

  const questions: ReviewQuestion[] = rows.map((row) => ({
    questionId: toNumber(row.question_id),
    questionText: row.question_text ?? "",
    stimulusText: row.stimulus_text,
    imageUrl: row.image_path
      ? imageUrls.get(row.image_path) ?? null
      : null,
    /*
     * Variantlar ARALASHTIRILADI.
     *
     * Nega: takrorlashda bitta savol bir necha marta chiqadi.
     * Tartib doim bir xil bo'lsa, o'quvchi javobni emas, uning
     * O'RNINI eslab qoladi ("uchinchisi to'g'ri") va takrorlash
     * ma'nosini yo'qotadi.
     *
     * Kalitga xato soni qo'shilgan: o'quvchi yana xato qilsa,
     * keyingi safar tartib boshqacha bo'ladi. Bitta seans ichida
     * esa o'zgarmaydi -- sahifa yangilansa ham joyidan qo'zg'almaydi.
     *
     * Javob ASL harfi bilan yuboriladi, ekranda esa `displayLetter`
     * ko'rinadi -- test ishlash oynasidagi bilan bir xil mantiq.
     */
    options: shuffleOptions(
      [
        { letter: "A", text: row.option_a },
        { letter: "B", text: row.option_b },
        { letter: "C", text: row.option_c },
        { letter: "D", text: row.option_d },
      ]
        .filter((option) => Boolean(option.text?.trim()))
        .map((option) => ({
          letter: option.letter,
          text: option.text as string,
        })),
      `${user.id}:${toNumber(row.question_id)}:${toNumber(row.wrong_count)}`,
    ),
    isWritten: row.question_type === "written",
    testTitle: row.test_title,
    wrongCount: toNumber(row.wrong_count),
  }));

  const dueCount = toNumber(progress?.due_count);
  const learningCount = toNumber(progress?.learning_count);
  const masteredCount = toNumber(progress?.mastered_count);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        title="Haftalik takrorlaş"
        subtitle="Hafta davomidagi xatolaringiz"
      />

      <section className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">

        {migrationMissing && (
          <AppAlert
            variant="warning"
            title="Bölim tayyor emas"
            className="mt-5"
          >
            Supabase’da <b>db/15</b> va <b>db/23</b> fayllarini işga
            tuşiring — şundan keyin savollar çiqa boşlaydi.
          </AppAlert>
        )}

        {!migrationMissing && (
          <div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
            <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-muted sm:text-xs">
                Bu hafta
              </p>
              <p className="mt-1 text-lg font-bold text-mb-brand sm:text-2xl">
                {dueCount}
              </p>
            </div>

            <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-muted sm:text-xs">
                Navbatda
              </p>
              <p className="mt-1 text-lg font-bold text-amber-600 sm:text-2xl">
                {learningCount}
              </p>
            </div>

            <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-mb-muted sm:text-xs">
                Yopildi
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-600 sm:text-2xl">
                {masteredCount}
              </p>
            </div>
          </div>
        )}

        {!migrationMissing && questions.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center sm:px-6">
            {masteredCount + learningCount === 0 ? (
              <>
                <Sparkles
                  className="mx-auto h-10 w-10 text-mb-muted"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />

                <h2 className="mt-4 text-lg font-bold">
                  Takrorlaş uçun savol yöq
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-mb-muted">
                  Test işlaganingizdan keyin xato qilgan savollaringiz
                  şu yerga tuşadi va keyingi duşanbadan takrorlaşga
                  çiqadi.
                </p>

                <Link
                  href="/tests"
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark"
                >
                  Testlarni köriş
                </Link>
              </>
            ) : (
              <>
                <CheckCircle2
                  className="mx-auto h-10 w-10 text-emerald-500"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />

                <h2 className="mt-4 text-lg font-bold">
                  Bugungi takrorlaş tugadi
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-mb-muted">
                  Barakalla! Bu haftaning xatolarini yopdingiz.
                </p>

                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mb-muted">
                  <CalendarClock
                    className="h-4 w-4"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  Keyingi takrorlaş — duşanba
                </p>
              </>
            )}
          </div>
        )}

        {questions.length > 0 && (
          <div className="mt-6">
            <ReviewSession questions={questions} />
          </div>
        )}
      </section>
    </main>
  );
}
