/**
 * Test boshqaruvi sahifasi.
 *
 * Fayl faqat ko'rinish uchun javob beradi. Ma'lumot o'zgartiradigan
 * kod `actions.ts` da, yordamchi funksiyalar `shared.ts` da.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

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

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const textareaClass =
  "mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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
  }>;
};

export default async function ManageTestPage({ searchParams }: PageProps) {
  const { testId: testIdValue } = await searchParams;

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
      .select(
        `
          id,
          test_id,
          block_type,
          stimulus_text,
          image_path,
          option_a,
          option_b,
          option_c,
          option_d,
          option_e,
          option_f,
          order_number
        `,
      )
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
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/admin/tests"
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← Testlarga qaytish
            </Link>

            <h1 className="text-xl font-bold sm:text-2xl">{test.title}</h1>

            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
              <span>{displayQuestionCount} ta savol</span>

              <span>•</span>

              <span>{test.time_limit_minutes} daqiqa</span>

              <span>•</span>

              <span>Maksimal ball: {maximumScore}</span>
            </div>

            {test.description && (
              <div className="mt-2 text-sm text-slate-500">
                <MathValue value={test.description} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <form action={renumberQuestionNumbers}>
              <input type="hidden" name="testId" value={test.id} />

              <SubmitButton
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
              >
                Raqamlarni tartiblash
              </SubmitButton>
            </form>

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
                    ? "rounded-xl bg-amber-100 px-5 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-200"
                    : "rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                }
              >
                {test.is_published
                  ? "Testni yopish"
                  : "Testni faollashtirish"}
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <details className="mb-8 rounded-2xl border border-mb-line bg-white shadow-sm">
          <summary className="cursor-pointer px-6 py-5 text-xl font-bold">
            Test nomi, tavsifi va vaqtini tahrirlash
          </summary>

          <form
            action={updateTestDetails}
            className="border-t border-slate-200 p-6"
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
              O‘zgarishlarni saqlash
            </SubmitButton>
          </form>
        </details>

        <div className="grid gap-8 lg:grid-cols-[430px_minmax(0,1fr)] lg:items-start xl:grid-cols-[460px_minmax(0,1fr)]">
          {/*
            top-20 = admin menyusi balandligi (64px) + bo'shliq.
            top-6 bo'lganda panel menyu ostiga kirib ketardi.
            max-h + overflow-y — panel o'zi ichida scroll bo'ladi,
            aks holda uzun kontentning pastiga yetib bo'lmaydi.
          */}
          {usedByStudents && (
            <div className="lg:col-span-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
              <p className="font-bold text-amber-900">
                Diqqat: bu testni {attemptCount} ta o‘quvchi ishlagan
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Savolni tahrirlasangiz yoki o‘chirsangiz, eski natijalar
                yangi savolga ishora qila boshlaydi — o‘quvchining
                “Batafsil” sahifasida javoblar noto‘g‘ri ko‘rinadi.
                Reyting ballari ham qayta hisoblanmaydi.
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Xato topgan bo‘lsangiz, tahrirlash o‘rniga yangi test
                yaratib, eskisini yopgan ma’qul.
              </p>
            </div>
          )}

          <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:pb-4 lg:pr-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Savol turini tanlang</h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Oddiy A–D test, a)–b) yozma savol yoki umumiy A–F variantli uchta
            savol blokini yaratishingiz mumkin. Barcha matn, variant, javob va
            yechim maydonlarida LaTeX ishlaydi. Inline formula uchun \( ... \),
            alohida formula uchun \[ ... \] yozing.
          </p>

          <div className="mt-6 space-y-4">
            <details
              open
              className="rounded-2xl border border-blue-200 bg-blue-50/40"
            >
              <summary className="cursor-pointer px-5 py-4 font-bold text-blue-900">
                1. Oddiy A–D variantli savol — 2 ball
              </summary>

              <form
                action={addMultipleChoiceQuestion}
                className="border-t border-blue-200 bg-white p-5"
              >
                <input type="hidden" name="testId" value={test.id} />

                <label className="block text-sm font-semibold">
                  Savol matni
                </label>

                <textarea
                  name="questionText"
                  required
                  rows={4}
                  placeholder="Masalan: 2 + 3 nechaga teng?"
                  className={textareaClass}
                />

                <label className="mt-5 block text-sm font-semibold">
                  Savol rasmi yoki chizmasi
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
                  To‘g‘ri javob
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
                      Yozma yechim
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
                      Videoyechim havolasi
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
                  className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Oddiy savolni qo‘shish
                </SubmitButton>
              </form>
            </details>

            <details className="rounded-2xl border border-blue-200 bg-blue-50/40">
              <summary className="cursor-pointer px-5 py-4 font-bold text-blue-900">
                2. a) va b) yozma savol — har bir qism 2 ball
              </summary>

              <form
                action={addWrittenPartsBlock}
                className="border-t border-blue-200 bg-white p-5"
              >
                <input type="hidden" name="testId" value={test.id} />

                <label className="block text-sm font-semibold">
                  Umumiy savol matni
                </label>

                <textarea
                  name="writtenStimulusText"
                  rows={4}
                  placeholder="a) va b) qismlariga tegishli umumiy shart"
                  className={textareaClass}
                />

                <label className="mt-5 block text-sm font-semibold">
                  Umumiy chizma yoki rasm
                  <span className="ml-1 font-normal text-slate-500">
                    (matn bo‘lmasa majburiy)
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
                        placeholder={`${part.label}) topshiriq`}
                        className={textareaClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        Asosiy to‘g‘ri javob
                      </label>

                      <input
                        name={`${part.prefix}Answer`}
                        required
                        placeholder="Masalan: 12"
                        className={inputClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        Boshqa qabul qilinadigan javoblar
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
                        Yechim
                      </label>

                      <textarea
                        name={`${part.prefix}Solution`}
                        rows={3}
                        placeholder="Ixtiyoriy"
                        className={textareaClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        Videoyechim
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
                  className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  a)–b) yozma savolni qo‘shish
                </SubmitButton>
              </form>
            </details>

            <details className="rounded-2xl border border-emerald-200 bg-emerald-50/40">
              <summary className="cursor-pointer px-5 py-4 font-bold text-emerald-900">
                3. Umumiy A–F variantli 3 ta savol — har biri 2 ball
              </summary>

              <form
                action={addSharedOptionsBlock}
                className="border-t border-emerald-200 bg-white p-5"
              >
                <input type="hidden" name="testId" value={test.id} />

                <label className="block text-sm font-semibold">
                  Uchta savol uchun umumiy matn
                </label>

                <textarea
                  name="sharedStimulusText"
                  rows={4}
                  placeholder="33–35-savollar uchun umumiy shart"
                  className={textareaClass}
                />

                <label className="mt-5 block text-sm font-semibold">
                  Umumiy chizma yoki rasm
                  <span className="ml-1 font-normal text-slate-500">
                    (matn bo‘lmasa majburiy)
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

                <h3 className="mt-7 text-lg font-bold">Uchta ichki savol</h3>

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
                        placeholder={`${number}-ichki savol`}
                        className={textareaClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        To‘g‘ri javob
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
                        Yechim
                      </label>

                      <textarea
                        name={`sharedQuestion${number}Solution`}
                        rows={3}
                        placeholder="Ixtiyoriy"
                        className={textareaClass}
                      />

                      <label className="mt-4 block text-sm font-semibold">
                        Videoyechim
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
                  Umumiy A–F blokni qo‘shish
                </SubmitButton>
              </form>
            </details>
          </div>
            </div>
          </aside>

          <div className="min-w-0">
          <div className="mb-5">
            <h2 className="text-2xl font-bold">Test savollari</h2>

            <p className="mt-1 text-sm text-slate-500">
              Jami: {displayQuestionCount} ta savol
            </p>
          </div>

          {displayItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <p className="font-semibold">Hozircha savol yo‘q</p>

              <p className="mt-2 text-sm text-slate-500">
                Yuqoridagi uchta turdan birini tanlab savol qo‘shing.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
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
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            Oddiy A–D savol
                          </span>

                          <div className="mt-3 flex items-start gap-2 text-lg font-bold">
                            <span className="shrink-0">{question.order_number}.</span>
                            <div className="min-w-0">
                              <MathValue value={question.question_text} />
                            </div>
                          </div>
                        </div>

                        <form action={deleteStandaloneQuestion}>
                          <input type="hidden" name="testId" value={test.id} />

                          <input
                            type="hidden"
                            name="questionId"
                            value={question.id}
                          />

                          <SubmitButton
                            className="text-sm font-semibold text-red-600 hover:text-red-700"
                          >
                            O‘chirish
                          </SubmitButton>
                        </form>
                      </div>

                      {imageUrl && (
                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <img
                            loading="lazy"
                            decoding="async"
                            src={imageUrl}
                            alt={`${question.order_number}-savol chizmasi`}
                            className="mx-auto max-h-[460px] w-auto max-w-full rounded-xl object-contain"
                          />
                        </div>
                      )}

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {options.map(([letter, option]) => (
                          <div
                            key={letter}
                            className={
                              answer?.correct_answer === letter
                                ? "flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800"
                                : "flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
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
                          <strong>Yechim:</strong>
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
                          Videoyechimni ochish →
                        </a>
                      )}

                      <details
                        id={`edit-question-${question.id}`}
                        className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/40"
                      >
                        <summary className="cursor-pointer px-5 py-4 font-bold text-blue-700">
                          Savolni tahrirlash
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
                            To‘g‘ri javob
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
                            Rasmni almashtirish
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
                              Joriy rasmni o‘chirish
                            </label>
                          )}

                          <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-sm font-semibold">
                                Yozma yechim
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
                                Videoyechim havolasi
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
                            className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                          >
                            O‘zgarishlarni saqlash
                          </SubmitButton>
                        </form>
                      </details>
                    </article>
                  );
                }

                const block = item.block;

                const blockQuestions = questionsByBlock.get(block.id) ?? [];

                const imageUrl = blockImageUrlMap.get(block.id);

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
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span
                          className={
                            isWritten
                              ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
                              : "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                          }
                        >
                          {isWritten
                            ? "a)–b) yozma savol"
                            : "Umumiy A–F variantli blok"}
                        </span>

                        <h3 className="mt-3 text-lg font-bold">
                          {isWritten
                            ? `${block.order_number}-savol`
                            : `${block.order_number}–${block.order_number + 2}-savollar`}
                        </h3>
                      </div>

                      <form action={deleteQuestionBlock}>
                        <input type="hidden" name="testId" value={test.id} />

                        <input type="hidden" name="blockId" value={block.id} />

                        <SubmitButton
                          className="text-sm font-semibold text-red-600 hover:text-red-700"
                        >
                          Blokni o‘chirish
                        </SubmitButton>
                      </form>
                    </div>

                    {block.stimulus_text && (
                      <div className="mt-5 whitespace-pre-wrap leading-7">
                        <MathValue value={block.stimulus_text} />
                      </div>
                    )}

                    {imageUrl && (
                      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <img
                          loading="lazy"
                          decoding="async"
                          src={imageUrl}
                          alt="Umumiy savol chizmasi"
                          className="mx-auto max-h-[520px] w-auto max-w-full rounded-xl object-contain"
                        />
                      </div>
                    )}

                    {!isWritten && (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sharedOptions.map(([letter, option]) => (
                          <div
                            key={letter}
                            className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <span className="font-bold">{letter})</span>
                            <div className="min-w-0 flex-1">
                              <MathValue value={option} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 space-y-4">
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
                            className="rounded-2xl border border-slate-200 p-5"
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
                                  <span>Qabul qilinadigan boshqa javoblar:</span>
                                  <div className="mt-1">
                                    <MathValue
                                      value={answer.accepted_answers.join(", ")}
                                    />
                                  </div>
                                </div>
                              )}

                            {answer?.solution_text && (
                              <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                                <strong>Yechim:</strong>
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
                                Videoyechimni ochish →
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <details className="mt-6 rounded-2xl border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer px-5 py-4 font-bold text-blue-700">
                        {isWritten
                          ? "a)–b) savolni tahrirlash"
                          : "Uch savolli A–F blokni tahrirlash"}
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
                          Umumiy rasmni almashtirish
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
                            Joriy rasmni o‘chirish
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
                                    To‘g‘ri javob
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
                                    Boshqa qabul qilinadigan javoblar
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
                                    Yechim
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
                                    Videoyechim
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
                                      To‘g‘ri javob
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
                                      Yechim
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
                                      Videoyechim
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
                          className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                        >
                          O‘zgarishlarni saqlash
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
