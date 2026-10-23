"use client";

import { useActionState, useMemo, useState } from "react";

import {
  CheckCircle2,
  CircleSlash,
  MinusCircle,
  XCircle,
} from "lucide-react";

import SubmitButton from "@/components/ui/submit-button";
import type { CheckResult } from "@/lib/answer-check";

export type TopicOption = {
  n: number;
  title: string;
  /** Har bir test turidagi savollar soni (4 ta) */
  counts: number[];
};

export type CheckState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "done";
      topicTitle: string;
      testLabel: string;
      result: CheckResult;
    };

export const initialCheckState: CheckState = { status: "idle" };

type TestCheckerProps = {
  topics: TopicOption[];
  testLabels: readonly string[];
  action: (
    previousState: CheckState,
    formData: FormData,
  ) => Promise<CheckState>;
};

/** Faqat A-D harflari va ? — jonli hisob uchun */
function countAnswers(raw: string) {
  let n = 0;

  for (const ch of raw.toUpperCase()) {
    if (ch === "A" || ch === "B" || ch === "C" || ch === "D" || ch === "?") {
      n += 1;
    }
  }

  return n;
}

export default function TestChecker({
  topics,
  testLabels,
  action,
}: TestCheckerProps) {
  const [topicN, setTopicN] = useState(topics[0]?.n ?? 1);
  const [slot, setSlot] = useState(0);
  const [raw, setRaw] = useState("");

  const [state, formAction, pending] = useActionState(
    action,
    initialCheckState,
  );

  const topic = useMemo(
    () => topics.find((item) => item.n === topicN) ?? topics[0],
    [topics, topicN],
  );

  const expected = topic?.counts[slot] ?? 0;
  const given = countAnswers(raw);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      {/* ---------------- Chap ustun: kiritish ---------------- */}
      <form
        action={formAction}
        className="rounded-2xl border border-mb-line bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-bold text-mb-ink">Tekshirish</h2>

        <p className="mt-1 text-sm text-mb-muted">
          Mavzu va testni tanlang, so‘ng belgilagan javoblaringizni
          ketma-ket yozing.
        </p>

        {/* Mavzu */}
        <label
          htmlFor="topicN"
          className="mt-5 block text-sm font-semibold text-mb-ink"
        >
          Mavzu
        </label>

        <select
          id="topicN"
          name="topicN"
          value={topicN}
          onChange={(event) => setTopicN(Number(event.target.value))}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-mb-ink outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
        >
          {topics.map((item) => (
            <option key={item.n} value={item.n}>
              {item.n}. {item.title}
            </option>
          ))}
        </select>

        {/* Test turi */}
        <p className="mt-5 text-sm font-semibold text-mb-ink">Test</p>

        <input type="hidden" name="slot" value={slot} />

        <div className="mt-2 grid grid-cols-2 gap-2">
          {testLabels.map((label, index) => {
            const active = index === slot;
            const count = topic?.counts[index] ?? 0;

            return (
              <button
                key={label}
                type="button"
                onClick={() => setSlot(index)}
                aria-pressed={active}
                className={[
                  "min-h-11 rounded-xl border px-3 text-sm font-semibold transition",
                  active
                    ? "border-mb-brand bg-mb-brand text-white shadow-sm"
                    : "border-slate-300 bg-white text-mb-ink hover:bg-slate-50",
                ].join(" ")}
              >
                {label}
                <span
                  className={
                    active
                      ? "mt-0.5 block text-[11px] font-medium text-blue-100"
                      : "mt-0.5 block text-[11px] font-medium text-mb-muted"
                  }
                >
                  {count} ta savol
                </span>
              </button>
            );
          })}
        </div>

        {/* Javoblar */}
        <div className="mt-5 flex items-baseline justify-between gap-3">
          <label
            htmlFor="answers"
            className="text-sm font-semibold text-mb-ink"
          >
            Javoblaringiz
          </label>

          <span
            className={
              given === expected
                ? "text-xs font-bold text-emerald-700"
                : "text-xs font-semibold text-mb-muted"
            }
          >
            {given} / {expected}
          </span>
        </div>

        <textarea
          id="answers"
          name="answers"
          rows={4}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          spellCheck={false}
          placeholder="ABCDABCDAB..."
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm uppercase tracking-[0.2em] text-mb-ink outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
        />

        <p className="mt-1.5 text-xs leading-5 text-mb-muted">
          Faqat A, B, C, D harflari olinadi — raqam, nuqta va bo‘sh joy
          yozsangiz ham bo‘ladi. Bir savolni o‘tkazib yuborgan bo‘lsangiz
          o‘rniga <code className="rounded bg-slate-100 px-1">?</code>{" "}
          qo‘ying.
        </p>

        {state.status === "error" && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {state.message}
          </p>
        )}

        <SubmitButton
          disabled={pending}
          className="mt-5 min-h-11 w-full rounded-xl bg-mb-brand px-4 text-sm font-bold text-white transition hover:bg-mb-brandDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Tekshirilmoqda..." : "Tekshirish"}
        </SubmitButton>
      </form>

      {/* ---------------- O'ng ustun: natija ---------------- */}
      <div>
        {state.status === "done" ? (
          <CheckReport state={state} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <h3 className="text-base font-bold text-mb-ink">
              Natija shu yerda chiqadi
            </h3>

            <p className="mt-1.5 text-sm text-mb-muted">
              Javoblarni kiritib “Tekshirish” tugmasini bosing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "correct" | "wrong" | "blank" | "nokey";
}) {
  const tones = {
    correct: "border-emerald-200 bg-emerald-50 text-emerald-800",
    wrong: "border-red-200 bg-red-50 text-red-800",
    blank: "border-amber-200 bg-amber-50 text-amber-800",
    nokey: "border-mb-line bg-slate-50 text-slate-700",
  } as const;

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-xs font-semibold">{label}</p>
    </div>
  );
}

