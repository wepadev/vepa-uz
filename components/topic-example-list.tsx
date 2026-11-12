"use client";

import { useState } from "react";

import { ChevronDown, Play } from "@/components/ui/icons";

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
    <ol className="divide-y divide-mb-line overflow-hidden rounded-2xl border border-mb-line bg-white">
      {examples.map((example) => {
        const empty = !example.videoUrl;
        const open = openId === example.id;

        const icon = (
          <span
            className={
              empty
                ? "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400"
                : "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mb-tint text-mb-brandDark"
            }
          >
            <Play
              className="ml-0.5 h-4 w-4"
              fill="currentColor"
              strokeWidth={0}
              aria-hidden="true"
            />
          </span>
        );

        const label = (
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[15px] font-bold leading-6 text-mb-ink">
              {example.label}
            </span>

            <span className="block text-[13px] text-mb-muted">
              {empty ? "Video hali yöq" : "Videoyeçim"}
            </span>
          </span>
        );

        if (empty) {
          return (
            <li
              key={example.id}
              className="flex items-center gap-3 px-3.5 py-3 opacity-70"
            >
              {icon}
              {label}
            </li>
          );
        }

        return (
          <li
            key={example.id}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : example.id)}
              className="flex min-h-11 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-50"
            >
              {icon}
              {label}

              <ChevronDown
                className={
                  open
                    ? "h-5 w-5 shrink-0 rotate-180 text-mb-brand transition-transform"
                    : "h-5 w-5 shrink-0 text-slate-400 transition-transform"
                }
                aria-hidden="true"
              />
            </button>

            {open && (
              <div className="bg-slate-50 p-3">
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
