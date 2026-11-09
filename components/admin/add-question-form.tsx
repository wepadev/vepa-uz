"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/ui/submit-button";
import {
  initialFormState,
  type FormState,
} from "@/lib/form-state";

type AddQuestionFormProps = {
  testId: number;
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
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 text-sm font-medium text-red-600"
    >
      {message}
    </p>
  );
}

export default function AddQuestionForm({
  testId,
  action,
}: AddQuestionFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialFormState,
  );

  return (
    <form
      action={formAction}
      noValidate
      className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <input
        type="hidden"
        name="testId"
        value={testId}
      />

      <h2 className="text-2xl font-bold">
        Yangi savol
      </h2>

      <label
        htmlFor="questionText"
        className="mt-6 block text-sm font-semibold"
      >
        Savol matni
      </label>

      <textarea
        id="questionText"
        name="questionText"
        rows={4}
        placeholder="Masalan: 2 + 3 neçaga teng?"
        aria-invalid={
          Boolean(state.errors.questionText)
        }
        aria-describedby={
          state.errors.questionText
            ? "questionText-error"
            : undefined
        }
        className={`${fieldClass(
          state.errors.questionText,
        )} resize-none`}
      />

      <FieldError
        id="questionText-error"
        message={state.errors.questionText}
      />

      {(["A", "B", "C", "D"] as const).map(
        (letter) => {
          const fieldName = `option${letter}`;
          const error = state.errors[fieldName];

          return (
            <div key={letter}>
              <label
                htmlFor={fieldName}
                className="mt-4 block text-sm font-semibold"
              >
                {letter} variant
              </label>

              <input
                id={fieldName}
                name={fieldName}
                placeholder={`${letter} javob`}
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error
                    ? `${fieldName}-error`
                    : undefined
                }
                className={fieldClass(error)}
              />

              <FieldError
                id={`${fieldName}-error`}
                message={error}
              />
            </div>
          );
        },
      )}

      <label
        htmlFor="correctAnswer"
        className="mt-5 block text-sm font-semibold"
      >
        Töğri javob
      </label>

      <select
        id="correctAnswer"
        name="correctAnswer"
        defaultValue=""
        aria-invalid={Boolean(
          state.errors.correctAnswer,
        )}
        aria-describedby={
          state.errors.correctAnswer
            ? "correctAnswer-error"
            : undefined
        }
        className={fieldClass(
          state.errors.correctAnswer,
        )}
      >
        <option value="" disabled>
          Javobni tanlang
        </option>

        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="D">D</option>
      </select>

      <FieldError
        id="correctAnswer-error"
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
        rows={3}
        placeholder="Ixtiyoriy"
        className={`${fieldClass()} resize-none`}
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
        type="url"
        placeholder="https://youtube.com/..."
        className={fieldClass(
          state.errors.solutionVideoUrl,
        )}
      />

      <FieldError
        id="solutionVideoUrl-error"
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
          ? "Savol saqlanmoqda..."
          : "Savolni qöşiş"}
      </SubmitButton>
    </form>
  );
}