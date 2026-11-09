"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/ui/submit-button";
import {
  initialFormState,
  type FormState,
} from "@/lib/form-state";

type EditQuestionFormProps = {
  testId: number;
  questionId: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  solutionText: string;
  solutionVideoUrl: string;
  action: (
    previousState: FormState,
    formData: FormData,
  ) => Promise<FormState>;
};

function fieldClass(error?: string) {
  return [
    "mt-2 w-full rounded-xl bg-white px-4 py-3",
    "text-slate-900 placeholder:text-slate-400",
    "outline-none transition",
    error
      ? "border border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
      : "border border-slate-300 focus:border-mb-brand focus:ring-2 focus:ring-blue-100",
  ].join(" ");
}

function FieldError({
  message,
}: {
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p
      role="alert"
      className="mt-1.5 text-sm font-medium text-red-600"
    >
      {message}
    </p>
  );
}

export default function EditQuestionForm({
  testId,
  questionId,
  questionText,
  optionA,
  optionB,
  optionC,
  optionD,
  correctAnswer,
  solutionText,
  solutionVideoUrl,
  action,
}: EditQuestionFormProps) {
  const [state, formAction, pending] =
    useActionState(action, initialFormState);

  const options = [
    {
      letter: "A",
      name: "optionA",
      value: optionA,
    },
    {
      letter: "B",
      name: "optionB",
      value: optionB,
    },
    {
      letter: "C",
      name: "optionC",
      value: optionC,
    },
    {
      letter: "D",
      name: "optionD",
      value: optionD,
    },
  ] as const;

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <input
        type="hidden"
        name="testId"
        value={testId}
      />

      <input
        type="hidden"
        name="questionId"
        value={questionId}
      />

      <label
        htmlFor="questionText"
        className="block text-sm font-semibold"
      >
        Savol matni
      </label>

      <textarea
        id="questionText"
        name="questionText"
        rows={5}
        defaultValue={questionText}
        className={`${fieldClass(
          state.errors.questionText,
        )} resize-y`}
      />

      <FieldError
        message={state.errors.questionText}
      />

      {options.map((option) => (
        <div key={option.letter}>
          <label
            htmlFor={option.name}
            className="mt-5 block text-sm font-semibold"
          >
            {option.letter} variant
          </label>

          <input
            id={option.name}
            name={option.name}
            defaultValue={option.value}
            className={fieldClass(
              state.errors[option.name],
            )}
          />

          <FieldError
            message={state.errors[option.name]}
          />
        </div>
      ))}

      <label
        htmlFor="correctAnswer"
        className="mt-5 block text-sm font-semibold"
      >
        Töğri javob
      </label>

      <select
        id="correctAnswer"
        name="correctAnswer"
        defaultValue={correctAnswer}
        className={fieldClass(
          state.errors.correctAnswer,
        )}
      >
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="D">D</option>
      </select>

      <FieldError
        message={state.errors.correctAnswer}
      />

      <label
        htmlFor="solutionText"
        className="mt-5 block text-sm font-semibold"
      >
        Yozma yeçim
      </label>

      <textarea
        id="solutionText"
        name="solutionText"
        rows={5}
        defaultValue={solutionText}
        placeholder="Ixtiyoriy"
        className={`${fieldClass()} resize-y`}
      />

      <label
        htmlFor="solutionVideoUrl"
        className="mt-5 block text-sm font-semibold"
      >
        Videoyeçim havolasi
      </label>

      <input
        id="solutionVideoUrl"
        name="solutionVideoUrl"
        type="text"
        defaultValue={solutionVideoUrl}
        placeholder="https://youtube.com/..."
        className={fieldClass(
          state.errors.solutionVideoUrl,
        )}
      />

      <FieldError
        message={state.errors.solutionVideoUrl}
      />

      {state.status === "error" &&
        state.message && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {state.message}
          </div>
        )}

      <SubmitButton
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-mb-brand px-5 py-3 font-semibold text-white transition hover:bg-mb-brandDark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Saqlanmoqda..."
          : "Özgarişlarni saqlaş"}
      </SubmitButton>
    </form>
  );
}