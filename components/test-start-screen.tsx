import Link from "next/link";
import BackLink from "@/components/ui/back-link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListChecks,
} from "lucide-react";

import StartTestButton from "@/components/start-test-button";
import AppAlert from "@/components/ui/app-alert";

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
      <section className="mx-auto max-w-2xl px-3 py-6 sm:px-6 sm:py-12">
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

        <div className="mt-3 rounded-2xl border border-mb-line bg-white p-5 shadow-sm sm:p-7">
          <h1 className="text-xl font-bold leading-snug text-mb-ink sm:text-2xl">
            {title}
          </h1>

          {description && (
            <p className="mt-2 text-sm leading-6 text-mb-muted sm:text-base">
              {description}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-mb-tintSoft p-3 text-center">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-mb-muted">
                <ListChecks className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Savollar
              </p>
              <p className="mt-1 text-2xl font-bold text-mb-ink">
                {questionCount}
              </p>
            </div>

            <div className="rounded-xl bg-mb-tintSoft p-3 text-center">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-mb-muted">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Vaqt
              </p>
              <p className="mt-1 text-2xl font-bold text-mb-ink">
                {timeLimitMinutes ?? "—"}
                <span className="ml-1 text-sm font-semibold text-mb-muted">
                  daq
                </span>
              </p>
            </div>
          </div>

          {recentAttempt ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="inline-flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                Siz bu testni hozirgina topşirdingiz
              </p>

              <p className="mt-1 text-sm leading-6 text-emerald-700">
                Natijangiz: {Math.round(recentAttempt.percentage)}%
              </p>

              <Link
                href={`/results/view?attemptId=${recentAttempt.attemptId}`}
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Natijani köriş
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                  Boşlaşdan oldin
                </p>

                <ul className="mt-2 grid gap-1 text-sm leading-6 text-amber-900">
                  <li>Tugmani bosganingizda vaqt hisobi boşlanadi.</li>
                  <li>Javoblaringiz avtomatik saqlanib boradi.</li>
                  {isAssignment && (
                    <li className="font-semibold">
                      Bu uy vazifasi — faqat bir marta işlanadi.
                    </li>
                  )}
                </ul>
              </div>

              {hasWrittenQuestions && (
                <div className="mt-3 rounded-xl border border-mb-line bg-mb-tintSoft p-4">
                  <p className="text-sm font-semibold text-mb-ink">
                    Yozma javoblarni qanday yoziş kerak
                  </p>

                  <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-mb-muted">
                    <li>
                      Faqat javobning özini yozing — “javob”, “=” yoki
                      ölçov birligini yozmang.
                    </li>
                    <li>
                      Kasrni ikki xil yoziş mumkin:{" "}
                      <span className="font-semibold text-mb-ink">0.5</span> yoki{" "}
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
                </div>
              )}

              <form action={startAction}>
                <StartTestButton
                  label={errorMessage ? "Qayta uriniş" : "Boşlaş"}
                />
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
