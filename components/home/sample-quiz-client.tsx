"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw, X } from "@/components/ui/icons";

import { cn } from "@/lib/utils";

export type SampleQuestion = {
  topic: string;
  textHtml: string;
  optionsHtml: string[];
  correct: number;
  hintHtml: string;
};

const LETTERS = ["A", "B", "C", "D"];

export default function SampleQuizClient({
  questions,
  className,
}: {
  questions: SampleQuestion[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const question = questions[index];
  const answered = picked !== null;
  const isLast = index === questions.length - 1;

  function pick(option: number) {
    if (answered) return;

    setPicked(option);

    if (option === question.correct) {
      setScore((value) => value + 1);
    }
  }

  function next() {
    if (isLast) {
      setDone(true);
      return;
    }

    setIndex((value) => value + 1);
    setPicked(null);
  }

  function restart() {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-vp-line bg-vp-surface p-4 shadow-lg sm:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Sinab köring</p>

        {/* Qaysi savolda ekani */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {questions.map((_, dot) => (
            <span
              key={dot}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                done || dot < index
                  ? "w-5 bg-vp-brand"
                  : dot === index
                    ? "w-8 bg-vp-brand"
                    : "w-5 bg-vp-raised",
              )}
            />
          ))}
        </div>
      </div>

      {done ? (
        <div className="py-6 text-center">
          <p className="num text-6xl font-extrabold text-vp-ink">
            {score}
            <span className="text-3xl text-vp-muted">/{questions.length}</span>
          </p>

          <p className="mt-2 text-lg font-bold text-vp-ink">
            {score === questions.length
              ? "Hammasi toğri!"
              : score === 0
                ? "Hali hammasi oldinda"
                : "Yaxşi boşlaniş"}
          </p>

          <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-vp-muted">
            Platformada har bir test şunday işlaydi: javob berasiz —
            natija va xatolar tahlili darrov çiqadi.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/auth/login?mode=signup"
              className="press btn-solid inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mb-brand px-5 font-bold text-white transition hover:bg-mb-brandDark"
            >
              Haqiqiy testlarga ötiş
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={restart}
              className="edge inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-vp-line bg-vp-surface px-4 font-semibold text-vp-ink"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Qaytadan
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs font-semibold text-vp-brand">
            {index + 1}-savol · {question.topic}
          </p>

          <p
            className="math-content mt-1.5 text-[19px] leading-8 text-vp-ink sm:text-[21px]"
            dangerouslySetInnerHTML={{ __html: question.textHtml }}
          />

          <div className="mt-4 grid gap-2">
            {question.optionsHtml.map((optionHtml, option) => {
              const isCorrect = option === question.correct;
              const isPicked = option === picked;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => pick(option)}
                  disabled={answered}
                  aria-pressed={isPicked}
                  className={cn(
                    "flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 text-left transition",
                    !answered &&
                      "edge border-vp-line bg-vp-surface hover:border-vp-brand",
                    answered &&
                      isCorrect &&
                      "border-vp-success-line bg-vp-success-soft",
                    answered &&
                      isPicked &&
                      !isCorrect &&
                      "border-vp-danger-line bg-vp-danger-soft",
                    answered &&
                      !isPicked &&
                      !isCorrect &&
                      "border-vp-line bg-vp-surface opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold",
                      !answered && "bg-vp-raised text-vp-ink",
                      answered && isCorrect && "bg-vp-success text-vp-on-brand",
                      answered &&
                        isPicked &&
                        !isCorrect &&
                        "bg-vp-danger text-vp-on-brand",
                      answered &&
                        !isPicked &&
                        !isCorrect &&
                        "bg-vp-raised text-vp-muted",
                    )}
                  >
                    {answered && isCorrect ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : answered && isPicked ? (
                      <X className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      LETTERS[option]
                    )}
                  </span>

                  <span
                    className="math-content text-[17px] text-vp-ink"
                    dangerouslySetInnerHTML={{ __html: optionHtml }}
                  />
                </button>
              );
            })}
          </div>

          {/* Izoh va keyingi qadam — javobdan keyin */}
          <div
            aria-live="polite"
            className={cn(
              "grid transition-all duration-300",
              answered ? "mt-3 grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              {answered && (
                <div className="flex flex-col gap-3 rounded-xl bg-vp-surface-soft p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-vp-ink">
                    <b>
                      {picked === question.correct ? "Toğri. " : "Notoğri. "}
                    </b>
                    <span
                      className="math-content"
                      dangerouslySetInnerHTML={{ __html: question.hintHtml }}
                    />
                  </p>

                  <button
                    type="button"
                    onClick={next}
                    className="press btn-solid inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-mb-brand px-4 text-sm font-bold text-white transition hover:bg-mb-brandDark"
                  >
                    {isLast ? "Natija" : "Keyingi"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
