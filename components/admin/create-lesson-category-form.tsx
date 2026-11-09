"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/ui/submit-button";

import {
  initialFormState,
  type FormState,
} from "@/lib/form-state";

type CreateLessonCategoryFormProps = {
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

export default function CreateLessonCategoryForm({
  action,
}: CreateLessonCategoryFormProps) {
  const [state, formAction, pending] =
    useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-2xl font-bold">
        Yangi dars bölimi
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Masalan: Algebra, Geometriya yoki
        Trigonometriya.
      </p>

      <label
        htmlFor="title"
        className="mt-6 block text-sm font-semibold"
      >
        Bölim nomi
      </label>

      <input
        id="title"
        name="title"
        type="text"
        placeholder="Masalan: Algebra"
        aria-invalid={Boolean(
          state.errors.title,
        )}
        aria-describedby={
          state.errors.title
            ? "title-error"
            : undefined
        }
        className={fieldClass(
          state.errors.title,
        )}
      />

      {state.errors.title && (
        <p
          id="title-error"
          role="alert"
          className="mt-1.5 text-sm font-medium text-red-600"
        >
          {state.errors.title}
        </p>
      )}

      <label
        htmlFor="description"
        className="mt-5 block text-sm font-semibold"
      >
        Qisqaça tavsif
      </label>

      <textarea
        id="description"
        name="description"
        rows={4}
        placeholder="Bu bölimda qanday mavzular örgatiladi?"
        className={`${fieldClass()} resize-y`}
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
          ? "Bölim yaratilmoqda..."
          : "Bölimni yaratiş"}
      </SubmitButton>
    </form>
  );
}