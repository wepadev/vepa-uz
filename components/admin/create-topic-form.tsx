"use client";

import {
  useActionState,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import SubmitButton from "@/components/ui/submit-button";

import {
  initialFormState,
  type FormState,
} from "@/lib/form-state";

type CreateTopicFormProps = {
  textbookId: number;
  /**
   * Video maydoni ko'rsatilsinmi.
   *
   * TOP kitobda video mavzuga emas, har bir misolga biriktiriladi —
   * u yerda bu maydon chalg'itadi, shuning uchun ko'rsatilmaydi.
   */
  showVideo?: boolean;
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

export default function CreateTopicForm({
  textbookId,
  showVideo = true,
  action,
}: CreateTopicFormProps) {
  const router = useRouter();
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(action, initialFormState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <input
        type="hidden"
        name="textbookId"
        value={textbookId}
      />

      <h2 className="text-2xl font-bold">
        Yangi mavzu
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Darslik ichiga yangi mavzu qo‘shing.
      </p>

      <label
        htmlFor="title"
        className="mt-6 block text-sm font-semibold"
      >
        Mavzu nomi
      </label>

      <input
        id="title"
        name="title"
        type="text"
        placeholder="Masalan: Natural sonlar"
        className={fieldClass(
          state.errors.title,
        )}
      />

      {state.errors.title && (
        <p
          role="alert"
          className="mt-1.5 text-sm font-medium text-red-600"
        >
          {state.errors.title}
        </p>
      )}

      {/*
        Maktab darsligida video mavzuga biriktiriladi: bitta videoda
        mavzuning hamma misollari yechiladi. TOP kitobda esa har bir
        misolning o'z videosi bor — u yerda bu maydon ko'rsatilmaydi.
      */}
      {showVideo && (
        <>
          <label
            htmlFor="videoUrl"
            className="mt-6 block text-sm font-semibold"
          >
            Videoyechim havolasi{" "}
            <span className="font-normal text-slate-500">
              (ixtiyoriy)
            </span>
          </label>

          <input
            id="videoUrl"
            name="videoUrl"
            type="url"
            inputMode="url"
            placeholder="https://youtu.be/..."
            className={fieldClass(
              state.errors.videoUrl,
            )}
          />

          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Bitta video — mavzudagi barcha misollar uchun.
          </p>

          {state.errors.videoUrl && (
            <p
              role="alert"
              className="mt-1.5 text-sm font-medium text-red-600"
            >
              {state.errors.videoUrl}
            </p>
          )}
        </>
      )}

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
        className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Mavzu qo‘shilmoqda..."
          : "Mavzuni qo‘shish"}
      </SubmitButton>
    </form>
  );
}