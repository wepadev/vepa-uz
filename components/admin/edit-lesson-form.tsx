"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/ui/submit-button";

import {
  initialFormState,
  type FormState,
} from "@/lib/form-state";

type TestOption = {
  id: number;
  title: string;
};

type EditLessonFormProps = {
  categoryId: number;
  lessonId: number;
  title: string;
  description: string;
  videoUrl: string;
  content: string;
  orderNumber: number;
  isFree: boolean;
  testIds: number[];
  tests: TestOption[];
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
      : "border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
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

export default function EditLessonForm({
  categoryId,
  lessonId,
  title,
  description,
  videoUrl,
  content,
  orderNumber,
  isFree,
  testIds,
  tests,
  action,
}: EditLessonFormProps) {
  const [state, formAction, pending] =
    useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <input
        type="hidden"
        name="categoryId"
        value={categoryId}
      />

      <input
        type="hidden"
        name="lessonId"
        value={lessonId}
      />

      <label
        htmlFor="title"
        className="block text-sm font-semibold"
      >
        Dars nomi
      </label>

      <input
        id="title"
        name="title"
        type="text"
        defaultValue={title}
        className={fieldClass(
          state.errors.title,
        )}
      />

      <FieldError
        message={state.errors.title}
      />

      <label
        htmlFor="orderNumber"
        className="mt-5 block text-sm font-semibold"
      >
        Tartib raqami
      </label>

      <input
        id="orderNumber"
        name="orderNumber"
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        defaultValue={orderNumber}
        className={fieldClass(
          state.errors.orderNumber,
        )}
      />

      <p className="mt-1 text-xs leading-5 text-slate-500">
        Raqam o‘zgartirilsa, boshqa darslar o‘z-o‘zidan suriladi.
      </p>

      <FieldError
        message={state.errors.orderNumber}
      />

      <label
        htmlFor="description"
        className="mt-5 block text-sm font-semibold"
      >
        Qisqacha tavsif
      </label>

      <textarea
        id="description"
        name="description"
        rows={3}
        defaultValue={description}
        className={`${fieldClass()} resize-y`}
      />

      <label
        htmlFor="videoUrl"
        className="mt-5 block text-sm font-semibold"
      >
        YouTube video havolasi
      </label>

      <input
        id="videoUrl"
        name="videoUrl"
        type="text"
        defaultValue={videoUrl}
        className={fieldClass(
          state.errors.videoUrl,
        )}
      />

      <FieldError
        message={state.errors.videoUrl}
      />

      <label
        htmlFor="content"
        className="mt-5 block text-sm font-semibold"
      >
        Nazariy matn
      </label>

      <textarea
        id="content"
        name="content"
        rows={9}
        defaultValue={content}
        placeholder="Formulalarni $...$ shaklida yozing."
        className={`${fieldClass()} resize-y`}
      />

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 px-4 py-3">
        <input
          type="checkbox"
          name="isFree"
          defaultChecked={isFree}
          className="mt-0.5 h-4 w-4 accent-emerald-600"
        />

        <span>
          <span className="block text-sm font-semibold">
            Bepul dars
          </span>

          <span className="block text-xs leading-5 text-slate-500">
            Belgilanmasa dars Premium bo‘ladi.
          </span>
        </span>
      </label>

      <p className="mt-5 text-sm font-semibold">
        Biriktirilgan testlar
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        Keyingi dars belgilangan testlarning o‘rtacha natijasi
        90% ga yetganda ochiladi.
      </p>

      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-300 p-2">
        {tests.length === 0 ? (
          <p className="px-2 py-1 text-sm text-slate-500">
            Test topilmadi.
          </p>
        ) : (
          tests.map((test) => (
            <label
              key={test.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name="testIds"
                value={test.id}
                defaultChecked={testIds.includes(test.id)}
                className="h-4 w-4 accent-blue-600"
              />
              {test.title}
            </label>
          ))
        )}
      </div>

      <FieldError
        message={state.errors.testIds}
      />

      {state.status === "error" &&
        state.message && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {state.message}
          </div>
        )}

        {state.status === "success" &&
          state.message && (
            <div
              role="status"
              aria-live="polite"
              className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
            >
              {state.message}
            </div>
          )}

      <SubmitButton

        disabled={pending}
        className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Saqlanmoqda..."
          : "O‘zgarishlarni saqlash"}
      </SubmitButton>
    </form>
  );
}