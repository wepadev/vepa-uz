"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  XCircle,
} from "lucide-react";

import MathText from "@/components/math-text";
import YouTubeEmbed from "@/components/youtube-embed";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ReviewQuestion = {
  questionId: number;
  questionText: string;
  stimulusText: string | null;
  imageUrl: string | null;
  /*
   * `letter` — asl harf, javob shu ko'rinishda yuboriladi.
   * `displayLetter` — o'quvchi ekranda ko'radigan harf
   * (variantlar aralashtirilgani uchun ular farq qiladi).
   */
  options: Array<{
    letter: string;
    text: string;
    displayLetter?: string;
  }>;
  isWritten: boolean;
  testTitle: string | null;
  /** Necha marta xato qilingan — savol qanchalik qiyin ekani */
  wrongCount: number;
};

type Feedback = {
  isCorrect: boolean;
  correctAnswer: string | null;
  solutionText: string | null;
  solutionVideoUrl: string | null;
  isMastered: boolean;
  nextDueAt: string | null;
};

type AnswerRow = {
  is_correct: boolean;
  correct_answer: string | null;
  solution_text: string | null;
  solution_video_url: string | null;
  next_due_at: string | null;
  new_stage: number;
  is_mastered: boolean;
};

/** Javobdan keyingi izoh */
function nextLabel(isMastered: boolean) {
  return isMastered
    ? "Töğri yeçdingiz — bu savol boşqa çiqmaydi"
    : "Keyingi haftada yana çiqadi";
}

function MathValue({ value }: { value: string | null | undefined }) {
  if (!value) return null;

  return <MathText content={value} />;
}

/**
 * Takrorlash seansi.
 *
 * Bitta savol ko'rsatiladi, javob tekshiriladi va darhol yechim
 * chiqadi — o'quvchi xatosini o'sha zahoti tushunsin. Keyingi
 * muddat bazada belgilanadi (db/15).
 */
