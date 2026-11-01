import Link from "next/link";
import {
  BookOpen,
  Check,
  Crown,
  Layers,
  Lock,
  Play,
  SignalHigh,
} from "lucide-react";

import { getYouTubeThumbnail } from "@/lib/youtube";
import { cn } from "@/lib/utils";

type LessonCardProps = {
  lessonId: number;
  orderNumber: number;
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  categoryTitle: string;
  isFree: boolean;
  isCompleted: boolean;
  /** Tarif bo'yicha kirish huquqi bor */
  hasContentAccess: boolean;
  /** Oldingi darslar bajarilgan */
  isSequenceUnlocked: boolean;
  /** Darsga biriktirilgan testlar soni */
  testCount: number;
  /** Testlarning o'rtacha natijasi (test yo'q bo'lsa null) */
  averageScore: number | null;
};

function Pill({
  tone,
  icon,
  children,
}: {
  tone: "emerald" | "amber" | "blue" | "slate";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-600",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export default function LessonCard({
  lessonId,
  orderNumber,
  title,
  description,
  videoUrl,
  categoryTitle,
  isFree,
  isCompleted,
  hasContentAccess,
  isSequenceUnlocked,
  testCount,
  averageScore,
}: LessonCardProps) {
  const thumbnail = getYouTubeThumbnail(videoUrl);

  const isOpen = hasContentAccess && isSequenceUnlocked;

  const progressValue =
    averageScore === null ? 0 : Math.round(averageScore);

  const progressLabel =
    averageScore === null
      ? "Testsiz dars"
      : `Natija: ${progressValue}%`;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-mb-line bg-white p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition",
        isOpen ? "sm:hover:shadow-[0_8px_24px_rgba(16,24,40,0.10)]" : "opacity-90",
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-mb-tint">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-xl font-bold text-mb-brand shadow-sm">
              {orderNumber}
            </span>
          </div>
        )}

        {!isOpen && (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/45 text-white backdrop-blur-[1px]">
            <Lock className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </div>
        )}

        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900/75 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          <Layers className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {orderNumber}-dars
        </span>
      </div>

      <div className="px-1.5 pb-1 pt-3">
        <h3 className="text-[17px] font-bold leading-snug text-mb-ink">
          {title}
        </h3>

        {description && (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-mb-muted">
            {description}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {isCompleted ? (
            <Pill tone="emerald" icon={<Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />}>
              Tugallangan
            </Pill>
          ) : (
            <Pill tone={isOpen ? "blue" : "slate"}>
              {isOpen ? "Oçiq" : "Yopiq"}
            </Pill>
          )}

          {isFree ? (
            <Pill tone="emerald">Bepul</Pill>
          ) : (
            <Pill tone="amber" icon={<Crown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}>
              Premium
            </Pill>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-mb-muted">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden="true" />
            {categoryTitle}
          </span>

          <span className="inline-flex items-center gap-1.5">
            <SignalHigh className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden="true" />
            {testCount > 0
              ? `${testCount} ta test`
              : "Videodars"}
          </span>
        </div>

        {averageScore !== null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mb-tintSoft">
            <div
              className={
                progressValue >= 90
                  ? "h-full rounded-full bg-emerald-500"
                  : "h-full rounded-full bg-mb-brand"
              }
              style={{
                width: `${Math.min(100, Math.max(0, progressValue))}%`,
              }}
            />
          </div>

          <span className="shrink-0 text-[12px] font-medium text-mb-muted">
            {progressLabel}
          </span>
        </div>
        )}

        <div className="mt-3 border-t border-mb-line pt-3">
          {!hasContentAccess ? (
            <Link
              href={`/pricing?locked=lesson&lessonId=${lessonId}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white transition hover:bg-amber-600"
            >
              <Lock className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              Premiumga ötiş
            </Link>
          ) : isSequenceUnlocked ? (
            <Link
              href={`/lessons/view?lessonId=${lessonId}`}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition",
                isCompleted
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-mb-brand hover:bg-mb-brandDark",
              )}
            >
              <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              {isCompleted ? "Qayta köriş" : "Köriş"}
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-500">
              <Lock className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              Oldingi darsni tugating
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
