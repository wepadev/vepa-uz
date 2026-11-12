"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "@/components/ui/icons";

import { formatPageRange, parsePageRange } from "@/lib/pdf-ink";
import { cn } from "@/lib/utils";

type ExportPanelProps = {
  pageCount: number;
  currentPage: number;
  /** Qaysi betlarda yozuv bor — tanlashni osonlashtirish uchun belgilanadi */
  inked: boolean[];
  saving: boolean;
  onExport: (indexes: number[]) => void;
  onClose: () => void;
};

/**
 * PDF saqlash oynasi: hamma betlar yoki faqat belgilanganlari.
 *
 * Betlar raqamli katakchalarni bosib yoki "1-3, 5" kabi yozib
 * tanlanadi — ikkalasi bir-biriga bog'langan.
 */
export default function ExportPanel({
  pageCount,
  currentPage,
  inked,
  saving,
  onExport,
  onClose,
}: ExportPanelProps) {
  const [mode, setMode] = useState<"all" | "some">("all");
  const [selected, setSelected] = useState<number[]>([currentPage]);
  const [rangeText, setRangeText] = useState(formatPageRange([currentPage]));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function choose(next: number[]) {
    const clean = [...new Set(next)].filter((i) => i >= 0 && i < pageCount).sort((a, b) => a - b);
    setSelected(clean);
    setRangeText(formatPageRange(clean));
    setMode("some");
  }

  function toggle(index: number) {
    choose(selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index]);
  }

  const indexes = mode === "all" ? [...Array(pageCount).keys()] : selected;
  const inkedIndexes = inked.flatMap((has, i) => (has ? [i] : []));

  const quick = "rounded-lg border border-mb-line px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-mb-brand";

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-label="PDF saqlaş"
        className="absolute right-2 top-full z-40 mt-1 w-[min(24rem,calc(100vw-1rem))] rounded-2xl border border-mb-line bg-white p-4 shadow-xl"
      >
        <p className="text-base font-bold text-mb-ink">PDF saqlaş</p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
          {(
            [
              ["all", `Hamma betlar (${pageCount})`],
              ["some", "Tanlangan betlar"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "rounded-xl px-3 py-2.5 transition",
                mode === value ? "bg-mb-tint text-mb-brandDark" : "bg-slate-50 text-slate-700 hover:bg-slate-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "some" && (
          <>
            <label className="mt-3 block text-xs font-semibold text-mb-muted" htmlFor="export-range">
              Betlar (masalan: 1-3, 5)
            </label>
            <input
              id="export-range"
              value={rangeText}
              onChange={(event) => {
                setRangeText(event.target.value);
                setSelected(parsePageRange(event.target.value, pageCount));
              }}
              inputMode="numeric"
              className="mt-1 h-10 w-full rounded-xl border border-mb-line px-3 text-sm text-mb-ink outline-none focus:border-mb-brand"
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" className={quick} onClick={() => choose([currentPage])}>
                Joriy bet
              </button>
              {inkedIndexes.length > 0 && (
                <button type="button" className={quick} onClick={() => choose(inkedIndexes)}>
                  Yozuvli betlar
                </button>
              )}
              <button type="button" className={quick} onClick={() => choose([])}>
                Tozalaş
              </button>
            </div>

            <div className="mt-3 grid max-h-48 grid-cols-8 gap-1.5 overflow-y-auto pr-1">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={selected.includes(i)}
                  aria-label={`${i + 1}-bet`}
                  onClick={() => toggle(i)}
                  className={cn(
                    "relative h-9 rounded-lg text-sm font-semibold tabular-nums transition",
                    selected.includes(i)
                      ? "bg-mb-brand text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {i + 1}
                  {inked[i] && (
                    <span
                      className={cn(
                        "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
                        selected.includes(i) ? "bg-white" : "bg-mb-brand",
                      )}
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-mb-muted">Nuqta — betda yozuv bor.</p>
          </>
        )}

        <button
          type="button"
          disabled={saving || indexes.length === 0}
          onClick={() => onExport(indexes)}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-mb-brand text-sm font-semibold text-white transition hover:bg-mb-brandDark disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
          {indexes.length === 0
            ? "Bet tanlanmagan"
            : `${indexes.length} ta betni saqlaş`}
        </button>
      </div>
    </>
  );
}
