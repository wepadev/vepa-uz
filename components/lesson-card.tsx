import Link from "next/link";
import { Check, ChevronRight, Lock, Play } from "@/components/ui/icons";

import { getYouTubeThumbnail } from "@/lib/youtube";
import { cn } from "@/lib/utils";

/**
 * Dars qadami — kurs yölidagi bitta bekat.
 *
 * Ilgari darslar bir xil kartalar töri edi: qaysi dars ötilgan, qaysi
 * biri navbatda — öqib çiqmaguncha bilinmasdi. Saytning qoidasi esa
 * aniq: dars testi 90% ga işlansa, keyingi dars oçiladi. Endi sahifa
 * şu qoidaning özini körsatadi — yuqoridan pastga yöl:
 *
 *   ✓  ötilgan dars      (yaşil belgi, natija foizi)
 *   ●  navbatdagi dars   (kök, katta rasm va bitta tugma)
 *   🔒 yopiq dars        (kulrang; nega yopiqligi yozilgan)
 */
type LessonCardProps = {
  lessonId: number;
  orderNumber: number;
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  isFree: boolean;
  isCompleted: boolean;
  /** Tarif böyiça kiriş huquqi bor */
  hasContentAccess: boolean;
  /** Oldingi darslar bajarilgan */
  isSequenceUnlocked: boolean;
  /** Darsga biriktirilgan testlar soni */
  testCount: number;
  /** Testlarning örtaça natijasi (test yöq bölsa null) */
  averageScore: number | null;
  /** Navbatdagi dars — yölda bitta */
  isCurrent: boolean;
  isLast: boolean;
};

export default function LessonCard({
  lessonId,
  orderNumber,
  title,
  description,
  videoUrl,
  isFree,
  isCompleted,
  hasContentAccess,
  isSequenceUnlocked,
  testCount,
  averageScore,
  isCurrent,
  isLast,
}: LessonCardProps) {
  const thumbnail = getYouTubeThumbnail(videoUrl);
  const isOpen = hasContentAccess && isSequenceUnlocked;
  const score = averageScore === null ? null : Math.round(averageScore);

  const meta = !hasContentAccess
    ? "Premium bilan oçiladi"
    : !isSequenceUnlocked
      ? "Oldingi dars testini 90% ga işlang"
      : testCount > 0
        ? score !== null && score > 0
          ? `${testCount} test · natija ${score}%`
          : `Video · ${testCount} test`
        : "Video";

  const node = (
    <span
      className={cn(
        "num relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold",
        isCompleted
          ? "bg-vp-success text-white"
          : isCurrent
            ? "bg-mb-brand text-white ring-4 ring-mb-tint"
            : isOpen
              ? "border-2 border-mb-brand bg-white text-mb-brandDark"
              : "border border-slate-300 bg-slate-100 text-slate-400",
      )}
    >
      {isCompleted ? (
        <Check className="h-[18px] w-[18px]" aria-hidden="true" />
      ) : isOpen ? (
        orderNumber
      ) : (
        <Lock className="h-4 w-4" aria-hidden="true" />
      )}
    </span>
  );

  const thumb = (large: boolean) => (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden bg-mb-tint",
        large
          ? "aspect-video w-full rounded-xl"
          : "aspect-video w-[92px] rounded-lg sm:w-28",
      )}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          loading="lazy"
          className={cn(
            "h-full w-full object-cover",
            !isOpen && "opacity-50 grayscale",
          )}
        />
      ) : (
        <span className="grid-plane grid h-full w-full place-items-center">
          <span className="num text-lg font-bold text-mb-brandDark">
            {orderNumber}
          </span>
        </span>
      )}

      {large && (
        <span className="absolute inset-0 grid place-items-center bg-slate-950/20">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-mb-brand shadow-lg">
            <Play
              className="ml-0.5 h-6 w-6"
              fill="currentColor"
              strokeWidth={0}
              aria-hidden="true"
            />
          </span>
        </span>
      )}
    </span>
  );

  let content: React.ReactNode;

  if (isCurrent) {
    content = (
      <Link
        href={`/lessons/view?lessonId=${lessonId}`}
        className="edge group block rounded-2xl border border-mb-brand/40 bg-white p-3 sm:flex sm:items-center sm:gap-4"
      >
        <span className="block sm:w-64 sm:shrink-0">{thumb(true)}</span>

        <span className="mt-3 block min-w-0 flex-1 sm:mt-0">
          <span className="eyebrow block text-[11px] text-mb-brand">
            Navbatdagi dars · {orderNumber}-dars
          </span>
          <span className="mt-1 block text-lg font-bold leading-snug text-mb-ink">
            {title}
          </span>

          {description && (
            <span className="mt-1 line-clamp-2 block text-sm leading-5 text-mb-muted">
              {description}
            </span>
          )}

          <span className="num mt-1.5 block text-[13px] text-mb-muted">
            {meta}
          </span>

          <span className="press btn-solid mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-mb-brand px-5 text-sm font-bold text-white sm:w-auto">
            <Play
              className="h-4 w-4"
              fill="currentColor"
              strokeWidth={0}
              aria-hidden="true"
            />
            Darsni köriş
          </span>
        </span>
      </Link>
    );
  } else {
    const inner = (
      <>
        {thumb(false)}

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "line-clamp-2 block text-[15px] font-bold leading-snug",
              isOpen ? "text-mb-ink" : "text-slate-500",
            )}
          >
            {title}
          </span>
          <span className="num mt-0.5 block text-[13px] text-mb-muted">
            {meta}
          </span>
        </span>

        {isFree && !isCompleted && isOpen && (
          <span className="shrink-0 rounded-md bg-vp-success-soft px-2 py-0.5 text-xs font-semibold text-vp-success">
            Bepul
          </span>
        )}

        {(isOpen || !hasContentAccess) && (
          <ChevronRight
            className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
      </>
    );

    const shell =
      "group flex min-h-[68px] items-center gap-3 rounded-2xl border p-2.5 pr-3";

    content = isOpen ? (
      <Link
        href={`/lessons/view?lessonId=${lessonId}`}
        className={cn(shell, "edge border-mb-line bg-white")}
      >
        {inner}
      </Link>
    ) : !hasContentAccess ? (
      <Link
        href={`/pricing?locked=lesson&lessonId=${lessonId}`}
        className={cn(shell, "border-mb-line bg-white/60 hover:bg-white")}
      >
        {inner}
      </Link>
    ) : (
      <div className={cn(shell, "border-dashed border-slate-300")}>{inner}</div>
    );
  }

  return (
    <li className="relative flex gap-3 pb-3 last:pb-0">
      {/* Yöl çiziği: ötilgan qismi yaşil */}
      {!isLast && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-0 left-[17px] top-9 w-0.5",
            isCompleted ? "bg-vp-success" : "bg-slate-200",
          )}
        />
      )}

      <span className={cn("flex", isCurrent ? "pt-3" : "pt-4")}>{node}</span>

      <div className="min-w-0 flex-1">{content}</div>
    </li>
  );
}
