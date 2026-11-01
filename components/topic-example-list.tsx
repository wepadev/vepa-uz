"use client";

import { useState } from "react";

import { ChevronDown, Play } from "lucide-react";

import YouTubeEmbed from "@/components/youtube-embed";

export type TopicExample = {
  id: number;
  label: string;
  videoUrl: string | null;
};

type TopicExampleListProps = {
  examples: TopicExample[];
};

/**
 * Mavzu misollari ro'yxati — har bir misolning o'z videoyechimi.
 *
 * Video faqat bosilganda ochiladi va bir vaqtda bittasi ochiq turadi.
 * Sabab: mavzuda 30-40 ta misol bo'lishi mumkin, hammasini birdan
 * yuklasa telefonda sahifa og'irlashib ketadi.
 */
export default function TopicExampleList({
  examples,
}: TopicExampleListProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <ol className="grid gap-2.5">
      {examples.map((example) => {
        const empty = !example.videoUrl;
        const open = openId === example.id;

        const icon = (
          <span
            className={
              empty
                ? "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-400"
                : "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mb-brand text-white shadow-sm"
            }
          >
            <Play className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
          </span>
        );

        const label = (
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[15px] font-semibold leading-6 text-mb-ink">
              {example.label}
            </span>

            <span className="mt-0.5 block text-xs text-mb-muted">
              {empty ? "Video hali yöq" : "Videoyeçim"}
            </span>
          </span>
        );

        if (empty) {
          return (
            <li
              key={example.id}
              className="flex items-center gap-3 rounded-2xl border border-mb-line bg-slate-50 px-3 py-3 shadow-sm"
            >
              {icon}
              {label}
            </li>
          );
        }

        return (
          <li
            key={example.id}
            className="overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : example.id)}
              className="flex min-h-11 w-full items-center gap-3 px-3 py-3 text-left transition sm:hover:bg-slate-50"
            >
              {icon}
              {label}

              <ChevronDown
                className={
                  open
                    ? "h-5 w-5 shrink-0 rotate-180 text-mb-brand transition-transform"
                    : "h-5 w-5 shrink-0 text-mb-muted transition-transform"
                }
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </button>

            {open && (
              <div className="border-t border-mb-line p-3">
                <YouTubeEmbed
                  url={example.videoUrl}
                  title={`${example.label} — videoyeçim`}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
