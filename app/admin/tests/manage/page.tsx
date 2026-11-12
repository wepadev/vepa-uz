/**
 * Test boshqaruvi sahifasi.
 *
 * Fayl faqat ko'rinish uchun javob beradi. Ma'lumot o'zgartiradigan
 * kod `actions.ts` da, yordamchi funksiyalar `shared.ts` da.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import ConfirmSubmitButton from "@/components/admin/confirm-submit-button";
import CreatePanel from "@/components/admin/create-panel";
import RowMenu, { rowMenuDanger, rowMenuItem } from "@/components/admin/row-menu";
import MathText from "@/components/math-text";
import SubmitButton from "@/components/ui/submit-button";

import {
  addMultipleChoiceQuestion,
  addSharedOptionsBlock,
  addWrittenPartsBlock,
  changePublishedState,
  deleteQuestionBlock,
  deleteStandaloneQuestion,
  renumberQuestionNumbers,
  updateQuestionBlock,
  updateSelfStudyVideo,
  updateStandaloneQuestion,
  updateTestDetails,
} from "./actions";

import {
  createSignedUrlMap,
  getAdminClient,
  type AnswerKeyRow,
  type QuestionBlockRow,
  type QuestionRow,
} from "./shared";
import PageHeader from "@/components/ui/page-header";

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-mb-brand focus:ring-2 focus:ring-blue-100";

const textareaClass =
  "mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-mb-brand focus:ring-2 focus:ring-blue-100";

const fileInputClass =
  "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100";

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

type PageProps = {
  searchParams: Promise<{
    testId?: string;
    tur?: string;
  }>;
};

/**
 * Savol turlari. Ilgari uchala forma bir vaqtda ochiq turardi va
 * sahifa juda uzun bo'lib ketardi. Endi tur tugmalardan tanlanadi
 * (`?tur=`) va faqat o'sha forma ko'rinadi. Savol qo'shilgach
 * sahifa o'sha turda qoladi — ketma-ket bir xil savol kiritish oson.
 */
const QUESTION_TYPES = [
  { value: "oddiy", label: "A–D test", hint: "Oddiy variantli savol — 2 ball" },
  { value: "yozma", label: "a)–b) yozma", hint: "Ikki qismli yozma savol — har qism 2 ball" },
  { value: "umumiy", label: "A–F blok", hint: "Umumiy variantli 3 ta savol — har biri 2 ball" },
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number]["value"];

