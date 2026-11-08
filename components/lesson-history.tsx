"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coins,
  ListChecks,
  Star,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type LessonHistoryRow = {
  lesson_date: string;
  topic: string | null;
  attendance: string;
  behavior: number | null;
  homework: number;
  points: number;
  coins: number;
  note: string | null;
};

const ATTENDANCE_LABEL: Record<string, string> = {
  keldi: "Keldi",
  kechikdi: "Keçikdi",
  sababli: "Sababli",
  kelmadi: "Kelmadi",
};

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

/**
 * Dars tarixi bitta-bittadan ko'rsatiladi.
 *
 * Ro'yxat eng yangi darsdan boshlanadi, shuning uchun "Oldingi"
 * indeksni oshiradi, "Keyingi" esa kamaytiradi.
 */
export default function LessonHistory({
  rows,
}: {
  rows: LessonHistoryRow[];
}) {
  const [index, setIndex] = useState(0);

  const row = rows[index];

  if (!row) {
    return null;
  }

  const hasOlder = index < rows.length - 1;
  const hasNewer = index > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
      {/* Boshqaruv */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2">
        <button
          type="button"
          onClick={() => setIndex((value) => value + 1)}
          disabled={!hasOlder}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-mb-brand transition disabled:text-slate-300 sm:hover:bg-white sm:disabled:hover:bg-transparent"
        >
          <ChevronLeft
            className="h-4 w-4"
            strokeWidth={2.4}
            aria-hidden="true"
          />
          Oldingi
        </button>

        <p className="text-xs font-semibold text-mb-muted">
          {rows.length - index} / {rows.length}
        </p>

        <button
          type="button"
          onClick={() => setIndex((value) => value - 1)}
          disabled={!hasNewer}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-mb-brand transition disabled:text-slate-300 sm:hover:bg-white sm:disabled:hover:bg-transparent"
        >
          Keyingi
          <ChevronRight
            className="h-4 w-4"
            strokeWidth={2.4}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Dars */}
      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[15px] font-bold text-mb-ink">
            <CalendarDays
              className="h-4 w-4 text-mb-muted"
              strokeWidth={2}
              aria-hidden="true"
            />
            {formatLongDate(row.lesson_date)}
          </p>

          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              row.attendance === "keldi" &&
                "bg-emerald-50 text-emerald-700",
              row.attendance === "kechikdi" &&
                "bg-amber-50 text-amber-700",
              row.attendance === "sababli" &&
                "bg-slate-100 text-slate-600",
              row.attendance === "kelmadi" && "bg-red-50 text-red-700",
            )}
          >
            {ATTENDANCE_LABEL[row.attendance] ?? row.attendance}
          </span>
        </div>

        <p className="mt-1 text-sm leading-6 text-mb-muted">
          {row.topic ?? "Mavzu yozilmagan"}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 px-2 py-3 text-center">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-mb-muted">
              <ListChecks
                className="h-3.5 w-3.5"
                strokeWidth={2}
                aria-hidden="true"
              />
              Vazifa
            </p>
            <p className="mt-1 text-xl font-bold text-mb-ink">
              {row.homework}
            </p>
          </div>

          <div className="rounded-xl bg-mb-tintSoft px-2 py-3 text-center">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-mb-muted">
              <Star
                className="h-3.5 w-3.5"
                strokeWidth={2}
                aria-hidden="true"
              />
              Ball
            </p>
            <p className="mt-1 text-xl font-bold text-mb-brand">
              {row.points}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 px-2 py-3 text-center">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              <Coins
                className="h-3.5 w-3.5"
                strokeWidth={2}
                aria-hidden="true"
              />
              Tanga
            </p>
            <p className="mt-1 text-xl font-bold text-amber-600">
              {row.coins}
            </p>
          </div>
        </div>

        {row.note && (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-mb-muted">
            <span className="font-semibold text-mb-ink">Ustoz izohi: </span>
            {row.note}
          </p>
        )}
      </div>
    </div>
  );
}