function CheckReport({
  state,
}: {
  state: Extract<CheckState, { status: "done" }>;
}) {
  const { result, topicTitle, testLabel } = state;

  const marks = {
    correct: {
      Icon: CheckCircle2,
      box: "border-emerald-200 bg-emerald-50",
      num: "text-emerald-700",
      icon: "text-emerald-600",
    },
    wrong: {
      Icon: XCircle,
      box: "border-red-200 bg-red-50",
      num: "text-red-700",
      icon: "text-red-600",
    },
    blank: {
      Icon: MinusCircle,
      box: "border-amber-200 bg-amber-50",
      num: "text-amber-700",
      icon: "text-amber-600",
    },
    nokey: {
      Icon: CircleSlash,
      box: "border-mb-line bg-slate-50",
      num: "text-slate-600",
      icon: "text-slate-400",
    },
  } as const;

  return (
    <div className="rounded-2xl border border-mb-line bg-white p-5 shadow-sm">
      {/* Sarlavha va foiz */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-mb-ink">{topicTitle}</h2>
          <p className="mt-0.5 text-sm text-mb-muted">{testLabel}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-4xl font-bold leading-none text-mb-ink">
            {result.percent}%
          </p>
          <p className="mt-1 text-xs font-semibold text-mb-muted">
            {result.correct} / {result.total} to‘g‘ri
          </p>
        </div>
      </div>

      {/* Ko'rsatkichlar */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="To‘g‘ri" value={result.correct} tone="correct" />
        <StatTile label="Xato" value={result.wrong} tone="wrong" />
        <StatTile label="Bo‘sh" value={result.blank} tone="blank" />
        <StatTile label="Kaliti yo‘q" value={result.noKey} tone="nokey" />
      </div>

      {result.extraCount > 0 && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {result.extraCount} ta ortiqcha javob yozilgan — testda{" "}
          {result.expectedCount} ta savol bor, ortiqchasi hisobga olinmadi.
        </p>
      )}

      {/* Savollar bo'yicha */}
      <h3 className="mt-6 text-sm font-bold text-mb-ink">
        Savollar bo‘yicha
      </h3>

      <ol className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {result.rows.map((row) => {
          const style = marks[row.mark];
          const { Icon } = style;

          return (
            <li
              key={row.n}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${style.box}`}
            >
              <span
                className={`w-6 shrink-0 text-right text-sm font-bold tabular-nums ${style.num}`}
              >
                {row.n}
              </span>

              <Icon
                className={`h-4 w-4 shrink-0 ${style.icon}`}
                strokeWidth={2.2}
                aria-hidden="true"
              />

              <span className="min-w-0 flex-1 text-sm">
                {row.mark === "correct" && (
                  <span className="font-bold text-emerald-800">
                    {row.given}
                  </span>
                )}

                {row.mark === "wrong" && (
                  <span className="font-semibold text-red-800">
                    <span className="line-through opacity-70">
                      {row.given}
                    </span>{" "}
                    → <span className="font-bold">{row.key}</span>
                  </span>
                )}

                {row.mark === "blank" && (
                  <span className="font-semibold text-amber-800">
                    bo‘sh → <span className="font-bold">{row.key}</span>
                  </span>
                )}

                {row.mark === "nokey" && (
                  <span className="text-xs font-semibold text-slate-600">
                    kalit yo‘q
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
