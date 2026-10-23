"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Trash2,
  Youtube,
} from "lucide-react";

import MathText from "@/components/math-text";
import AppAlert from "@/components/ui/app-alert";
import type {
  ParsedQuestion,
  ParsedTest,
} from "@/lib/pdf-import";
import { cn } from "@/lib/utils";

/**
 * Test tushadigan mavzu.
 *
 * `groupTitle` — ro'yxatdagi sarlavha: "Yo'nalish · Bo'lim".
 * Mavzular ko'p bo'lgani uchun ular shu sarlavha ostida guruhlanadi.
 */
export type TopicOption = {
  id: number;
  title: string;
  groupTitle: string;
};

export type SaveDraftState = {
  status: "idle" | "success" | "error";
  message: string;
  testId: number | null;
};

type PdfImportFormProps = {
  topics: TopicOption[];
  saveDraft: (
    previousState: SaveDraftState,
    formData: FormData,
  ) => Promise<SaveDraftState>;
  disabled?: boolean;
};

const INITIAL_SAVE_STATE: SaveDraftState = {
  status: "idle",
  message: "",
  testId: null,
};

const LETTERS = ["a", "b", "c", "d"] as const;

type Draft = {
  title: string;
  description: string;
  questions: ParsedQuestion[];
  notes: string[];
  /** Saqlangach shu yerda test raqami turadi */
  savedTestId: number | null;
};

function toDraft(test: ParsedTest): Draft {
  return {
    title: test.title,
    description: test.description ?? "",
    questions: test.questions,
    notes: test.notes,
    savedTestId: null,
  };
}

