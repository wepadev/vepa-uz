"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

import MathText from "@/components/math-text";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  clearLocalDraft,
  readLocalDraft,
  saveRemoteDraft,
  writeLocalDraft,
} from "@/lib/answer-drafts";

type ChoiceOption = {
  /** Asl harf — javob shu ko'rinishda yuboriladi */
  letter: string;
  /** Ekranda ko'rinadigan harf (aralashtirilgandan keyin) */
  displayLetter?: string;
  text: string;
};

type CommonItemFields = {
  key: string;
  navNumber: number;
  stimulusText?: string | null;
  imageUrl?: string | null;
};

export type RunnerItem =
  | (CommonItemFields & {
      kind: "choice";
      questionId: number;
      questionText: string;
      options: ChoiceOption[];
    })
  | (CommonItemFields & {
      kind: "written";
      parts: Array<{
        questionId: number;
        label: string;
        text: string;
      }>;
    })
  /*
   * Mustaqil ish: javob maydoni yo'q, ball berilmaydi. O'quvchi
   * daftarda ishlaydi, yechimni keyin natijalar sahifasidagi
   * videodan ko'radi.
   */
  | (CommonItemFields & {
      kind: "self_study";
    });

type TestRunnerProps = {
  title: string;
  description: string | null;
  sessionId: string;
  expiresAt: string;
  initialRemainingSeconds: number;
  items: RunnerItem[];
  /**
   * Serverda saqlangan qoralama javoblar.
   *
   * Aloqa uzilib yoki telefon o'chib qolgan bo'lsa, o'quvchi qaytib
   * kirganda shu javoblar bilan davom etadi.
   */
  savedAnswers?: Record<string, string>;
  submitAction: (
    formData: FormData,
  ) => void | Promise<void>;
};

/**
 * Javob bazaga yozilishidan oldingi kutish (millisekund).
 *
 * Yozma javobda har bir harf uchun so'rov yubormaslik uchun.
 * Qisqa: telefon shu oraliqda o'chib qolsa ham bir-ikki belgigina
 * yo'qoladi, brauzer xotirasida esa u ham saqlanib qoladi.
 */
const DRAFT_SAVE_DELAY_MS = 600;

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds),
  );

  const hours = Math.floor(
    safeSeconds / 3600,
  );

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  );

  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) =>
      String(value).padStart(2, "0"),
    )
    .join(":");
}

function SubmitButton({
  mobile = false,
}: {
  mobile?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        mobile
          ? "hidden shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 md:inline-flex sm:px-4 sm:text-sm lg:hidden"
          : "w-full rounded-2xl bg-emerald-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
      }
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner size="sm" />
          Yuborilmoqda...
        </span>
      ) : (
        "Testni yakunlaş"
      )}
    </button>
  );
}

function FormPendingOverlay() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/50 bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <Spinner
            size="lg"
            label="Natija hisoblanmoqda"
          />
        </div>

        <p className="mt-5 text-lg font-bold text-slate-950">
          Natija hisoblanmoqda
        </p>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Javoblaringiz tekşirilmoqda. Sahifani yopmang.
        </p>
      </div>
    </div>
  );
}

function MathValue({
  value,
}: {
  value: string | null | undefined;
}) {
  if (!value) {
    return null;
  }

  return <MathText content={value} />;
}