export default function ReviewSession({
  questions,
}: {
  questions: ReviewQuestion[];
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const question = questions[index];
  const isFinished = index >= questions.length;

  async function check() {
    if (isChecking || !question || !answer.trim()) {
      return;
    }

    setIsChecking(true);
    setFailed(false);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("answer_review_item", {
        p_question_id: question.questionId,
        p_answer: answer,
      });

      const row = (
        Array.isArray(data) ? data[0] : data
      ) as AnswerRow | null;

      if (error || !row) {
        setFailed(true);
        return;
      }

      if (row.is_correct) {
        setCorrectCount((current) => current + 1);
      }

      setFeedback({
        isCorrect: row.is_correct,
        correctAnswer: row.correct_answer,
        solutionText: row.solution_text,
        solutionVideoUrl: row.solution_video_url,
        isMastered: row.is_mastered,
        nextDueAt: row.next_due_at,
      });
    } catch {
      setFailed(true);
    } finally {
      setIsChecking(false);
    }
  }

  function next() {
    setFeedback(null);
    setAnswer("");
    setFailed(false);
    setIndex((current) => current + 1);
  }

  if (isFinished) {
    return (
      <div className="rounded-3xl border border-mb-line bg-white px-5 py-10 text-center shadow-sm sm:px-6">
        <CheckCircle2
          className="mx-auto h-12 w-12 text-emerald-500"
          strokeWidth={1.6}
          aria-hidden="true"
        />

        <h2 className="mt-4 text-xl font-bold">Seans tugadi</h2>

        <p className="mt-2 text-sm leading-6 text-mb-muted">
          {questions.length} ta savoldan {correctCount} tasini töğri
          yeçdingiz. Xato qilganlaringiz keyingi haftaga qoldi.
        </p>

        <a
          href="/takrorlash"
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          Davom etiş
        </a>
      </div>
    );
  }

  if (!question) {
    return null;
  }

  return (
    <div>
      {/* Jarayon */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-mb-muted">
          {index + 1} / {questions.length}
        </p>

        {question.testTitle && (
          <p className="truncate text-xs text-mb-muted">
            {question.testTitle}
          </p>
        )}
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-mb-brand transition-all"
          style={{
            width: `${(index / questions.length) * 100}%`,
          }}
        />
      </div>

      <article className="mt-4 rounded-3xl border border-mb-line bg-white p-4 shadow-sm sm:p-6">
        {question.wrongCount > 1 && (
          <p className="mb-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            {question.wrongCount} marta xato qilgansiz
          </p>
        )}

        {question.stimulusText && (
          <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-[15px] leading-7">
            <MathValue value={question.stimulusText} />
          </div>
        )}

        <div className="text-lg font-bold leading-8">
          <MathValue value={question.questionText} />
        </div>

        {question.imageUrl && (
          <img
            loading="lazy"
            decoding="async"
            src={question.imageUrl}
            alt="Savol rasmi"
            className="mt-4 w-full rounded-2xl border border-mb-line"
          />
        )}

        {/* Javob */}
        <div className="mt-5 space-y-2.5">
          {question.isWritten || question.options.length === 0 ? (
            <>
              <label
                htmlFor="review-answer"
                className="block text-sm font-semibold text-slate-600"
              >
                Javobingiz
              </label>

              <input
                id="review-answer"
                type="text"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={Boolean(feedback)}
                autoComplete="off"
                placeholder="Javobni kiriting"
                className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
              />
            </>
          ) : (
            question.options.map((option) => {
              const selected = answer === option.letter;

              const isRight =
                feedback &&
                feedback.correctAnswer?.trim().toLowerCase() ===
                  option.letter.toLowerCase();

              return (
                <label
                  key={option.letter}
                  className={cn(
                    "flex min-h-[56px] cursor-pointer select-none items-start gap-3 rounded-2xl border px-3 py-3 transition sm:px-5",
                    !feedback &&
                      (selected
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                        : "border-slate-200 bg-white hover:border-blue-300"),
                    feedback &&
                      isRight &&
                      "border-emerald-500 bg-emerald-50",
                    feedback &&
                      !isRight &&
                      selected &&
                      "border-red-400 bg-red-50",
                    feedback &&
                      !isRight &&
                      !selected &&
                      "border-slate-200 bg-white opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="review-option"
                    value={option.letter}
                    checked={selected}
                    disabled={Boolean(feedback)}
                    onChange={() => setAnswer(option.letter)}
                    className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
                  />

                  <span className="min-w-0 text-[15px] leading-7">
                    <b className="mr-1.5">
                      {option.displayLetter ?? option.letter})
                    </b>
                    <MathValue value={option.text} />
                  </span>
                </label>
              );
            })
          )}
        </div>

        {failed && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            Javobni tekşirib bölmadi. Internet aloqangizni tekşirib,
            qayta urinib köring.
          </p>
        )}

        {/* Natija va yechim */}
        {feedback && (
          <div
            className={cn(
              "mt-5 rounded-2xl border p-4",
              feedback.isCorrect
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50",
            )}
          >
            <p
              className={cn(
                "inline-flex items-center gap-2 font-bold",
                feedback.isCorrect
                  ? "text-emerald-700"
                  : "text-red-700",
              )}
            >
              {feedback.isCorrect ? (
                <CheckCircle2
                  className="h-5 w-5"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              ) : (
                <XCircle
                  className="h-5 w-5"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              )}
              {feedback.isCorrect ? "Töğri" : "Xato"}
            </p>

            {!feedback.isCorrect && feedback.correctAnswer && (
              <p className="mt-2 text-sm text-slate-700">
                Töğri javob:{" "}
                <b>
                  <MathValue value={feedback.correctAnswer} />
                </b>
              </p>
            )}

            {feedback.solutionText && (
              <div className="mt-3 rounded-xl bg-white/70 p-3 text-sm leading-7 text-slate-700">
                <MathValue value={feedback.solutionText} />
              </div>
            )}

            {feedback.solutionVideoUrl && (
              <div className="mt-3">
                <YouTubeEmbed url={feedback.solutionVideoUrl} />
              </div>
            )}

            <p className="mt-3 text-xs font-semibold text-mb-muted">
              {nextLabel(feedback.isMastered)}
            </p>
          </div>
        )}

        {/* Tugmalar */}
        <div className="mt-5">
          {feedback ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark sm:w-auto"
            >
              {index + 1 >= questions.length
                ? "Yakunlaş"
                : "Keyingi savol"}
              <ArrowRight
                className="h-4 w-4"
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={check}
              disabled={isChecking || !answer.trim()}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isChecking ? (
                <>
                  <Spinner size="sm" />
                  Tekşirilmoqda...
                </>
              ) : (
                "Tekşiriş"
              )}
            </button>
          )}
        </div>
      </article>
    </div>
  );
}