export default function PdfImportForm({
  topics,
  saveDraft,
  disabled = false,
}: PdfImportFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  /*
   * Bitta PDF ichida bir nechta variant bo'lishi mumkin. Har biri
   * alohida qoralama — birma-bir ko'rib chiqiladi va saqlanadi.
   */
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  /* Bo'lim va vaqt hamma variantga bir xil — bir marta tanlanadi */
  const [topicId, setTopicId] = useState(() =>
    String(topics[0]?.id ?? ""),
  );
  const [timeLimit, setTimeLimit] = useState("45");

  const [saveState, saveAction] = useActionState(
    saveDraft,
    INITIAL_SAVE_STATE,
  );

  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const answersRef = useRef<HTMLInputElement>(null);
  const saveGuardRef = useRef(false);
  const savingIndexRef = useRef(0);

  const active = drafts[activeIndex] ?? null;
  const savedCount = drafts.filter((item) => item.savedTestId).length;
  const single = drafts.length === 1;

  /* Saqlangan test raqamini o'z qoralamasiga yozib qo'yamiz */
  useEffect(() => {
    if (saveState.status === "error") {
      saveGuardRef.current = false;
      return;
    }

    if (saveState.status !== "success" || !saveState.testId) {
      return;
    }

    const index = savingIndexRef.current;
    const testId = saveState.testId;

    saveGuardRef.current = false;

    setDrafts((list) =>
      list.map((item, i) =>
        i === index ? { ...item, savedTestId: testId } : item,
      ),
    );
  }, [saveState]);

  /*
   * Bitta variant bo'lsa — ilgarigidek boshqaruv sahifasi ochiladi.
   * Bir nechta bo'lsa — keyingi saqlanmaganiga o'tamiz, chunki
   * o'qituvchi hali qolganlarini ko'rib chiqishi kerak.
   */
  useEffect(() => {
    if (drafts.length === 0) {
      return;
    }

    if (drafts.length === 1 && drafts[0].savedTestId) {
      const testId = drafts[0].savedTestId;

      const timer = window.setTimeout(() => {
        router.push(`/admin/tests/manage?testId=${testId}`);
      }, 1200);

      return () => window.clearTimeout(timer);
    }

    if (drafts[activeIndex]?.savedTestId) {
      const next = drafts.findIndex((item) => !item.savedTestId);

      if (next !== -1) {
        setActiveIndex(next);
      }
    }
  }, [drafts, activeIndex, router]);

/**
 * JSON bo'lmagan javobni odam tiliga o'girish.
 *
 * Server HTML qaytarsa, odatda ikkita sabab bo'ladi: funksiya vaqti
 * tugagan (504) yoki ichida qulagan (500). Ikkalasining yechimi
 * boshqa-boshqa, shuning uchun ajratib aytamiz.
 */
function describeNonJsonResponse(status: number, body: string) {
  const snippet = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  if (status === 504 || /timed? ?out|FUNCTION_INVOCATION_TIMEOUT/i.test(body)) {
    return (
      "Vaqt tugadi: server javob bermadi. PDF juda katta bo‘lishi " +
      "mumkin — uni kichikroq bo‘laklarga bo‘lib yuklab ko‘ring."
    );
  }

  if (status === 413 || /PAYLOAD_TOO_LARGE/i.test(body)) {
    return "Fayl juda katta. 4 MB dan kichik PDF yuklang.";
  }

  return (
    `Server kutilmagan javob qaytardi (${status}). ` +
    (snippet ? snippet.slice(0, 200) : "Javob bo‘sh.")
  );
}

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = fileRef.current?.files?.[0];

    if (!file) {
      setErrors(["Savollar faylini tanlang (.tex yoki .pdf)."]);
      return;
    }

    const answersFile = answersRef.current?.files?.[0];

    if (!answersFile) {
      setErrors([
        "Javoblar faylini ham tanlang \u2014 to\u2018g\u2018ri javobsiz test saqlanmaydi.",
      ]);
      return;
    }

    setLoading(true);
    setErrors([]);
    setDrafts([]);
    setActiveIndex(0);

    const body = new FormData();
    body.append("file", file);

    /*
     * Javoblar fayli shart: test PDF'ining ichida to'g'ri javob
     * yo'q, javobsiz savol esa saqlanmaydi.
     */
    body.append("answers", answersFile);

    try {
      const response = await fetch("/api/admin/import-pdf", {
        method: "POST",
        body,
      });

      /*
       * Javobni avval MATN sifatida o'qiymiz.
       *
       * Nega: server har doim ham JSON qaytarmaydi. Vercel funksiya
       * vaqti tugasa yoki qulasa, o'zining HTML xato sahifasini
       * beradi ("An error occurred..."). Oldin kod to'g'ridan-to'g'ri
       * `response.json()` deb chaqirardi va foydalanuvchi haqiqiy
       * sabab o'rniga "Unexpected token 'A'" degan tushunarsiz
       * xabarni ko'rardi.
       */
      const raw = await response.text();

      let payload: { tests?: ParsedTest[]; errors?: string[] } | null = null;

      try {
        payload = JSON.parse(raw) as {
          tests?: ParsedTest[];
          errors?: string[];
        };
      } catch {
        payload = null;
      }

      if (!payload) {
        setErrors([describeNonJsonResponse(response.status, raw)]);
        return;
      }

      if (!response.ok || !payload.tests?.length) {
        setErrors(payload.errors ?? ["Tahlil qilinmadi."]);
        return;
      }

      saveGuardRef.current = false;
      setDrafts(payload.tests.map(toDraft));
      setActiveIndex(0);
      setErrors(payload.errors ?? []);
    } catch (error) {
      setErrors([
        `So‘rov yuborilmadi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ]);
    } finally {
      setLoading(false);
    }
  }

  function patchActive(patch: Partial<Draft>) {
    setDrafts((list) =>
      list.map((item, i) =>
        i === activeIndex ? { ...item, ...patch } : item,
      ),
    );
  }

  function updateQuestion(index: number, next: ParsedQuestion) {
    if (!active) return;

    patchActive({
      questions: active.questions.map((item, i) =>
        i === index ? next : item,
      ),
    });
  }

  function removeQuestion(index: number) {
    if (!active) return;

    patchActive({
      questions: active.questions.filter((_, i) => i !== index),
    });
  }

  const choiceCount =
    active?.questions.filter((q) => q.type === "choice").length ?? 0;

  const writtenCount = (active?.questions.length ?? 0) - choiceCount;

  return (
    <div className="mt-6">
      {/* 1-bosqich: yuklash */}
      <form
        onSubmit={handleUpload}
        className="rounded-2xl border border-mb-line bg-white p-4 shadow-sm sm:p-5"
      >
        <label
          htmlFor="pdf"
          className="text-sm font-semibold text-slate-700"
        >
          Savollar fayli
        </label>

        <input
          id="pdf"
          ref={fileRef}
          type="file"
          accept="application/pdf,.tex"
          disabled={disabled || loading}
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mb-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-mb-brandDark"
        />

        <p className="mt-2 text-xs leading-5 text-mb-muted">
          <strong className="font-semibold text-slate-700">.tex</strong> yoki
          <strong className="font-semibold text-slate-700"> .pdf</strong>.
          Ichida bir nechta test bo‘lsa, tizim ularni ajratib, har
          birini alohida test qilib beradi.
        </p>

        <label
          htmlFor="answers"
          className="mt-5 block text-sm font-semibold text-slate-700"
        >
          Javoblar fayli{" "}
          <span className="font-normal text-mb-muted">(shart)</span>
        </label>

        <input
          id="answers"
          ref={answersRef}
          type="file"
          accept="application/pdf,.tex"
          disabled={disabled || loading}
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mb-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-mb-brandDark"
        />

        <p className="mt-2 text-xs leading-5 text-mb-muted">
          <strong className="font-semibold text-slate-700">.tex</strong> yoki
          <strong className="font-semibold text-slate-700"> .pdf</strong> —
          savol fayli bilan bir xil bo‘lishi shart emas. Savol
          faylining ichida to‘g‘ri javob yo‘q, javobsiz esa savol
          saqlanmaydi.
          <br />
          <strong className="font-semibold text-slate-700">.tex</strong> dan
          o‘qilsa formula aynan ko‘chiriladi — model ham, token ham
          sarflanmaydi. <strong className="font-semibold text-slate-700">.pdf</strong>{" "}
          dan o‘qilsa ko‘p qismi qoidalar bilan ajratiladi, faqat
          ajratilmagan savollar Claude’ga yuboriladi.
        </p>

        <button
          type="submit"
          disabled={disabled || loading}
          className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mb-brand px-6 font-semibold text-white transition hover:bg-mb-brandDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Tahlil qilinmoqda…
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Tahlil qilish
            </>
          )}
        </button>

        {loading && (
          <p className="mt-2 text-xs leading-5 text-mb-muted">
            Katta fayl bir daqiqagacha vaqt olishi mumkin. Sahifani yopmang.
          </p>
        )}
      </form>

      {errors.length > 0 && (
        <AppAlert
          variant={active ? "warning" : "error"}
          title={active ? "E’tibor bering" : "Xatolik"}
          className="mt-4"
        >
          <ul className="grid gap-1">
            {errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </AppAlert>
      )}

      {/* Variantlar ro'yxati */}
      {drafts.length > 1 && (
        <div className="mt-5 rounded-2xl border border-mb-line bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-mb-ink">
            {drafts.length} ta variant topildi
            {savedCount > 0 && ` · ${savedCount} tasi saqlandi`}
          </p>

          <p className="mt-1 text-xs leading-5 text-mb-muted">
            Har birini alohida ko‘rib chiqib saqlaysiz. Saqlangani
            keyin ro‘yxatda belgilanadi.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {drafts.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition",
                  index === activeIndex
                    ? "border-mb-brand bg-mb-tintSoft text-mb-brand"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {item.savedTestId && (
                  <CheckCircle2
                    className="h-4 w-4 text-emerald-600"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                )}
                {index + 1}-variant
                <span className="text-xs font-normal text-mb-muted">
                  {item.questions.length} savol
                </span>
              </button>
            ))}
          </div>

          {savedCount === drafts.length && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="text-sm font-bold text-emerald-700">
                Hammasi saqlandi
              </p>

              <div className="mt-2 grid gap-1">
                {drafts.map((item, index) => (
                  <a
                    key={index}
                    href={`/admin/tests/manage?testId=${item.savedTestId}`}
                    className="text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
                  >
                    {index + 1}-variant: {item.title} →
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {active && active.notes.length > 0 && (
        <AppAlert variant="warning" title="Shubhali joylar" className="mt-4">
          <ul className="grid gap-1">
            {active.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </AppAlert>
      )}

      {/* 2-bosqich: ko'rib chiqish */}
      {active && (
        <form
          key={activeIndex}
          action={saveAction}
          onSubmit={(event) => {
            if (saveGuardRef.current || active.savedTestId) {
              event.preventDefault();
              return;
            }

            // React pending holati render bo'lishidan oldingi tezkor ikkinchi
            // bosishni ham shu ref darhol to'xtatadi.
            saveGuardRef.current = true;
            savingIndexRef.current = activeIndex;
          }}
          className="mt-6"
        >
          <input
            type="hidden"
            name="questions"
            value={JSON.stringify(active.questions)}
          />

          <div className="rounded-2xl border border-mb-line bg-white p-4 shadow-sm sm:p-5">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              {!single && `${activeIndex + 1}-variant · `}
              {active.questions.length} ta savol ajratib olindi
              {writtenCount > 0 &&
                ` (${choiceCount} ta variantli, ${writtenCount} ta yozma)`}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="title"
                  className="text-sm font-semibold text-slate-700"
                >
                  Test nomi
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  value={active.title}
                  onChange={(e) => patchActive({ title: e.target.value })}
                  className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="description"
                  className="text-sm font-semibold text-slate-700"
                >
                  Tavsif
                </label>
                <input
                  id="description"
                  name="description"
                  value={active.description}
                  onChange={(e) =>
                    patchActive({ description: e.target.value })
                  }
                  className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="topicId"
                  className="text-sm font-semibold text-slate-700"
                >
                  Mavzu
                </label>
                <select
                  id="topicId"
                  name="topicId"
                  required
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                >
                  {Array.from(
                    new Set(topics.map((item) => item.groupTitle)),
                  ).map((groupTitle) => (
                    <optgroup key={groupTitle} label={groupTitle}>
                      {topics
                        .filter((item) => item.groupTitle === groupTitle)
                        .map((topic) => (
                          <option key={topic.id} value={topic.id}>
                            {topic.title}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="timeLimitMinutes"
                  className="text-sm font-semibold text-slate-700"
                >
                  Vaqt (daqiqa)
                </label>
                <input
                  id="timeLimitMinutes"
                  name="timeLimitMinutes"
                  type="number"
                  min={1}
                  max={300}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  required
                  className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {/* Savollar ro'yxati */}
          <div className="mt-4 grid gap-3">
            {active.questions.map((question, index) => (
              <QuestionEditor
                key={index}
                index={index}
                question={question}
                onChange={(next) => updateQuestion(index, next)}
                onRemove={() => removeQuestion(index)}
              />
            ))}
          </div>

          {active.savedTestId && (
            <AppAlert
              variant="success"
              title="Qoralama sifatida saqlandi"
              className="mt-5"
            >
              {single
                ? "Test saqlandi. Hozir test boshqaruv sahifasi ochiladi."
                : "Bu variant saqlandi. Qolganlarini yuqoridagi ro‘yxatdan tanlab davom eting."}
            </AppAlert>
          )}

          {saveState.status === "error" && saveState.message && (
            <AppAlert
              variant="error"
              title="Qoralama saqlanmadi"
              className="mt-5"
            >
              {saveState.message}
            </AppAlert>
          )}

          <SaveDraftButton
            disabled={active.questions.length === 0}
            saved={Boolean(active.savedTestId)}
            label={
              single
                ? "Qoralama sifatida saqlash"
                : `${activeIndex + 1}-variantni saqlash`
            }
          />

          <p className="mt-2 text-xs leading-5 text-mb-muted">
            {single
              ? "Saqlash vaqtida tugma bloklanadi. Saqlangach test boshqaruv sahifasi avtomatik ochiladi."
              : "Har bir variant alohida qoralama bo‘lib saqlanadi. Mavzu va vaqt hammasiga bir xil."}
          </p>
        </form>
      )}
    </div>
  );
}

function SaveDraftButton({
  disabled,
  saved,
  label,
}: {
  disabled: boolean;
  saved: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending || saved}
      aria-disabled={disabled || pending || saved}
      className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-mb-brand px-6 font-semibold text-white transition hover:bg-mb-brandDark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Saqlanmoqda…
        </>
      ) : saved ? (
        <>
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          Saqlandi
        </>
      ) : (
        label
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */

function QuestionEditor({
  index,
  question,
  onChange,
  onRemove,
}: {
  index: number;
  question: ParsedQuestion;
  onChange: (next: ParsedQuestion) => void;
  onRemove: () => void;
}) {
  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100";

  return (
    <article className="rounded-2xl border border-mb-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-mb-ink">
          {index + 1}-savol
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {question.type === "choice" ? "variantli" : "yozma"}
          </span>
        </p>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Savolni o‘chirish"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          O‘chirish
        </button>
      </div>

      {/*
       * KO'RINISHI.
       *
       * Pastdagi maydonlarda formula XOM holda turadi
       * (`$\frac{7}{40}$`) — tahrirlash uchun aynan shunday kerak.
       * Lekin xom matnga qarab "chiroyli chiqdimi" deb hukm qilib
       * bo'lmaydi, shuning uchun yonida o'quvchi ko'radigan
       * ko'rinishi ham turadi. Formula buzuq bo'lsa KaTeX uni
       * qizil rangda chizadi — darhol ko'zga tashlanadi.
       */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-mb-muted">
          Ko‘rinishi
        </p>

        <div className="mt-1.5 text-sm text-mb-ink">
          <MathText content={question.text} />
        </div>

        {question.type === "choice" && (
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {LETTERS.map((letter) => (
              <div
                key={letter}
                className={cn(
                  "flex items-start gap-1.5 rounded-lg px-2 py-1 text-sm",
                  question.correct === letter.toUpperCase()
                    ? "bg-emerald-100 text-emerald-900"
                    : "text-mb-ink",
                )}
              >
                <span className="shrink-0 font-bold">
                  {letter.toUpperCase()})
                </span>
                <MathText content={question.options[letter]} />
              </div>
            ))}
          </div>
        )}
      </div>

      <textarea
        rows={3}
        value={question.type === "choice" ? question.text : (question.text ?? "")}
        onChange={(e) =>
          onChange({ ...question, text: e.target.value } as ParsedQuestion)
        }
        className={inputClass}
      />

      {question.type === "choice" ? (
        <>
          <div className="mt-3 grid gap-2">
            {LETTERS.map((letter) => (
              <label
                key={letter}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-1.5",
                  question.correct === letter.toUpperCase()
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200",
                )}
              >
                <input
                  type="radio"
                  name={`correct-${index}`}
                  checked={question.correct === letter.toUpperCase()}
                  onChange={() =>
                    onChange({
                      ...question,
                      correct: letter.toUpperCase() as "A" | "B" | "C" | "D",
                    })
                  }
                  className="h-4 w-4 shrink-0"
                />

                <span className="w-5 shrink-0 text-sm font-bold text-slate-600">
                  {letter.toUpperCase()}
                </span>

                <input
                  value={question.options[letter]}
                  onChange={(e) =>
                    onChange({
                      ...question,
                      options: {
                        ...question.options,
                        [letter]: e.target.value,
                      },
                    })
                  }
                  className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
                />
              </label>
            ))}
          </div>

          <label className="mt-3 block text-xs font-semibold text-slate-600">
            Yechim
            <textarea
              rows={3}
              value={question.solution ?? ""}
              onChange={(e) =>
                onChange({ ...question, solution: e.target.value })
              }
              className={inputClass}
            />
          </label>

          <label className="mt-3 block text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Youtube className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Yechim videosi
            </span>

            <input
              type="url"
              inputMode="url"
              placeholder="https://youtu.be/..."
              value={question.solutionVideo ?? ""}
              onChange={(e) =>
                onChange({
                  ...question,
                  solutionVideo: e.target.value.trim() || null,
                })
              }
              className={inputClass}
            />
          </label>
        </>
      ) : (
        <div className="mt-3 grid gap-2">
          {question.parts.map((part, partIndex) => (
            <div
              key={partIndex}
              className="rounded-xl border border-slate-200 p-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-sm font-bold text-slate-600">
                  {part.label})
                </span>

                <input
                  value={part.text}
                  onChange={(e) =>
                    onChange({
                      ...question,
                      parts: question.parts.map((p, i) =>
                        i === partIndex ? { ...p, text: e.target.value } : p,
                      ),
                    })
                  }
                  className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
                />
              </div>

              <label className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600">
                Javob
                <input
                  value={part.answer}
                  onChange={(e) =>
                    onChange({
                      ...question,
                      parts: question.parts.map((p, i) =>
                        i === partIndex ? { ...p, answer: e.target.value } : p,
                      ),
                    })
                  }
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal outline-none"
                />
              </label>

              <label className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Youtube className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                <input
                  type="url"
                  inputMode="url"
                  placeholder="Yechim videosi (ixtiyoriy)"
                  value={part.solutionVideo ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...question,
                      parts: question.parts.map((p, i) =>
                        i === partIndex
                          ? { ...p, solutionVideo: e.target.value.trim() || null }
                          : p,
                      ),
                    })
                  }
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal outline-none"
                />
              </label>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 inline-flex items-start gap-1.5 text-[11px] leading-5 text-mb-muted">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        Formulalar KaTeX ko‘rinishida: <code>$x^2$</code>. Saqlagandan keyin
        test sahifasida qanday chiqishini ko‘rasiz.
      </p>
    </article>
  );
}