export default function TestRunner({
  title,
  description,
  sessionId,
  expiresAt,
  initialRemainingSeconds,
  items,
  savedAnswers,
  submitAction,
}: TestRunnerProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  const questionTopRef =
    useRef<HTMLDivElement>(null);

  const autoSubmittingRef =
    useRef(false);

  const confirmedSubmitRef =
    useRef(false);

  /*
   * Test yuborilgandan keyin sahifa "muzlatiladi": vaqt to'xtaydi,
   * tugmalar ishlamaydi. Aks holda javob serverdan kelguncha
   * o'quvchi yana bosishi yoki taymer ishlashda davom etishi mumkin.
   */
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const submittingRef = useRef(false);

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  // Mobil: savollar to‘ri (grid) pastdan ochiladi
  const [sheetOpen, setSheetOpen] =
    useState(false);

  // Mobil: klaviatura ochilganda pastki panel yashiriladi
  const [inputFocused, setInputFocused] =
    useState(false);

  const touchStartRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  /*
   * Serverdagi qoralama darhol qo'yiladi — u server render'da ham,
   * brauzerdagi birinchi render'da ham bir xil, ya'ni hydration
   * mos keladi va javoblar ko'z oldida "sakramaydi".
   *
   * Brauzer xotirasidagi nusxa esa keyinroq, useEffect ichida
   * ustiga qo'yiladi (u faqat brauzerda mavjud).
   */
  const [answers, setAnswers] = useState<
    Record<string, string>
  >(() => savedAnswers ?? {});

  const [hasLoadedAnswers, setHasLoadedAnswers] =
    useState(false);

  /*
   * Birinchi server render va brauzerdagi birinchi
   * render aynan bir xil qiymatdan boshlanadi.
   * Date.now() faqat useEffect ichida ishlatiladi.
   */
  const [remainingSeconds, setRemainingSeconds] =
    useState(() =>
      Math.max(
        0,
        Math.floor(
          initialRemainingSeconds,
        ),
      ),
    );

  /*
   * Brauzer xotirasidagi nusxani ustiga qo'yamiz.
   *
   * U serverdagi qoralamadan ustun turadi: har bir belgilash avval
   * shu yerga yoziladi, serverga esa bir oz kechikib boradi. Ya'ni
   * aloqa uzilgan oxirgi daqiqalar faqat brauzerda qolgan bo'lishi
   * mumkin.
   */
  useEffect(() => {
    const local = readLocalDraft(sessionId);

    if (local && Object.keys(local).length > 0) {
      setAnswers((current) => ({ ...current, ...local }));
    }

    setHasLoadedAnswers(true);
  }, [sessionId]);

  useEffect(() => {
    if (!hasLoadedAnswers) {
      return;
    }

    writeLocalDraft(sessionId, answers);
  }, [answers, hasLoadedAnswers, sessionId]);

  /*
   * Serverga yozish — savol bo'yicha kechiktirilgan.
   *
   * Yozma javobda o'quvchi har bir harfni terganda so'rov yuborish
   * ortiqcha bo'lardi. Shu sababli oxirgi bosishdan keyin bir oz
   * kutamiz: shu savol bo'yicha yangi o'zgarish kelsa, oldingi
   * navbat bekor qilinadi. Variantli savolda kutish deyarli
   * sezilmaydi, lekin bir xil qoida ishlagani sodda.
   */
  const draftTimersRef = useRef(
    new Map<number, ReturnType<typeof setTimeout>>(),
  );

  function queueRemoteDraft(
    questionId: number,
    value: string,
  ) {
    const timers = draftTimersRef.current;
    const existing = timers.get(questionId);

    if (existing) {
      clearTimeout(existing);
    }

    timers.set(
      questionId,
      setTimeout(() => {
        timers.delete(questionId);
        void saveRemoteDraft(sessionId, questionId, value);
      }, DRAFT_SAVE_DELAY_MS),
    );
  }

  /* Sahifadan chiqilganda kutib turgan navbatlar tozalanadi */
  useEffect(() => {
    const timers = draftTimersRef.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }

      timers.clear();
    };
  }, []);

  /*
   * "Orqaga" bosilganda sahifani serverdan qayta so'raymiz.
   *
   * Muammo shunday edi: o'quvchi testni yuborib natijani ko'rgach
   * "orqaga" bossa, brauzer sahifani xotiradan tiklardi — server
   * so'ralmasdan. Natijada tugagan test yana tirikdek ko'rinardi va
   * taymer ishlashda davom etardi.
   *
   * `persisted` aynan shu holatni bildiradi. Qayta yuklash xavfsiz:
   * sessiya tugagan bo'lsa boshlash ekrani chiqadi, tugamagan bo'lsa
   * test qolgan vaqti va saqlangan javoblari bilan tiklanadi.
   */
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    const updateTimer = () => {
      // Yuborilgan bo'lsa vaqt hisobi to'xtaydi
      if (submittingRef.current) {
        return;
      }

      const seconds = Math.max(
        0,
        Math.floor(
          (
            Date.parse(expiresAt) -
            Date.now()
          ) / 1000,
        ),
      );

      setRemainingSeconds(seconds);

      if (
        seconds <= 0 &&
        !autoSubmittingRef.current
      ) {
        autoSubmittingRef.current = true;

        window.setTimeout(() => {
          formRef.current?.requestSubmit();
        }, 50);
      }
    };

    updateTimer();

    const intervalId = window.setInterval(
      updateTimer,
      1000,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [expiresAt]);

  const allQuestionIds = useMemo(
    () =>
      items.flatMap((item) =>
        item.kind === "written"
          ? item.parts.map(
              (part) => part.questionId,
            )
          : item.kind === "self_study"
            ? []
            : [item.questionId],
      ),
    [items],
  );

  const answersPayload = useMemo(
    () =>
      allQuestionIds.map((questionId) => ({
        question_id: questionId,
        answer:
          answers[String(questionId)] ?? "",
      })),
    [allQuestionIds, answers],
  );

  const currentItem =
    items[currentIndex] ?? items[0];

  const answeredQuestionCount = useMemo(
    () =>
      allQuestionIds.filter(
        (questionId) =>
          (
            answers[String(questionId)] ?? ""
          ).trim().length > 0,
      ).length,
    [allQuestionIds, answers],
  );

  const unansweredCount =
    allQuestionIds.length -
    answeredQuestionCount;

  function getItemStatus(item: RunnerItem) {
    /* Mustaqil ishda javob yo'q — "javobsiz" deb ko'rsatilmasin */
    if (item.kind === "self_study") {
      return "self";
    }

    const ids =
      item.kind === "written"
        ? item.parts.map(
            (part) => part.questionId,
          )
        : [item.questionId];

    const answered = ids.filter(
      (id) =>
        (
          answers[String(id)] ?? ""
        ).trim().length > 0,
    ).length;

    if (answered === 0) {
      return "empty";
    }

    if (answered === ids.length) {
      return "complete";
    }

    return "partial";
  }

  function goToItem(index: number) {
    if (index < 0 || index >= items.length) {
      return;
    }

    setCurrentIndex(index);
    setSheetOpen(false);

    window.requestAnimationFrame(() => {
      questionTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  /*
   * Mobilda savollar orasida chapga/o‘ngga surib
   * o‘tish. Gorizontal scroll qiluvchi bloklar
   * (uzun formulalar) ichida ishlamaydi.
   */
  function handleTouchStart(
    event: React.TouchEvent,
  ) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    const target =
      event.target as HTMLElement | null;

    if (
      target?.closest(
        ".math-content__display, input, textarea, .scroll-x",
      )
    ) {
      touchStartRef.current = null;

      return;
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  function handleTouchEnd(
    event: React.TouchEvent,
  ) {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];

    touchStartRef.current = null;

    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (
      Math.abs(deltaX) < 70 ||
      Math.abs(deltaX) < Math.abs(deltaY) * 1.6
    ) {
      return;
    }

    goToItem(
      deltaX < 0
        ? currentIndex + 1
        : currentIndex - 1,
    );
  }

  function setAnswer(
    questionId: number,
    value: string,
  ) {
    setAnswers((current) => ({
      ...current,
      [String(questionId)]: value,
    }));

    queueRemoteDraft(questionId, value);
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    // Allaqachon yuborilgan bo'lsa ikkinchisiga yo'l yo'q
    if (submittingRef.current) {
      event.preventDefault();
      return;
    }

    if (
      autoSubmittingRef.current ||
      confirmedSubmitRef.current
    ) {
      confirmedSubmitRef.current =
        false;

      submittingRef.current = true;
      setIsSubmitting(true);

      /*
       * Kutib turgan qoralama navbatlari endi keraksiz — javoblar
       * forma bilan birga ketyapti. Serverdagi qoralamalarni esa
       * trigger o'zi tozalaydi (db/14).
       */
      for (const timer of draftTimersRef.current.values()) {
        clearTimeout(timer);
      }

      draftTimersRef.current.clear();
      clearLocalDraft(sessionId);

      return;
    }

    event.preventDefault();
    setConfirmOpen(true);
  }

  function confirmSubmit() {
    setConfirmOpen(false);
    confirmedSubmitRef.current = true;
    formRef.current?.requestSubmit();
  }

  if (!currentItem) {
    return null;
  }

  const timerUrgent =
    remainingSeconds <= 60;

  return (
    <form
      ref={formRef}
      action={submitAction}
      onSubmit={handleSubmit}
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      {/*
        Yuborish paytida butun ekran to'siladi. Bu shunchaki
        ko'rinish uchun emas: aks holda o'quvchi javob kelguncha
        tugmalarni bosishda davom etardi va taymer ham ko'zga
        ishlayotgandek ko'rinardi.
      */}
      {isSubmitting && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 backdrop-blur-sm"
        >
          <div className="mx-4 w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <Spinner size="lg" className="mx-auto text-emerald-600" />

            <p className="mt-4 text-lg font-bold text-slate-900">
              Javoblaringiz yuborilmoqda
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Sahifani yopmang va orqaga qaytmang — natija bir
              neça soniyada oçiladi.
            </p>
          </div>
        </div>
      )}

      <input
        type="hidden"
        name="sessionId"
        value={sessionId}
      />

      <input
        type="hidden"
        name="answersJson"
        value={JSON.stringify(
          answersPayload,
        )}
      />

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-6 sm:py-3 lg:py-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold sm:text-lg lg:text-xl">
              {title}
            </h1>

            <p className="truncate text-[11px] text-slate-500 sm:text-xs">
              <span className="md:hidden">
                {answeredQuestionCount}/
                {allQuestionIds.length} javob
                berilgan
              </span>
              <span className="hidden md:inline">
                {description ??
                  `${items.length} ta savol`}
              </span>
            </p>
          </div>

          <div
            className={
              timerUrgent
                ? "animate-pulse rounded-xl bg-red-50 px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums text-red-600 ring-1 ring-red-200 sm:px-4 sm:py-2 sm:text-lg"
                : "rounded-xl bg-blue-50 px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums text-blue-700 ring-1 ring-blue-100 sm:px-4 sm:py-2 sm:text-lg"
            }
          >
            {formatTime(
              remainingSeconds,
            )}
          </div>

          <SubmitButton mobile />
        </div>

        {/* Mobil: yupqa progress chizig‘i (raqamlar tasmasi o‘rniga) */}
        <div className="h-1 w-full bg-slate-100 md:hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{
              width: `${
                allQuestionIds.length > 0
                  ? (answeredQuestionCount /
                      allQuestionIds.length) *
                    100
                  : 0
              }%`,
            }}
          />
        </div>

        <div className="hidden border-t border-slate-100 px-3 py-2 md:block lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map((item, index) => {
              const status =
                getItemStatus(item);

              const isCurrent =
                index === currentIndex;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    goToItem(index)
                  }
                  aria-label={`${item.navNumber}-savol`}
                  className={[
                    "h-10 min-w-10 shrink-0 rounded-xl border text-sm font-bold transition",
                    isCurrent
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : status === "self"

                        ? "border-dashed border-slate-300 bg-slate-50 text-slate-400"

                        : status === "complete"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : status === "partial"
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-600",
                  ].join(" ")}
                >
                  {item.navNumber}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-3 py-4 sm:px-6 sm:py-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">
                Savollar
              </h2>

              <span className="text-sm text-slate-500">
                {answeredQuestionCount}/
                {allQuestionIds.length}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2">
              {items.map((item, index) => {
                const status =
                  getItemStatus(item);

                const isCurrent =
                  index === currentIndex;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      goToItem(index)
                    }
                    className={[
                      "aspect-square rounded-xl border text-sm font-bold transition",
                      isCurrent
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : status === "self"

                          ? "border-dashed border-slate-300 bg-slate-50 text-slate-400"

                          : status === "complete"
                          ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400"
                          : status === "partial"
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700",
                    ].join(" ")}
                  >
                    {item.navNumber}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-blue-50 ring-1 ring-blue-200" />
                Javob berilgan
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-amber-50 ring-1 ring-amber-300" />
                Qisman javob berilgan
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-white ring-1 ring-slate-200" />
                Javobsiz
              </div>
            </div>

            <div className="mt-6">
              <SubmitButton />
            </div>
          </div>
        </aside>

        <main
          ref={questionTopRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="min-w-0 scroll-mt-20 lg:scroll-mt-36"
        >
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-7 sm:py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {currentItem.kind === "self_study" ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
                    {currentItem.navNumber}
                    -savol · Mustaqil iş
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                    {currentItem.navNumber}
                    -savol
                  </span>
                )}

                <span className="text-sm font-medium text-slate-500">
                  {currentIndex + 1} /{" "}
                  {items.length}
                </span>
              </div>
            </div>

            <div className="px-4 py-5 sm:px-7 sm:py-8 lg:px-9">
              {currentItem.stimulusText && (
                <div className="mb-5 text-base leading-8 sm:text-lg">
                  <MathValue
                    value={
                      currentItem.stimulusText
                    }
                  />
                </div>
              )}

              {currentItem.imageUrl && (
                <div className="scroll-x mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:mb-6 sm:p-4">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={
                      currentItem.imageUrl
                    }
                    alt={`${currentItem.navNumber}-savol çizmasi`}
                    className="mx-auto max-h-[45vh] w-auto max-w-full rounded-xl object-contain sm:max-h-[560px]"
                  />
                </div>
              )}

              {currentItem.kind ===
              "choice" ? (
                <>
                  <div className="text-lg font-bold leading-8 sm:text-xl">
                    <MathValue
                      value={
                        currentItem.questionText
                      }
                    />
                  </div>

                  <div className="mt-6 space-y-3">
                    {currentItem.options.map(
                      (option) => {
                        const selected =
                          answers[
                            String(
                              currentItem.questionId,
                            )
                          ] === option.letter;

                        return (
                          <label
                            key={option.letter}
                            className={[
                              "flex min-h-[60px] cursor-pointer select-none items-start gap-3 rounded-2xl border px-3 py-3.5 transition active:scale-[0.99] sm:px-5 sm:py-4",
                              selected
                                ? "border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100"
                                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
                            ].join(" ")}
                          >
                            <input
                              type="radio"
                              name={`visible_answer_${currentItem.questionId}`}
                              value={
                                option.letter
                              }
                              checked={
                                selected
                              }
                              onChange={() =>
                                setAnswer(
                                  currentItem.questionId,
                                  option.letter,
                                )
                              }
                              className="sr-only sm:not-sr-only sm:mt-1 sm:h-5 sm:w-5 sm:shrink-0 sm:accent-blue-600"
                            />

                            <span
                              className={[
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition sm:h-8 sm:w-8",
                                selected
                                  ? "bg-blue-600 text-white ring-2 ring-blue-200"
                                  : "bg-slate-100 text-slate-700",
                              ].join(" ")}
                            >
                              {option.displayLetter ?? option.letter}
                            </span>

                            <div className="min-w-0 flex-1 text-base leading-7 sm:text-lg">
                              <MathValue
                                value={
                                  option.text
                                }
                              />
                            </div>
                          </label>
                        );
                      },
                    )}
                  </div>
                </>
              ) : currentItem.kind === "self_study" ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:p-5">
                  <p className="text-base font-bold text-slate-800">
                    Mustaqil işlang
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Bu topşiriqni daftaringizda bajaring. Unga ball
                    berilmaydi va javob kiritiş şart emas. Videoyeçimi
                    bölsa, uni test tugagandan keyin natijalar
                    sahifasida körasiz.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {currentItem.parts.map(
                    (part) => (
                      <section
                        key={
                          part.questionId
                        }
                        className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-6"
                      >
                        <div className="flex items-start gap-3 text-lg font-bold leading-8 sm:text-xl">
                          <span className="text-blue-700">
                            {part.label})
                          </span>

                          <div className="min-w-0">
                            <MathValue
                              value={part.text}
                            />
                          </div>
                        </div>

                        <label className="mt-5 block text-sm font-semibold text-slate-600">
                          Javobingiz
                        </label>

                        <input
                          type="text"
                          aria-label={`Javobingiz — ${part.label}`}
                          value={
                            answers[
                              String(
                                part.questionId,
                              )
                            ] ?? ""
                          }
                          onChange={(event) =>
                            setAnswer(
                              part.questionId,
                              event.target.value,
                            )
                          }
                          autoComplete="off"
                          inputMode="text"
                          enterKeyHint="done"
                          onFocus={() =>
                            setInputFocused(true)
                          }
                          onBlur={() =>
                            setInputFocused(false)
                          }
                          placeholder={`${part.label}) javobni kiriting`}
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-blue-50/40 focus:ring-2 focus:ring-blue-100 sm:text-lg"
                        />
                      </section>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="hidden items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 md:flex sm:px-7">
              <button
                type="button"
                disabled={
                  currentIndex === 0
                }
                onClick={() =>
                  goToItem(
                    currentIndex - 1,
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:px-6"
              >
                ← Oldingi
              </button>

              <button
                type="button"
                disabled={
                  currentIndex ===
                  items.length - 1
                }
                onClick={() =>
                  goToItem(
                    currentIndex + 1,
                  )
                }
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-6"
              >
                Keyingi →
              </button>
            </div>
          </article>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 sm:text-sm">
            <span>
              Javob berilgan:{" "}
              {answeredQuestionCount}/
              {allQuestionIds.length}
            </span>

            <span>
              Qolgan: {unansweredCount}
            </span>
          </div>

          {/* Mobil: pastdagi qat’iy panel kontentni to‘smasligi uchun */}
          <div
            aria-hidden="true"
            className="h-[calc(72px+env(safe-area-inset-bottom))] md:hidden"
          />
        </main>
      </div>

      {/* Mobil: savollar to‘ri (pastdan ochiladigan panel) */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Yopiş"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-sm"
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
            <div className="sticky top-0 z-10 bg-white px-5 pb-3 pt-3">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />

              <div className="mt-3 flex items-center justify-between">
                <p className="text-base font-bold text-slate-900">
                  Savollar
                </p>

                <p className="text-sm font-semibold text-slate-500">
                  {answeredQuestionCount}/
                  {allQuestionIds.length}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-2 px-4 pt-1">
              {items.map((item, index) => {
                const status =
                  getItemStatus(item);

                const isCurrent =
                  index === currentIndex;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      goToItem(index)
                    }
                    className={[
                      "flex h-12 items-center justify-center rounded-xl border text-sm font-bold transition",
                      isCurrent
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : status === "self"

                          ? "border-dashed border-slate-300 bg-slate-50 text-slate-400"

                          : status === "complete"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : status === "partial"
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-white text-slate-600",
                    ].join(" ")}
                  >
                    {item.navNumber}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-blue-50 ring-1 ring-blue-200" />
                Javob berilgan
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-50 ring-1 ring-amber-300" />
                Qisman
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-white ring-1 ring-slate-200" />
                Javobsiz
              </span>
            </div>

            <div className="mt-5 px-4">
              <SubmitButton />
            </div>
          </div>
        </div>
      )}

      {/* Mobil: pastki navigatsiya paneli */}
      <div
        className={[
          "fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 md:hidden",
          inputFocused
            ? "translate-y-full"
            : "translate-y-0",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() =>
              goToItem(currentIndex - 1)
            }
            aria-label="Oldingi savol"
            className="flex h-12 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-lg font-bold text-slate-700 transition active:bg-slate-100 disabled:opacity-35"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-2 leading-tight transition active:bg-slate-100"
          >
            <span className="text-sm font-bold text-slate-900">
              {currentIndex + 1} /{" "}
              {items.length}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Savollar röyxati
            </span>
          </button>

          {currentIndex ===
          items.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                setConfirmOpen(true)
              }
              className="h-12 shrink-0 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white transition active:bg-emerald-700"
            >
              Yakunlaş
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                goToItem(currentIndex + 1)
              }
              aria-label="Keyingi savol"
              className="flex h-12 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white transition active:bg-blue-700"
            >
              →
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={
          unansweredCount > 0
            ? "Javobsiz qismlar mavjud"
            : "Testni yakunlaysizmi?"
        }
        description={
          unansweredCount > 0
            ? `${unansweredCount} ta qism javobsiz qolgan. Testni baribir yakunlasangiz, keyin javoblarni özgartirib bölmaydi.`
            : "Test yuborilgandan keyin javoblarni özgartirib bölmaydi."
        }
        confirmLabel="Testni yakunlaş"
        cancelLabel="Davom etiş"
        variant={
          unansweredCount > 0
            ? "warning"
            : "info"
        }
        onConfirm={confirmSubmit}
        onCancel={() =>
          setConfirmOpen(false)
        }
      />

      <FormPendingOverlay />

    </form>
  );
}
