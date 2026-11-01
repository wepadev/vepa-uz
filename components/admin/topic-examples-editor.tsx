"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import SubmitButton from "@/components/ui/submit-button";
import {
  initialFormState,
  type FormState,
} from "@/lib/form-state";

export type AdminExample = {
  id: number;
  label: string;
  videoUrl: string | null;
  orderNumber: number;
};

type ServerAction = (
  previousState: FormState,
  formData: FormData,
) => Promise<FormState>;

type TopicExamplesEditorProps = {
  textbookId: number;
  topicId: number;
  examples: AdminExample[];
  addAction: ServerAction;
  updateAction: ServerAction;
  deleteAction: (formData: FormData) => Promise<void>;
};

function fieldClass(error?: string) {
  return [
    "w-full rounded-xl bg-white px-3 py-2.5 text-sm",
    "text-slate-900 placeholder:text-slate-400",
    "outline-none transition",
    error
      ? "border border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
      : "border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
  ].join(" ");
}

/**
 * Bitta misol qatori: ko'rsatish va tahrirlash.
 */
function ExampleRow({
  textbookId,
  topicId,
  example,
  updateAction,
  deleteAction,
}: {
  textbookId: number;
  topicId: number;
  example: AdminExample;
  updateAction: ServerAction;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const [state, formAction, pending] = useActionState(
    updateAction,
    initialFormState,
  );

  useEffect(() => {
    if (state.status === "success") {
      setEditing(false);
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
          {example.orderNumber}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">
            {example.label}
          </span>

          {example.videoUrl ? (
            <a
              href={example.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block truncate text-xs text-mb-brand hover:text-mb-brandDark"
            >
              {example.videoUrl}
            </a>
          ) : (
            <span className="mt-0.5 block text-xs font-semibold text-amber-700">
              Video hali yöq
            </span>
          )}
        </span>

        <span className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="min-h-9 rounded-lg px-3 text-xs font-semibold text-mb-brand hover:bg-slate-100"
          >
            {editing ? "Yopiş" : "Tahrirlaş"}
          </button>

          <form action={deleteAction}>
            <input type="hidden" name="textbookId" value={textbookId} />
            <input type="hidden" name="topicId" value={topicId} />
            <input type="hidden" name="exampleId" value={example.id} />

            <SubmitButton className="min-h-9 rounded-lg px-3 text-xs font-semibold text-red-600 hover:bg-red-50">
              Öçiriş
            </SubmitButton>
          </form>
        </span>
      </div>

      {editing && (
        <form
          action={formAction}
          noValidate
          className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto]"
        >
          <input type="hidden" name="textbookId" value={textbookId} />
          <input type="hidden" name="topicId" value={topicId} />
          <input type="hidden" name="exampleId" value={example.id} />

          <input
            name="label"
            type="text"
            defaultValue={example.label}
            placeholder="12-misol"
            aria-label="Misol nomi"
            className={fieldClass(state.errors.label)}
          />

          <input
            name="videoUrl"
            type="url"
            inputMode="url"
            defaultValue={example.videoUrl ?? ""}
            placeholder="https://youtu.be/..."
            aria-label="Video havolasi"
            className={fieldClass(state.errors.videoUrl)}
          />

          <SubmitButton
            disabled={pending}
            className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Saqlanmoqda..." : "Saqlaş"}
          </SubmitButton>

          {state.status === "error" && state.message && (
            <p
              role="alert"
              className="text-sm font-medium text-red-600 sm:col-span-3"
            >
              {state.message}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

/**
 * Misollarni qo'shish formasi.
 *
 * Har bir qator — bitta misol: `nomi | video havolasi`. Bir mavzuda
 * o'nlab misol bo'ladi, shuning uchun bittalab emas, ro'yxat bilan
 * kiritiladi: kitobdan ko'chirib qo'yish yetarli.
 */
function AddExamplesForm({
  textbookId,
  topicId,
  addAction,
}: {
  textbookId: number;
  topicId: number;
  addAction: ServerAction;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(
    addAction,
    initialFormState,
  );

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
      className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <input type="hidden" name="textbookId" value={textbookId} />
      <input type="hidden" name="topicId" value={topicId} />

      <label
        htmlFor={`lines-${topicId}`}
        className="block text-sm font-semibold text-slate-900"
      >
        Misol qöşiş
      </label>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        Har bir qator — bitta misol. Nomi va havolasi orasiga{" "}
        <code className="rounded bg-white px-1 py-0.5 font-mono">|</code>{" "}
        belgisini qöying. Havolasiz ham qöşsa böladi — videoni
        keyinroq qöyasiz.
      </p>

      <textarea
        id={`lines-${topicId}`}
        name="lines"
        rows={4}
        spellCheck={false}
        placeholder={"1-misol | https://youtu.be/xxxxxxxxxxx\n2-misol | https://youtu.be/yyyyyyyyyyy\n3-misol"}
        className={`mt-3 font-mono ${fieldClass(state.errors.lines)}`}
      />

      {state.errors.lines && (
        <p
          role="alert"
          className="mt-2 whitespace-pre-line text-sm font-medium text-red-600"
        >
          {state.errors.lines}
        </p>
      )}

      {state.status === "error" && state.message && !state.errors.lines && (
        <p
          role="alert"
          className="mt-2 text-sm font-medium text-red-600"
        >
          {state.message}
        </p>
      )}

      {state.status === "success" && state.message && (
        <p
          role="status"
          className="mt-2 text-sm font-medium text-emerald-700"
        >
          {state.message}
        </p>
      )}

      <SubmitButton
        disabled={pending}
        className="mt-3 min-h-11 w-full rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Qöşilmoqda..." : "Misollarni qöşiş"}
      </SubmitButton>
    </form>
  );
}

export default function TopicExamplesEditor({
  textbookId,
  topicId,
  examples,
  addAction,
  updateAction,
  deleteAction,
}: TopicExamplesEditorProps) {
  const withVideo = examples.filter(
    (example) => Boolean(example.videoUrl),
  ).length;

  return (
    <details className="mt-1">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand hover:text-mb-brandDark">
        Misollar — {examples.length} ta
        {examples.length > 0 ? `, ${withVideo} tasida video bor` : ""}
      </summary>

      {examples.length > 0 && (
        <ul className="mt-4 space-y-2">
          {examples.map((example) => (
            <ExampleRow
              key={`${example.id}-${example.label}-${example.videoUrl ?? ""}`}
              textbookId={textbookId}
              topicId={topicId}
              example={example}
              updateAction={updateAction}
              deleteAction={deleteAction}
            />
          ))}
        </ul>
      )}

      <AddExamplesForm
        textbookId={textbookId}
        topicId={topicId}
        addAction={addAction}
      />
    </details>
  );
}
