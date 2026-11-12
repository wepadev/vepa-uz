import Link from "next/link";
import BackLink from "@/components/ui/back-link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  ListChecks,
  Save,
  Timer,
} from "lucide-react";

import StartTestButton from "@/components/start-test-button";
import AppAlert from "@/components/ui/app-alert";
import { GlyphTile } from "@/components/ui/glyph";
import { btnPrimary } from "@/lib/ui";

type TestStartScreenProps = {
  title: string;
  description?: string | null;
  questionCount: number;
  timeLimitMinutes: number | null;
  /**
   * Testni boshlovchi server amali.
   *
   * Havola emas, forma — brauzer "orqaga" bosilganda POST'ni
   * qayta bajarmaydi, shuning uchun yangi sessiya ochilib ketmaydi.
   */
  startAction: () => void | Promise<void>;
  /** Orqaga qaytish manzili */
  backHref: string;
  backLabel: string;
  /** Uy vazifasi bo'lsa — bir marta ishlanishi haqida ogohlantirish */
  isAssignment?: boolean;
  /** Testda yozma javobli savollar bormi */
  hasWrittenQuestions?: boolean;
  /** Hozirgina topshirilgan urinish bo'lsa */
  recentAttempt?: {
    attemptId: string;
    percentage: number;
  } | null;
  /** Boshlashga urinilganda chiqqan xato */
  errorMessage?: string | null;
};

export default function TestStartScreen({
  title,
  description,
  questionCount,
  timeLimitMinutes,
  startAction,
  backHref,
  backLabel,
  isAssignment = false,
  hasWrittenQuestions = false,
  recentAttempt = null,
  errorMessage = null,
}: TestStartScreenProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-10">
        <BackLink href={backHref} label={backLabel} />

        {errorMessage && (
          <AppAlert
            variant="error"
            title="Test boşlanmadi"
            className="mt-3"
          >
            {errorMessage}
          </AppAlert>
        )}

        <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white">
          <div className="grid-plane flex items-center gap-4 border-b border-mb-line bg-mb-tintSoft p-5 sm:p-6">
            <GlyphTile
              name={isAssignment ? "homework" : "tests"}
              size="lg"
              className="bg-white"
            />

            <div className="min-w-0">
              <p className="eyebrow">
                {isAssignment ? "Uy vazifasi" : "Test"}
              </p>

              <h1 className="mt-1 text-xl font-extrabold leading-snug text-mb-ink sm:text-2xl">
                {title}
              </h1>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {description && (
              <p className="mb-4 text-[15px] leading-6 text-mb-muted">
                {description}
              </p>
            )}

            <dl className="num grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <dt className="inline-flex items-center gap-1.5 text-xs font-semibold text-mb-muted">
                  <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                  Savollar
                </dt>
                <dd className="mt-0.5 text-2xl font-extrabold text-mb-ink">
                  {questionCount}
                </dd>
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <dt className="inline-flex items-center gap-1.5 text-xs font-semibold text-mb-muted">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Vaqt
                </dt>
                <dd className="mt-0.5 text-2xl font-extrabold text-mb-ink">
                  {timeLimitMinutes ?? "—"}
                  <span className="ml-1 text-sm font-semibold text-mb-muted">
                    daqiqa
                  </span>
                </dd>
              </div>
            </dl>

            {recentAttempt ? (
              <div className="mt-4 rounded-xl border border-vp-success-line bg-vp-success-soft p-4">
                <p className="inline-flex items-center gap-2 font-bold text-vp-success">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  Siz bu testni hozirgina topşirdingiz
                </p>

                <p className="num mt-1 text-sm leading-6 text-vp-ink">
                  Natijangiz: {Math.round(recentAttempt.percentage)}%
                </p>

                <Link
                  href={`/results/view?attemptId=${recentAttempt.attemptId}`}
                  className={`${btnPrimary} mt-3`}
                >
                  Natijani köriş
                </Link>
              </div>
            ) : (
              <>
                <ul className="mt-4 grid gap-2.5 text-[15px] leading-6 text-slate-700">
                  <li className="flex gap-2.5">
                    <Timer
                      className="mt-0.5 h-5 w-5 shrink-0 text-mb-brand"
                      aria-hidden="true"
                    />
                    Tugmani bosganingizda vaqt hisobi boşlanadi.
                  </li>

                  <li className="flex gap-2.5">
                    <Save
                      className="mt-0.5 h-5 w-5 shrink-0 text-mb-brand"
                      aria-hidden="true"
                    />
                    Javoblaringiz özi saqlanib boradi — aloqa uzilsa ham
                    yöqolmaydi.
                  </li>

                  {isAssignment && (
                    <li className="flex gap-2.5 font-semibold text-vp-warning">
                      <AlertTriangle
                        className="mt-0.5 h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      Bu uy vazifasi — faqat bir marta işlanadi.
                    </li>
                  )}
                </ul>

                {hasWrittenQuestions && (
                  <details className="group mt-4 rounded-xl border border-mb-line">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-bold text-mb-ink [&::-webkit-details-marker]:hidden">
                      Yozma javoblarni qanday yoziş kerak
                      <ChevronDown
                        className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>

                    <ul className="grid gap-1.5 border-t border-mb-line px-4 py-3 text-sm leading-6 text-mb-muted">
                      <li>
                        Faqat javobning özini yozing — “javob”, “=” yoki
                        ölçov birligini yozmang.
                      </li>
                      <li>
                        Kasrni ikki xil yoziş mumkin:{" "}
                        <span className="font-semibold text-mb-ink">0.5</span>{" "}
                        yoki{" "}
                        <span className="font-semibold text-mb-ink">0,5</span> —
                        ikkalasi ham qabul qilinadi.
                      </li>
                      <li>
                        Oddiy kasrni{" "}
                        <span className="font-semibold text-mb-ink">1/2</span>{" "}
                        körinişida yozing.
                      </li>
                      <li>
                        Manfiy son oldiga minus qöying:{" "}
                        <span className="font-semibold text-mb-ink">-3</span>
                      </li>
                      <li>Böş joy va ortiqça belgilar hisobga olinmaydi.</li>
                    </ul>
                  </details>
                )}

                <form action={startAction}>
                  <StartTestButton
                    label={errorMessage ? "Qayta uriniş" : "Boşlaş"}
                  />
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
