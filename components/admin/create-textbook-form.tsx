"use client";

import {
  useActionState,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

import AppAlert from "@/components/ui/app-alert";
import { Spinner } from "@/components/ui/spinner";
import { GRADES } from "@/lib/grades";

type BookType = "school" | "popular";

type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  errors: Record<string, string>;
};

type CreateTextbookFormProps = {
  action: (
    previousState: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
};

const initialState: ActionState = {
  status: "idle",
  message: "",
  errors: {},
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-mb-brand px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-mb-brandDark disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner size="sm" />
          Darslik yaratilmoqda...
        </span>
      ) : (
        "Darslik yaratiş"
      )}
    </button>
  );
}

export default function CreateTextbookForm({
  action,
}: CreateTextbookFormProps) {
  const [state, formAction] =
    useActionState(action, initialState);

  const [bookType, setBookType] =
    useState<BookType>("school");

  const inputClass =
    "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-mb-brand focus:ring-4 focus:ring-blue-100";

  const errorInputClass =
    "mt-2 w-full rounded-2xl border border-red-300 bg-red-50 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-mb-brand">
        Yangi darslik
      </p>

      <h2 className="mt-2 text-2xl font-bold text-slate-950">
        Darslik qöşiş
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Avval turini tanlang. Maktab darsligi uçun
        sinf majburiy, maşhur darslik uçun muallifni
        yoziş mumkin.
      </p>

      <form
        action={formAction}
        className="mt-6 space-y-5"
      >
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Darslik turi
          </p>

          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label
              className={
                bookType === "school"
                  ? "cursor-pointer rounded-2xl border-2 border-mb-brand bg-blue-50 p-4"
                  : "cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
              }
            >
              <input
                type="radio"
                name="bookType"
                value="school"
                checked={bookType === "school"}
                onChange={() =>
                  setBookType("school")
                }
                className="sr-only"
              />

              <span className="block font-bold text-slate-900">
                Maktab darsligi
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Sinflar böyiça darsliklar
              </span>
            </label>

            <label
              className={
                bookType === "popular"
                  ? "cursor-pointer rounded-2xl border-2 border-mb-brand bg-blue-50 p-4"
                  : "cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
              }
            >
              <input
                type="radio"
                name="bookType"
                value="popular"
                checked={bookType === "popular"}
                onChange={() =>
                  setBookType("popular")
                }
                className="sr-only"
              />

              <span className="block font-bold text-slate-900">
                Maşhur darslik
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Mualliflik va ommabop kitoblar
              </span>
            </label>
          </div>

          {state.errors.bookType && (
            <p className="mt-2 text-sm font-medium text-red-600">
              {state.errors.bookType}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="textbook-title"
            className="text-sm font-semibold text-slate-700"
          >
            Darslik nomi
          </label>

          <input
            id="textbook-title"
            name="title"
            required
            maxLength={150}
            placeholder={
              bookType === "school"
                ? "Masalan: 8-sinf Algebra"
                : "Masalan: Matematikadan masalalar töplami"
            }
            className={
              state.errors.title
                ? errorInputClass
                : inputClass
            }
          />

          {state.errors.title && (
            <p className="mt-2 text-sm font-medium text-red-600">
              {state.errors.title}
            </p>
          )}
        </div>

        {bookType === "school" ? (
          <div>
            <label
              htmlFor="textbook-grade"
              className="text-sm font-semibold text-slate-700"
            >
              Sinf
            </label>

            <select
              id="textbook-grade"
              name="grade"
              required
              defaultValue=""
              className={
                state.errors.grade
                  ? errorInputClass
                  : inputClass
              }
            >
              <option value="" disabled>
                Sinfni tanlang
              </option>

              {GRADES.map((grade) => (
                <option
                  key={grade}
                  value={grade}
                >
                  {grade}-sinf
                </option>
              ))}
            </select>

            {state.errors.grade && (
              <p className="mt-2 text-sm font-medium text-red-600">
                {state.errors.grade}
              </p>
            )}
          </div>
        ) : (
          <input
            type="hidden"
            name="grade"
            value=""
          />
        )}

        <div>
          <label
            htmlFor="textbook-author"
            className="text-sm font-semibold text-slate-700"
          >
            Muallif
            <span className="ml-1 font-normal text-slate-400">
              (ixtiyoriy)
            </span>
          </label>

          <input
            id="textbook-author"
            name="authorName"
            maxLength={150}
            placeholder="Muallif yoki mualliflar"
            className={
              state.errors.authorName
                ? errorInputClass
                : inputClass
            }
          />

          {state.errors.authorName && (
            <p className="mt-2 text-sm font-medium text-red-600">
              {state.errors.authorName}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="textbook-cover-file"
            className="text-sm font-semibold text-slate-700"
          >
            Muqova rasmi
            <span className="ml-1 font-normal text-slate-400">
              (ixtiyoriy)
            </span>
          </label>

          <input
            id="textbook-cover-file"
            name="coverImage"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mb-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-mb-brandDark"
          />

          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            PNG, JPG yoki WEBP; 2.5 MB gaça. Kitob suratini
            töğridan-töğri yuklaşingiz mumkin — havola şart
            emas.
          </p>

          {state.errors.coverImage && (
            <p className="mt-2 text-sm font-medium text-red-600">
              {state.errors.coverImage}
            </p>
          )}

          <details className="mt-2">
            <summary className="cursor-pointer list-none text-xs font-semibold text-mb-brand">
              Yoki tayyor havola qöyiş
            </summary>

            <input
              id="textbook-cover"
              name="coverUrl"
              type="url"
              placeholder="https://..."
              className={
                state.errors.coverUrl
                  ? errorInputClass
                  : inputClass
              }
            />

            {state.errors.coverUrl && (
              <p className="mt-2 text-sm font-medium text-red-600">
                {state.errors.coverUrl}
              </p>
            )}
          </details>
        </div>

        {state.status === "error" &&
          state.message && (
            <AppAlert
              variant="error"
              title="Darslik yaratilmadi"
            >
              {state.message}
            </AppAlert>
          )}

        {state.status === "success" &&
          state.message && (
            <AppAlert
              variant="success"
              title="Darslik yaratildi"
            >
              {state.message}
            </AppAlert>
          )}

        <SubmitButton />
      </form>
    </section>
  );
}
