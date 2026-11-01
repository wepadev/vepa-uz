"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/ui/submit-button";
import {
  initialFormState,
  type FormState,
} from "@/lib/form-state";

type CreateStudentFormProps = {
  action: (
    previousState: FormState,
    formData: FormData,
  ) => Promise<FormState>;
};

export default function CreateStudentForm({
  action,
}: CreateStudentFormProps) {
  const [state, formAction, pending] =
    useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-2xl font-bold">
        Yangi foydalanuvçi
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Öquvçiga email va vaqtinçalik
        parol beriladi.
      </p>

      <label
        htmlFor="fullName"
        className="mt-6 block text-sm font-semibold"
      >
        Ism va familiya
      </label>

      <input
        id="fullName"
        name="fullName"
        type="text"
        placeholder="Masalan: Ali Valiyev"
        aria-invalid={Boolean(
          state.errors.fullName,
        )}
        className={`mt-2 w-full rounded-xl bg-white px-4 py-3 outline-none ${
          state.errors.fullName
            ? "border border-red-400 focus:ring-2 focus:ring-red-100"
            : "border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        }`}
      />

      {state.errors.fullName && (
        <p className="mt-1.5 text-sm font-medium text-red-600">
          {state.errors.fullName}
        </p>
      )}

      <label
        htmlFor="email"
        className="mt-5 block text-sm font-semibold"
      >
        Email
      </label>

      <input
        id="email"
        name="email"
        type="email"
        placeholder="ali@gmail.com"
        autoComplete="off"
        aria-invalid={Boolean(
          state.errors.email,
        )}
        className={`mt-2 w-full rounded-xl bg-white px-4 py-3 outline-none ${
          state.errors.email
            ? "border border-red-400 focus:ring-2 focus:ring-red-100"
            : "border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        }`}
      />

      {state.errors.email && (
        <p
          role="alert"
          className="mt-1.5 text-sm font-medium text-red-600"
        >
          {state.errors.email}
        </p>
      )}

      <label
        htmlFor="password"
        className="mt-5 block text-sm font-semibold"
      >
        Vaqtinçalik parol
      </label>

      <input
        id="password"
        name="password"
        type="text"
        placeholder="Kamida 8 ta belgi"
        autoComplete="new-password"
        aria-invalid={Boolean(
          state.errors.password,
        )}
        className={`mt-2 w-full rounded-xl bg-white px-4 py-3 font-mono outline-none ${
          state.errors.password
            ? "border border-red-400 focus:ring-2 focus:ring-red-100"
            : "border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        }`}
      />

      {state.errors.password && (
        <p className="mt-1.5 text-sm font-medium text-red-600">
          {state.errors.password}
        </p>
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

      <SubmitButton
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Yaratilmoqda..."
          : "Foydalanuvçini yaratiş"}
      </SubmitButton>
    </form>
  );
}