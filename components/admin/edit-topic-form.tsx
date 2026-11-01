"use client";

import {
  useActionState,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import SubmitButton from "@/components/ui/submit-button";

import {
  initialFormState,
  type FormState,
} from "@/lib/form-state";

type EditTopicFormProps = {
  textbookId: number;
  topicId: number;
  title: string;
  /** Mavzu videoyechimi — maktab darsligida bitta videoda hamma misollar */
  videoUrl?: string | null;
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

export default function EditTopicForm({
  textbookId,
  topicId,
  title,
  videoUrl,
  showVideo = true,
  action,
}: EditTopicFormProps) {
  const router = useRouter();

  const [state, formAction, pending] =
    useActionState(action, initialFormState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <form
      action={formAction}
      noValidate
      className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <input
        type="hidden"
        name="textbookId"
        value={textbookId}
      />

      <input
        type="hidden"
        name="topicId"
        value={topicId}
      />

      <label
        htmlFor={`topic-title-${topicId}`}
        className="block text-sm font-semibold"
      >
        Mavzu nomi
      </label>

      <input
        id={`topic-title-${topicId}`}
        name="title"
        type="text"
        defaultValue={title}
        className={
          state.errors.title
            ? "mt-2 w-full rounded-xl border border-red-400 bg-white px-4 py-3 text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            : "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        }
      />

      {state.errors.title && (
        <p className="mt-1.5 text-sm font-medium text-red-600">
          {state.errors.title}
        </p>
      )}

      {showVideo && (
        <>
          <label
            htmlFor={`topic-video-${topicId}`}
            className="mt-4 block text-sm font-semibold"
          >
            Videoyeçim havolasi{" "}
            <span className="font-normal text-slate-500">
              (ixtiyoriy)
            </span>
          </label>

          <input
            id={`topic-video-${topicId}`}
            name="videoUrl"
            type="url"
            inputMode="url"
            placeholder="https://youtu.be/..."
            defaultValue={videoUrl ?? ""}
            className={
              state.errors.videoUrl
                ? "mt-2 w-full rounded-xl border border-red-400 bg-white px-4 py-3 text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                : "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            }
          />

          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Bitta video — mavzudagi barça misollar uçun. Böş
            qoldirsangiz video körsatilmaydi.
          </p>

          {state.errors.videoUrl && (
            <p className="mt-1.5 text-sm font-medium text-red-600">
              {state.errors.videoUrl}
            </p>
          )}
        </>
      )}

      {state.status === "error" &&
        state.message && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {state.message}
          </div>
        )}

      {state.status === "success" &&
        state.message && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {state.message}
          </div>
        )}

      <SubmitButton
        disabled={pending}
        className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Saqlanmoqda..."
          : "Özgarişni saqlaş"}
      </SubmitButton>
    </form>
  );
}