export default async function ManageTestPage({ searchParams }: PageProps) {
  const { testId: testIdValue, tur: turValue } = await searchParams;

  const questionType: QuestionType =
    QUESTION_TYPES.find((item) => item.value === turValue)?.value ?? "oddiy";

  const testId = Number(testIdValue);

  if (!Number.isInteger(testId) || testId <= 0) {
    notFound();
  }

  const supabase = await getAdminClient();

  const { data: test, error: testError } = await supabase
    .from("tests")
    .select("id, title, description, is_published, time_limit_minutes")
    .eq("id", testId)
    .single();

  if (testError || !test) {
    notFound();
  }

  // Testni necha o'quvchi ishlagan — tahrirlash ogohlantirishi uchun
  const { count: attemptCount } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("test_id", testId);

  const usedByStudents = (attemptCount ?? 0) > 0;

  const [
    { data: questionData, error: questionsError },
    { data: blockData, error: blocksError },
  ] = await Promise.all([
    supabase
      .from("questions")
      .select(
        `
          id,
          question_text,
          image_path,
          option_a,
          option_b,
          option_c,
          option_d,
          order_number,
          question_type,
          block_id,
          part_label
        `,
      )
      .eq("test_id", testId)
      .order("order_number", {
        ascending: true,
      }),
    supabase
      .from("question_blocks")
      /* `*` — `solution_video_url` (db/37) bo'lmagan bazada ham buzilmasin */
      .select("*")
      .eq("test_id", testId)
      .order("order_number", {
        ascending: true,
      }),
  ]);

  if (questionsError) {
    throw new Error(`Savollar yuklanmadi: ${questionsError.message}`);
  }

  if (blocksError) {
    throw new Error(`Savol bloklari yuklanmadi: ${blocksError.message}`);
  }

  const questions = (questionData ?? []) as QuestionRow[];

  const blocks = (blockData ?? []) as QuestionBlockRow[];

  const questionIds = questions.map((question) => question.id);

  let answerKeys: AnswerKeyRow[] = [];

  if (questionIds.length > 0) {
    const { data, error } = await supabase
      .from("answer_keys")
      .select(
        `
          question_id,
          correct_answer,
          accepted_answers,
          solution_text,
          solution_video_url
        `,
      )
      .in("question_id", questionIds);

    if (error) {
      throw new Error(`Javoblar yuklanmadi: ${error.message}`);
    }

    answerKeys = (data ?? []) as AnswerKeyRow[];
  }

  const answerMap = new Map(
    answerKeys.map((answer) => [answer.question_id, answer]),
  );

  const questionImageUrlMap = await createSignedUrlMap(supabase, questions);

  const blockImageUrlMap = await createSignedUrlMap(supabase, blocks);

  const standaloneQuestions = questions
    .filter((question) => question.block_id === null)
    .sort((a, b) => a.order_number - b.order_number);

  const questionsByBlock = new Map<number, QuestionRow[]>();

  for (const question of questions) {
    if (question.block_id === null) {
      continue;
    }

    const blockQuestions = questionsByBlock.get(question.block_id) ?? [];

    blockQuestions.push(question);

    questionsByBlock.set(question.block_id, blockQuestions);
  }

  for (const blockQuestions of questionsByBlock.values()) {
    blockQuestions.sort((a, b) => a.order_number - b.order_number);
  }

  const displayQuestionCount =
    standaloneQuestions.length +
    blocks.reduce(
      (total, block) => total + (block.block_type === "shared_options" ? 3 : 1),
      0,
    );

  const maximumScore = questions.length * 2;

  const displayItems = [
    ...standaloneQuestions.map((question) => ({
      kind: "question" as const,
      order: question.order_number,
      question,
    })),
    ...blocks.map((block) => ({
      kind: "block" as const,
      order: block.order_number,
      block,
    })),
  ].sort((a, b) => a.order - b.order);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        sticky={false}
        backHref="/admin/tests"
        backLabel="Testlar"
        title={test.title}
        width="4xl"
        chips={[
          !test.is_published && (
            <span key="qoralama" className="text-amber-700">
              Qoralama
            </span>
          ),
          `${displayQuestionCount} savol`,
          `${test.time_limit_minutes} daqiqa`,
          `${maximumScore} ball`,
        ]}
        action={
          <>
            <form action={changePublishedState}>
              <input type="hidden" name="testId" value={test.id} />

              <input
                type="hidden"
                name="nextState"
                value={String(!test.is_published)}
              />

              <SubmitButton
                className={
                  test.is_published
                    ? "min-h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    : "min-h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                }
              >
                {test.is_published ? "Testni yopiş" : "Naşr qiliş"}
              </SubmitButton>
            </form>

            <RowMenu>
              <form action={renumberQuestionNumbers}>
                <input type="hidden" name="testId" value={test.id} />
                <SubmitButton className={rowMenuItem}>
                  Raqamlarni tartiblaş
                </SubmitButton>
              </form>
            </RowMenu>
          </>
        }
      >
        {test.description && (
          <div className="text-sm text-mb-muted">
            <MathValue value={test.description} />
          </div>
        )}
      </PageHeader>

      <section className="mx-auto max-w-4xl px-3 py-5 sm:px-6 sm:py-6">
        <details className="group/edit mb-4 rounded-2xl open:border open:border-mb-line open:bg-white open:shadow-sm">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand group-open/edit:px-4">
            Test nomi, vaqti va tavsifini tahrirlaş
          </summary>

          <form
            action={updateTestDetails}
            className="border-t border-slate-200 p-4 sm:p-5"
          >
            <input type="hidden" name="testId" value={test.id} />

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold">Test nomi</label>

                <input
                  name="title"
                  required
                  defaultValue={test.title}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold">
                  Test vaqti (daqiqada)
                </label>

                <input
                  name="timeLimitMinutes"
                  required
                  type="text"
                  inputMode="decimal"
                  defaultValue={String(test.time_limit_minutes)}
                  placeholder="Masalan: 0.5, 30, 1000"
                  className={inputClass}
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  0 dan katta istalgan son. Kasr daqiqa ham mumkin.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm font-semibold">
              Test tavsifi
            </label>

            <textarea
              name="description"
              rows={3}
              defaultValue={test.description ?? ""}
              placeholder="Ixtiyoriy"
              className={textareaClass}
            />

            <SubmitButton
              className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Özgarişlarni saqlaş
            </SubmitButton>
          </form>
        </details>

        <div>
          {usedByStudents && (
            <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
              <p className="font-bold text-amber-900">
                Diqqat: bu testni {attemptCount} ta öquvçi işlagan
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Savolni tahrirlasangiz yoki öçirsangiz, eski natijalar
                yangi savolga işora qila boşlaydi — öquvçining
                “Batafsil” sahifasida javoblar notöğri körinadi.
                Reyting ballari ham qayta hisoblanmaydi.
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Xato topgan bölsangiz, tahrirlaş örniga yangi test
                yaratib, eskisini yopgan ma’qul.
              </p>
            </div>
          )}

          <CreatePanel
            label="Savol qöşiş"
            defaultOpen={displayItems.length === 0 || Boolean(turValue)}
          >
            <div className="p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
            {QUESTION_TYPES.map((item) => (
              <Link
                key={item.value}
                href={`/admin/tests/manage?testId=${test.id}&tur=${item.value}`}
                aria-current={item.value === questionType ? "page" : undefined}
                className={
                  item.value === questionType
                    ? "rounded-xl bg-white px-2 py-2 text-center text-sm font-bold text-mb-brand shadow-sm"
                    : "rounded-xl px-2 py-2 text-center text-sm font-semibold text-slate-600 hover:bg-white/60"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>

          <p className="mt-3 text-sm text-slate-500">
            {QUESTION_TYPES.find((item) => item.value === questionType)?.hint}.
          </p>

          <div className="mt-4 space-y-4">
            {questionType === "oddiy" && (
              <div className="overflow-hidden rounded-2xl border border-mb-line">

              <form
                action={addMultipleChoiceQuestion}
                className="bg-white p-5"
              >
                <input type="hidden" name="testId" value={test.id} />

                <label className="block text-sm font-semibold">
                  Savol matni
                </label>

                <textarea
                  name="questionText"
                  required
                  rows={4}
                  placeholder="Masalan: 2 + 3 neçaga teng?"
                  className={textareaClass}
                />

                <label className="mt-5 block text-sm font-semibold">
                  Savol rasmi yoki çizmasi
                  <span className="ml-1 font-normal text-slate-500">
                    (ixtiyoriy)
                  </span>
                </label>

                <input
                  name="questionImage"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className={fileInputClass}
                />

                <p className="mt-2 text-xs text-slate-500">
                  PNG, JPG yoki WEBP. Maksimal hajm: 5 MB.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {(["A", "B", "C", "D"] as const).map((letter) => (
                    <div key={letter}>
                      <label className="block text-sm font-semibold">
                        {letter} variant
                      </label>

                      <input
                        name={`option${letter}`}
                        required
                        placeholder={`${letter} javob`}
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>

                <label className="mt-5 block text-sm font-semibold">
                  Töğri javob
                </label>

                <select
                  name="correctAnswer"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    Javobni tanlang
                  </option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold">
                      Yozma yeçim
                    </label>

                    <textarea
                      name="solutionText"
                      rows={3}
                      placeholder="Ixtiyoriy"
                      className={textareaClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">
                      Videoyeçim havolasi
                    </label>

                    <input
                      name="solutionVideoUrl"
                      type="url"
                      placeholder="https://youtube.com/..."
                      className={inputClass}
                    />
                  </div>
                </div>

                <SubmitButton
                  className="mt-6 rounded-xl bg-mb-brand px-6 py-3 font-semibold text-white hover:bg-mb-brandDark"
                >
                  Oddiy savolni qöşiş
                </SubmitButton>
              </form>
            </div>
            )}

            {questionType === "yozma" && (
              <div className="overflow-hidden rounded-2xl border border-mb-line">

              <form
                action={addWrittenPartsBlock}
                className="bg-white p-5"
              >
                <input type="hidden" name="testId" value={test.id} />

                <label className="block text-sm font-semibold">
                  Umumiy savol matni
                </label>

                <textarea
                  name="writtenStimulusText"
                  rows={4}
                  placeholder="a) va b) qismlariga tegişli umumiy şart"
                  className={textareaClass}
                />

                <label className="mt-5 block text-sm font-semibold">
                  Umumiy çizma yoki rasm
                  <span className="ml-1 font-normal text-slate-500">
                    (matn bölmasa majburiy)
                  </span>
                </label>

                <input
                  name="writtenBlockImage"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className={fileInputClass}
                />

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {[
                    {
                      label: "a",
                      prefix: "partA",
                    },
                    {
                      label: "b",
                      prefix: "partB",
                    },
                  ].map((part) => (
                    <div
                      key={part.label}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <h3 className="text-lg font-bold">{part.label}) qism</h3>

                      <label className="mt-4 block text-sm font-semibold">
                        Savol matni
                      </label>

                      <textarea
                        name={`${part.prefix}Text`}
                        required
                        rows={3}
                        placeholder={`${part.label}) topşiriq`}
                        className={textareaClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        Asosiy töğri javob
                      </label>

                      <input
                        name={`${part.prefix}Answer`}
                        required
                        placeholder="Masalan: 12"
                        className={inputClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        Boşqa qabul qilinadigan javoblar
                      </label>

                      <textarea
                        name={`${part.prefix}Accepted`}
                        rows={2}
                        placeholder="Masalan: 1/2, 0.5, 0,5"
                        className={textareaClass}
                      />

                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Javoblarni vergul yoki yangi qator bilan ajrating.
                      </p>

                      <label className="mt-4 block text-sm font-semibold">
                        Yeçim
                      </label>

                      <textarea
                        name={`${part.prefix}Solution`}
                        rows={3}
                        placeholder="Ixtiyoriy"
                        className={textareaClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        Videoyeçim
                      </label>

                      <input
                        name={`${part.prefix}Video`}
                        type="url"
                        placeholder="https://youtube.com/..."
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>

                <SubmitButton
                  className="mt-6 rounded-xl bg-mb-brand px-6 py-3 font-semibold text-white hover:bg-mb-brandDark"
                >
                  a)–b) yozma savolni qöşiş
                </SubmitButton>
              </form>
            </div>
            )}

            {questionType === "umumiy" && (
              <div className="overflow-hidden rounded-2xl border border-mb-line">

              <form
                action={addSharedOptionsBlock}
                className="bg-white p-5"
              >
                <input type="hidden" name="testId" value={test.id} />

                <label className="block text-sm font-semibold">
                  Uçta savol uçun umumiy matn
                </label>

                <textarea
                  name="sharedStimulusText"
                  rows={4}
                  placeholder="33–35-savollar uçun umumiy şart"
                  className={textareaClass}
                />

                <label className="mt-5 block text-sm font-semibold">
                  Umumiy çizma yoki rasm
                  <span className="ml-1 font-normal text-slate-500">
                    (matn bölmasa majburiy)
                  </span>
                </label>

                <input
                  name="sharedBlockImage"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className={fileInputClass}
                />

                <h3 className="mt-6 text-lg font-bold">Umumiy variantlar</h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(["A", "B", "C", "D", "E", "F"] as const).map((letter) => (
                    <div key={letter}>
                      <label className="block text-sm font-semibold">
                        {letter} variant
                      </label>

                      <input
                        name={`sharedOption${letter}`}
                        required
                        placeholder={`${letter} javob`}
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>

                <h3 className="mt-7 text-lg font-bold">Uçta içki savol</h3>

                <div className="mt-4 grid gap-5 lg:grid-cols-3">
                  {[1, 2, 3].map((number) => (
                    <div
                      key={number}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <h4 className="font-bold">{number}-savol</h4>

                      <label className="mt-4 block text-sm font-semibold">
                        Savol matni
                      </label>

                      <textarea
                        name={`sharedQuestion${number}Text`}
                        required
                        rows={3}
                        placeholder={`${number}-içki savol`}
                        className={textareaClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        Töğri javob
                      </label>

                      <select
                        name={`sharedQuestion${number}Answer`}
                        required
                        defaultValue=""
                        className={inputClass}
                      >
                        <option value="" disabled>
                          A–F dan tanlang
                        </option>
                        {(["A", "B", "C", "D", "E", "F"] as const).map(
                          (letter) => (
                            <option key={letter} value={letter}>
                              {letter}
                            </option>
                          ),
                        )}
                      </select>

                      <label className="mt-4 block text-sm font-semibold">
                        Yeçim
                      </label>

                      <textarea
                        name={`sharedQuestion${number}Solution`}
                        rows={3}
                        placeholder="Ixtiyoriy"
                        className={textareaClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        Videoyeçim
                      </label>

                      <input
                        name={`sharedQuestion${number}Video`}
                        type="url"
                        placeholder="https://youtube.com/..."
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>

                <SubmitButton
                  className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
                >
                  Umumiy A–F blokni qöşiş
                </SubmitButton>
              </form>
            </div>
            )}
          </div>
            </div>
          </CreatePanel>

          <div className="mt-5 min-w-0">
          {displayItems.length > 0 && (
            <div className="space-y-3">
              {displayItems.map((item) => {
                if (item.kind === "question") {
                  const question = item.question;
                  const answer = answerMap.get(question.id);

                  const imageUrl = questionImageUrlMap.get(question.id);

                  const options = [
                    ["A", question.option_a],
                    ["B", question.option_b],
                    ["C", question.option_c],
                    ["D", question.option_d],
                  ] as const;

                  return (
                    <article
                      key={`question-${question.id}`}
                      className="rounded-2xl border border-mb-line bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2 font-semibold">
                          <span className="shrink-0 text-mb-brand">
                            {question.order_number}.
                          </span>
                          <div className="min-w-0">
                            <MathValue value={question.question_text} />
                          </div>
                        </div>

                        <RowMenu>
                          <form action={deleteStandaloneQuestion}>
                            <input type="hidden" name="testId" value={test.id} />
                            <input
                              type="hidden"
                              name="questionId"
                              value={question.id}
                            />
                            <ConfirmSubmitButton
                              className={rowMenuDanger}
                              title="Savol öçirilsinmi?"
                              description={`${question.order_number}-savol butunlay öçiriladi.`}
                            >
                              Öçiriş
                            </ConfirmSubmitButton>
                          </form>
                        </RowMenu>
                      </div>

                      {imageUrl && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                          <img
                            loading="lazy"
                            decoding="async"
                            src={imageUrl}
                            alt={`${question.order_number}-savol çizmasi`}
                            className="mx-auto max-h-[260px] w-auto max-w-full rounded-lg object-contain"
                          />
                        </div>
                      )}

                      <div className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                        {options.map(([letter, option]) => (
                          <div
                            key={letter}
                            className={
                              answer?.correct_answer === letter
                                ? "flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800 ring-1 ring-emerald-300"
                                : "flex items-start gap-2 rounded-lg px-3 py-1.5 text-slate-700"
                            }
                          >
                            <span className="font-bold">{letter})</span>
                            <div className="min-w-0 flex-1">
                              <MathValue value={option} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {answer?.solution_text && (
                        <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                          <strong>Yeçim:</strong>
                          <div className="mt-2">
                            <MathValue value={answer.solution_text} />
                          </div>
                        </div>
                      )}

                      {answer?.solution_video_url && (
                        <a
                          href={answer.solution_video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-block text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
                        >
                          Videoyeçimni oçiş →
                        </a>
                      )}

                      <details
                        id={`edit-question-${question.id}`}
                        className="group/edit mt-2 rounded-xl open:border open:border-blue-200 open:bg-blue-50/40"
                      >
                        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand group-open/edit:px-4">
                          Tahrirlaş
                        </summary>

                        <form
                          action={updateStandaloneQuestion}
                          className="border-t border-blue-200 bg-white p-5"
                        >
                          <input type="hidden" name="testId" value={test.id} />
                          <input
                            type="hidden"
                            name="questionId"
                            value={question.id}
                          />

                          <label className="block text-sm font-semibold">
                            Savol matni
                          </label>

                          <textarea
                            name="editQuestionText"
                            required
                            rows={4}
                            defaultValue={question.question_text}
                            className={textareaClass}
                          />

                          <div className="mt-5 grid gap-4 md:grid-cols-2">
                            {options.map(([letter, option]) => (
                              <div key={`edit-${question.id}-${letter}`}>
                                <label className="block text-sm font-semibold">
                                  {letter} variant
                                </label>

                                <input
                                  name={`editOption${letter}`}
                                  required
                                  defaultValue={option ?? ""}
                                  className={inputClass}
                                />
                              </div>
                            ))}
                          </div>

                          <label className="mt-5 block text-sm font-semibold">
                            Töğri javob
                          </label>

                          <select
                            name="editCorrectAnswer"
                            required
                            defaultValue={answer?.correct_answer ?? "A"}
                            className={inputClass}
                          >
                            {(["A", "B", "C", "D"] as const).map(
                              (letter) => (
                                <option key={letter} value={letter}>
                                  {letter}
                                </option>
                              ),
                            )}
                          </select>

                          <label className="mt-5 block text-sm font-semibold">
                            Rasmni almaştiriş
                            <span className="ml-1 font-normal text-slate-500">
                              (ixtiyoriy)
                            </span>
                          </label>

                          <input
                            name="editQuestionImage"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className={fileInputClass}
                          />

                          {question.image_path && (
                            <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-red-600">
                              <input
                                type="checkbox"
                                name="removeCurrentImage"
                                value="true"
                                className="h-4 w-4"
                              />
                              Joriy rasmni öçiriş
                            </label>
                          )}

                          <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-sm font-semibold">
                                Yozma yeçim
                              </label>

                              <textarea
                                name="editSolutionText"
                                rows={3}
                                defaultValue={answer?.solution_text ?? ""}
                                className={textareaClass}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold">
                                Videoyeçim havolasi
                              </label>

                              <input
                                name="editSolutionVideoUrl"
                                type="url"
                                defaultValue={
                                  answer?.solution_video_url ?? ""
                                }
                                className={inputClass}
                              />
                            </div>
                          </div>

                          <SubmitButton
                            className="mt-6 rounded-xl bg-mb-brand px-6 py-3 font-semibold text-white hover:bg-mb-brandDark"
                          >
                            Özgarişlarni saqlaş
                          </SubmitButton>
                        </form>
                      </details>
                    </article>
                  );
                }

                const block = item.block;

                const blockQuestions = questionsByBlock.get(block.id) ?? [];

                const imageUrl = blockImageUrlMap.get(block.id);

                /* Mustaqil ish: ball yo'q, faqat videoyechim qo'shiladi */
                if (block.block_type === "self_study") {
                  return (
                    <article
                      key={`block-${block.id}`}
                      className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm"
                    >
                      <p className="font-semibold">
                        <span className="text-mb-brand">
                          {block.order_number}.
                        </span>{" "}
                        <span className="text-xs font-semibold text-mb-muted">
                          Mustaqil iş · ball berilmaydi
                        </span>
                      </p>

                      {block.stimulus_text && (
                        <div className="mt-2 text-sm leading-6">
                          <MathValue value={block.stimulus_text} />
                        </div>
                      )}

                      {imageUrl && (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={imageUrl}
                          alt={`${block.order_number}-savol çizmasi`}
                          className="mt-3 max-h-72 w-auto max-w-full rounded-xl border border-slate-200 object-contain"
                        />
                      )}

                      <form
                        action={updateSelfStudyVideo}
                        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
                      >
                        <input type="hidden" name="testId" value={test.id} />
                        <input type="hidden" name="blockId" value={block.id} />

                        <label className="block min-w-0 flex-1 text-sm font-semibold">
                          Videoyeçim havolasi
                          <input
                            name="selfStudyVideoUrl"
                            type="url"
                            defaultValue={block.solution_video_url ?? ""}
                            placeholder="https://youtu.be/…"
                            className={inputClass}
                          />
                        </label>

                        <button
                          type="submit"
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-mb-brand px-4 text-sm font-semibold text-white transition hover:bg-mb-brandDark"
                        >
                          Saqlaş
                        </button>
                      </form>
                    </article>
                  );
                }

                const isWritten = block.block_type === "written_parts";

                const sharedOptions = [
                  ["A", block.option_a],
                  ["B", block.option_b],
                  ["C", block.option_c],
                  ["D", block.option_d],
                  ["E", block.option_e],
                  ["F", block.option_f],
                ] as const;

                return (
                  <article
                    key={`block-${block.id}`}
                    className="rounded-2xl border border-mb-line bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">
                        <span className="text-mb-brand">
                          {isWritten
                            ? `${block.order_number}.`
                            : `${block.order_number}–${block.order_number + 2}.`}
                        </span>{" "}
                        <span className="text-xs font-semibold text-mb-muted">
                          {isWritten ? "a)–b) yozma" : "A–F blok"}
                        </span>
                      </p>

                      <RowMenu>
                        <form action={deleteQuestionBlock}>
                          <input type="hidden" name="testId" value={test.id} />
                          <input type="hidden" name="blockId" value={block.id} />
                          <ConfirmSubmitButton
                            className={rowMenuDanger}
                            title="Blok öçirilsinmi?"
                            description="Blok va uning içidagi barça savollar butunlay öçiriladi."
                          >
                            Blokni öçiriş
                          </ConfirmSubmitButton>
                        </form>
                      </RowMenu>
                    </div>

                    {block.stimulus_text && (
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        <MathValue value={block.stimulus_text} />
                      </div>
                    )}

                    {imageUrl && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <img
                          loading="lazy"
                          decoding="async"
                          src={imageUrl}
                          alt="Umumiy savol çizmasi"
                          className="mx-auto max-h-[260px] w-auto max-w-full rounded-lg object-contain"
                        />
                      </div>
                    )}

                    {!isWritten && (
                      <div className="mt-3 grid gap-1.5 text-sm sm:grid-cols-3">
                        {sharedOptions.map(([letter, option]) => (
                          <div
                            key={letter}
                            className="flex items-start gap-2 rounded-lg px-3 py-1.5 text-slate-700"
                          >
                            <span className="font-bold">{letter})</span>
                            <div className="min-w-0 flex-1">
                              <MathValue value={option} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 space-y-2">
                      {blockQuestions.map((question, index) => {
                        const answer = answerMap.get(question.id);

                        const displayLabel = isWritten
                          ? `${question.part_label})`
                          : `${
                              question.part_label ?? block.order_number + index
                            }.`;

                        return (
                          <div
                            key={question.id}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 items-start gap-2 font-semibold">
                                <span className="shrink-0 text-blue-700">
                                  {displayLabel}
                                </span>
                                <div className="min-w-0">
                                  <MathValue value={question.question_text} />
                                </div>
                              </div>

                              <div className="shrink-0 rounded-lg bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                                <span>Javob: </span>
                                <MathValue value={answer?.correct_answer} />
                              </div>
                            </div>

                            {isWritten &&
                              answer &&
                              answer.accepted_answers.length > 0 && (
                                <div className="mt-3 text-sm text-slate-500">
                                  <span>Qabul qilinadigan boşqa javoblar:</span>
                                  <div className="mt-1">
                                    <MathValue
                                      value={answer.accepted_answers.join(", ")}
                                    />
                                  </div>
                                </div>
                              )}

                            {answer?.solution_text && (
                              <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                                <strong>Yeçim:</strong>
                                <div className="mt-2">
                                  <MathValue value={answer.solution_text} />
                                </div>
                              </div>
                            )}

                            {answer?.solution_video_url && (
                              <a
                                href={answer.solution_video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-block text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
                              >
                                Videoyeçimni oçiş →
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <details className="group/edit mt-2 rounded-xl open:border open:border-slate-200 open:bg-slate-50">
                      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand group-open/edit:px-4">
                        Tahrirlaş
                      </summary>

                      <form
                        action={updateQuestionBlock}
                        className="border-t border-slate-200 bg-white p-5"
                      >
                        <input type="hidden" name="testId" value={test.id} />
                        <input type="hidden" name="blockId" value={block.id} />
                        <input
                          type="hidden"
                          name="blockType"
                          value={block.block_type}
                        />

                        <label className="block text-sm font-semibold">
                          Umumiy matn
                        </label>

                        <textarea
                          name="editStimulusText"
                          rows={4}
                          defaultValue={block.stimulus_text ?? ""}
                          className={textareaClass}
                        />

                        <label className="mt-5 block text-sm font-semibold">
                          Umumiy rasmni almaştiriş
                          <span className="ml-1 font-normal text-slate-500">
                            (ixtiyoriy)
                          </span>
                        </label>

                        <input
                          name="editBlockImage"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className={fileInputClass}
                        />

                        {block.image_path && (
                          <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-red-600">
                            <input
                              type="checkbox"
                              name="removeCurrentImage"
                              value="true"
                              className="h-4 w-4"
                            />
                            Joriy rasmni öçiriş
                          </label>
                        )}

                        {isWritten ? (
                          <div className="mt-6 grid gap-5 lg:grid-cols-2">
                            {blockQuestions.map((question) => {
                              const partAnswer = answerMap.get(question.id);
                              const isPartA = question.part_label === "a";
                              const prefix = isPartA
                                ? "editPartA"
                                : "editPartB";

                              return (
                                <div
                                  key={`edit-written-${question.id}`}
                                  className="rounded-2xl border border-slate-200 p-5"
                                >
                                  <h4 className="text-lg font-bold">
                                    {question.part_label}) qism
                                  </h4>

                                  <label className="mt-4 block text-sm font-semibold">
                                    Savol matni
                                  </label>

                                  <textarea
                                    name={`${prefix}Text`}
                                    required
                                    rows={3}
                                    defaultValue={question.question_text}
                                    className={textareaClass}
                                  />

                                  <label className="mt-4 block text-sm font-semibold">
                                    Töğri javob
                                  </label>

                                  <input
                                    name={`${prefix}Answer`}
                                    required
                                    defaultValue={
                                      partAnswer?.correct_answer ?? ""
                                    }
                                    className={inputClass}
                                  />

                                  <label className="mt-4 block text-sm font-semibold">
                                    Boşqa qabul qilinadigan javoblar
                                  </label>

                                  <textarea
                                    name={`${prefix}Accepted`}
                                    rows={2}
                                    defaultValue={
                                      partAnswer?.accepted_answers.join(", ") ??
                                      ""
                                    }
                                    className={textareaClass}
                                  />

                                  <label className="mt-4 block text-sm font-semibold">
                                    Yeçim
                                  </label>

                                  <textarea
                                    name={`${prefix}Solution`}
                                    rows={3}
                                    defaultValue={
                                      partAnswer?.solution_text ?? ""
                                    }
                                    className={textareaClass}
                                  />

                                  <label className="mt-4 block text-sm font-semibold">
                                    Videoyeçim
                                  </label>

                                  <input
                                    name={`${prefix}Video`}
                                    type="url"
                                    defaultValue={
                                      partAnswer?.solution_video_url ?? ""
                                    }
                                    className={inputClass}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <h4 className="mt-6 text-lg font-bold">
                              Umumiy A–F variantlar
                            </h4>

                            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {sharedOptions.map(([letter, option]) => (
                                <div key={`edit-shared-${block.id}-${letter}`}>
                                  <label className="block text-sm font-semibold">
                                    {letter} variant
                                  </label>

                                  <input
                                    name={`editSharedOption${letter}`}
                                    required
                                    defaultValue={option ?? ""}
                                    className={inputClass}
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="mt-6 grid gap-5 lg:grid-cols-3">
                              {blockQuestions.map((question, index) => {
                                const sharedAnswer = answerMap.get(question.id);
                                const number = index + 1;

                                return (
                                  <div
                                    key={`edit-shared-question-${question.id}`}
                                    className="rounded-2xl border border-slate-200 p-5"
                                  >
                                    <h4 className="font-bold">
                                      {question.part_label ??
                                        block.order_number + index}
                                      -savol
                                    </h4>

                                    <label className="mt-4 block text-sm font-semibold">
                                      Savol matni
                                    </label>

                                    <textarea
                                      name={`editSharedQuestion${number}Text`}
                                      required
                                      rows={3}
                                      defaultValue={question.question_text}
                                      className={textareaClass}
                                    />

                                    <label className="mt-4 block text-sm font-semibold">
                                      Töğri javob
                                    </label>

                                    <select
                                      name={`editSharedQuestion${number}Answer`}
                                      required
                                      defaultValue={
                                        sharedAnswer?.correct_answer ?? "A"
                                      }
                                      className={inputClass}
                                    >
                                      {(
                                        ["A", "B", "C", "D", "E", "F"] as const
                                      ).map((letter) => (
                                        <option key={letter} value={letter}>
                                          {letter}
                                        </option>
                                      ))}
                                    </select>

                                    <label className="mt-4 block text-sm font-semibold">
                                      Yeçim
                                    </label>

                                    <textarea
                                      name={`editSharedQuestion${number}Solution`}
                                      rows={3}
                                      defaultValue={
                                        sharedAnswer?.solution_text ?? ""
                                      }
                                      className={textareaClass}
                                    />

                                    <label className="mt-4 block text-sm font-semibold">
                                      Videoyeçim
                                    </label>

                                    <input
                                      name={`editSharedQuestion${number}Video`}
                                      type="url"
                                      defaultValue={
                                        sharedAnswer?.solution_video_url ?? ""
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}

                        <SubmitButton
                          className="mt-6 rounded-xl bg-mb-brand px-6 py-3 font-semibold text-white hover:bg-mb-brandDark"
                        >
                          Özgarişlarni saqlaş
                        </SubmitButton>
                      </form>
                    </details>
                  </article>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </section>
    </main>
  );
}
