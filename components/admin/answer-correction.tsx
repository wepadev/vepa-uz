import { CheckCircle2, KeyRound, XCircle } from "@/components/ui/icons";
import SubmitButton from "@/components/ui/submit-button";

type AnswerCorrectionProps = {
  attemptId: string;
  questionId: number;
  /** O'quvchi yozgan javob — kalitga qo'shish uchun */
  studentAnswer: string;
  isCorrect: boolean;
  setCorrectness: (formData: FormData) => void | Promise<void>;
  addToKey: (formData: FormData) => void | Promise<void>;
};

/**
 * O'qituvchi uchun: javobni qo'lda to'g'rilash.
 *
 * Ikkita amal bor:
 *   1. Faqat shu o'quvchining bahosini o'zgartirish (ball qayta hisoblanadi);
 *   2. Javobni kalitga qo'shish — keyingi o'quvchilarda ham to'g'ri sanaladi.
 */
export default function AnswerCorrection({
  attemptId,
  questionId,
  studentAnswer,
  isCorrect,
  setCorrectness,
  addToKey,
}: AnswerCorrectionProps) {
  const trimmed = studentAnswer.trim();

  return (
    <div className="mt-3 rounded-xl border border-dashed border-mb-line bg-white/70 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-mb-muted">
        Öqituvçi tuzatişi
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <form action={setCorrectness}>
          <input type="hidden" name="attemptId" value={attemptId} />
          <input type="hidden" name="questionId" value={questionId} />
          <input
            type="hidden"
            name="isCorrect"
            value={isCorrect ? "0" : "1"}
          />

          <SubmitButton
            className={
              isCorrect
                ? "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                : "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            }
          >
            {isCorrect ? (
              <>
                <XCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Xato deb belgilaş
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Töğri deb hisoblaş
              </>
            )}
          </SubmitButton>
        </form>

        {!isCorrect && trimmed.length > 0 && (
          <form action={addToKey}>
            <input type="hidden" name="questionId" value={questionId} />
            <input type="hidden" name="answer" value={trimmed} />
            <input type="hidden" name="attemptId" value={attemptId} />

            <SubmitButton
              title="Bu javob keyingi öquvçilarda ham töğri sanaladi"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-mb-brand hover:text-mb-brand"
            >
              <KeyRound className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Kalitga qöşiş
            </SubmitButton>
          </form>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-5 text-mb-muted">
        Baho özgarsa, ball va foiz avtomatik qayta hisoblanadi.
        “Kalitga qöşiş” esa bu javobni barça öquvçilar uçun
        töğri deb belgilaydi.
      </p>
    </div>
  );
}
