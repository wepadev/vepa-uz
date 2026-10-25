import { notFound, redirect } from "next/navigation";

import { shuffleOptions } from "@/lib/shuffle";
import TestLockedScreen from "@/components/test-locked-screen";
import TestStartScreen from "@/components/test-start-screen";
import TestRunner, {
  type RunnerItem,
} from "@/components/test-runner";
import { requireSectionAccess } from "@/lib/require-section-access";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Test ishlash",
  description:
    "Test topshirish sahifasi.",
};

const QUESTION_IMAGE_BUCKET = "question-images";
const SIGNED_URL_SECONDS = 60 * 60 * 6;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type QuestionRow = {
  id: number;
  question_text: string;
  image_path: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  order_number: number;
  question_type: "multiple_choice" | "written";
  block_id: number | null;
  part_label: string | null;
};

type QuestionBlockRow = {
  id: number;
  block_type: "written_parts" | "shared_options";
  stimulus_text: string | null;
  image_path: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  option_f: string | null;
  order_number: number;
};

type TestSessionRow = {
  session_id: string;
  started_at: string;
  expires_at: string;
  remaining_seconds: number | string;
};

/** Yarim yo'lda saqlangan javob (db/14) */
type AnswerDraftRow = {
  question_id: number;
  answer: string | null;
};

async function getActiveClient(
  section: "tests" | "lessons",
) {
  const { supabase } =
    await requireSectionAccess(section);

  return supabase;
}

function parseSubmittedAnswers(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Javoblar formati noto‘g‘ri.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Javoblar ro‘yxati noto‘g‘ri.");
  }

  return parsed.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("question_id" in entry) ||
      !("answer" in entry)
    ) {
      throw new Error("Javoblardan biri noto‘g‘ri.");
    }

    const questionId = Number(entry.question_id);
    const answer = String(entry.answer ?? "").trim();

    if (!Number.isInteger(questionId) || questionId <= 0) {
      throw new Error("Savol raqami noto‘g‘ri.");
    }

    return {
      question_id: questionId,
      answer,
    };
  });
}

/**
 * Testni boshlash.
 *
 * Bu ataylab server action (POST), oddiy havola emas. Sabab:
 * ilgari boshlash `?start=1` manzili orqali bo'lardi va o'quvchi
 * testni topshirgach brauzerda "orqaga" bossa, o'sha manzilga
 * qaytib yangi sessiya ochilib ketardi — vaqt noldan ketardi,
 * tashlab ketilsa 0 ballik urinish yozilardi.
 *
 * POST so'rovini brauzer "orqaga" bosilganda qayta bajarmaydi,
 * shuning uchun endi bunday bo'lmaydi.
 */
async function beginTest(
  testId: number,
  lessonId: number | null,
  assignmentId: number | null,
) {
  "use server";

  const supabase = await getActiveClient(
    lessonId === null ? "tests" : "lessons",
  );

  const query = new URLSearchParams({ testId: String(testId) });

  if (lessonId !== null) {
    query.set("lessonId", String(lessonId));
  }

  if (assignmentId !== null) {
    query.set("assignmentId", String(assignmentId));
  }

  /*
   * Tekshiruvlar sahifada ham bor, lekin bu yerda takrorlanadi:
   * holatni o'zgartiradigan joy shu, shuning uchun himoya ham shu
   * yerda bo'lishi kerak.
   */
  if (assignmentId !== null) {
    await supabase.rpc("close_abandoned_sessions");

    const { data: access } = await supabase.rpc("assignment_access", {
      p_assignment_id: assignmentId,
    });

    if (access !== "ok") {
      const reason =
        access === "overdue"
          ? "Bu vazifaning muddati tugagan."
          : access === "done"
            ? "Bu vazifani allaqachon ishlagansiz."
            : access === "not_member"
              ? "Siz bu guruhda emassiz."
              : "Vazifa topilmadi.";

      redirect(`/homework?xato=${encodeURIComponent(reason)}`);
    }
  } else {
    // Guruh testini faqat vazifa havolasi bilan boshlash mumkin
    const { data: groupOnly } = await supabase.rpc("is_group_only_test", {
      p_test_id: testId,
    });

    if (groupOnly === true) {
      redirect(
        `/homework?xato=${encodeURIComponent(
          "Bu test faqat uy vazifasi sifatida ochiladi.",
        )}`,
      );
    }
  }

  const { error } = await supabase.rpc("start_timed_test", {
    p_test_id: testId,
  });

  if (error) {
    query.set("xato", error.message);
  }

  /*
   * Sessiya id sini manzilga qo'shmaymiz — sahifa uni o'zi
   * active_test_session() orqali topadi. Shu tufayli manzil
   * "buyruq" bo'lmay qoladi va uni qayta ochish zararsiz.
   */
  redirect(`/tests/take?${query.toString()}`);
}

async function submitTimedTest(
  lessonId: number | null,
  assignmentId: number | null,
  formData: FormData,
) {
  "use server";

  const supabase = await getActiveClient(
    lessonId === null
      ? "tests"
      : "lessons",
  );

  const sessionId = String(
    formData.get("sessionId") ?? "",
  ).trim();

  const answersJson = String(
    formData.get("answersJson") ?? "[]",
  );

  if (!sessionId) {
    throw new Error("Test sessiyasi topilmadi.");
  }

  const answers = parseSubmittedAnswers(answersJson);

  const { data: attemptId, error } = await supabase.rpc(
    "submit_timed_test",
    {
      p_session_id: sessionId,
      p_answers: answers,
    },
  );

  if (error) {
    throw new Error(`Test tekshirilmadi: ${error.message}`);
  }

  if (typeof attemptId !== "string") {
    throw new Error("Natija raqami olinmadi.");
  }

  // Uy vazifasi bo'lsa — urinishni vazifaga bog'laymiz.
  // Bog'lanmasa ham natija saqlanadi, shuning uchun xato tashlamaymiz.
  if (assignmentId !== null) {
    const { error: linkError } = await supabase.rpc(
      "link_attempt_to_assignment",
      {
        p_attempt_id: attemptId,
        p_assignment_id: assignmentId,
      },
    );

    if (linkError) {
      console.error(
        "Urinish vazifaga bog'lanmadi:",
        linkError.message,
      );
    }
  }

  const lessonQuery =
    lessonId !== null
      ? `&lessonId=${encodeURIComponent(
          String(lessonId),
        )}`
      : "";

  redirect(
    `/results/view?attemptId=${encodeURIComponent(
      attemptId,
    )}${lessonQuery}`,
  );
}

async function createSignedUrlMap(
  supabase: SupabaseServerClient,
  rows: Array<{
    id: number;
    image_path: string | null;
  }>,
) {
  const result = new Map<number, string>();

  await Promise.all(
    rows.map(async (row) => {
      if (!row.image_path) {
        return;
      }

      const { data, error } = await supabase.storage
        .from(QUESTION_IMAGE_BUCKET)
        .createSignedUrl(
          row.image_path,
          SIGNED_URL_SECONDS,
        );

      if (!error && data?.signedUrl) {
        result.set(row.id, data.signedUrl);
      }
    }),
  );

  return result;
}

function makeOptions(
  values: Array<[string, string | null]>,
) {
  return values
    .filter(
      (
        option,
      ): option is [string, string] =>
        typeof option[1] === "string" &&
        option[1].trim().length > 0,
    )
    .map(([letter, text]) => ({
      letter,
      text,
    }));
}

type PageProps = {
  searchParams: Promise<{
    testId?: string | string[];
    lessonId?: string | string[];
    assignmentId?: string | string[];
    xato?: string | string[];
  }>;
};

export default async function TakeTestPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const testIdValue = Array.isArray(params.testId)
    ? params.testId[0]
    : params.testId;

  const testId = Number(testIdValue);

  const lessonIdValue = Array.isArray(
    params.lessonId,
  )
    ? params.lessonId[0]
    : params.lessonId;

  const parsedLessonId = Number(
    lessonIdValue,
  );

  const lessonId =
    lessonIdValue === undefined
      ? null
      : parsedLessonId;

  const assignmentIdValue = Array.isArray(
    params.assignmentId,
  )
    ? params.assignmentId[0]
    : params.assignmentId;

  const assignmentId =
    assignmentIdValue === undefined
      ? null
      : Number(assignmentIdValue);

  const startError = Array.isArray(params.xato)
    ? params.xato[0]
    : params.xato;

  if (!Number.isInteger(testId) || testId <= 0) {
    notFound();
  }

  if (
    assignmentId !== null &&
    (!Number.isInteger(assignmentId) || assignmentId <= 0)
  ) {
    notFound();
  }

  if (
    lessonId !== null &&
    (
      !Number.isInteger(lessonId) ||
      lessonId <= 0
    )
  ) {
    notFound();
  }

  const supabase = await getActiveClient(
    lessonId === null
      ? "tests"
      : "lessons",
  );

  const { data: test, error: testError } = await supabase
    .from("tests")
    .select(
      `
        id,
        title,
        description,
        is_published,
        time_limit_minutes
      `,
    )
    .eq("id", testId)
    .eq("is_published", true)
    .single();

  if (testError || !test) {
    notFound();
  }

  /*
   * "Guruhlar uchun maxsus testlar" yo'nalishidagi testlar katalogda
   * ko'rinmaydi, lekin manzilni qo'lda yozib kirish mumkin edi.
   * Shu tufayli bu yerda ham tekshiramiz: bunday test faqat vazifa
   * havolasi bilan (assignmentId bilan) ochiladi.
   *
   * db/06 hali ishga tushirilmagan bo'lsa RPC xato beradi — u holda
   * tekshiruvni o'tkazib yuboramiz, sayt ishlashda davom etadi.
   */
  if (assignmentId === null) {
    const groupOnlyResult = await supabase.rpc(
      "is_group_only_test",
      { p_test_id: testId },
    );

    if (groupOnlyResult.data === true) {
      redirect(
        `/homework?xato=${encodeURIComponent(
          "Bu test faqat uy vazifasi sifatida ochiladi.",
        )}`,
      );
    }
  }

  let validatedLessonId: number | null =
    null;

  if (lessonId !== null) {
    /*
     * Dars va test bog'lami `lesson_tests` jadvalida (db/28).
     * Eski `lessons.test_id` ustuni endi bo'sh — unga qarab
     * tekshirilsa, har bir dars testi "topilmadi" bo'lib qoladi.
     */
    const {
      data: lessonContext,
      error: lessonContextError,
    } = await supabase
      .from("lessons")
      .select("id, lesson_tests!inner(test_id)")
      .eq("id", lessonId)
      .eq("lesson_tests.test_id", testId)
      .eq("is_published", true)
      .maybeSingle();

    if (lessonContextError) {
      throw new Error(
        `Dars ma’lumoti tekshirilmadi: ${lessonContextError.message}`,
      );
    }

    if (!lessonContext) {
      notFound();
    }

    validatedLessonId =
      lessonContext.id;
  }

  /*
   * Uy vazifasi bo'lsa — boshlashdan oldin ruxsatni tekshiramiz:
   * guruh a'zosimi, muddat o'tmadimi, avval ishlamaganmi.
   */
  if (assignmentId !== null) {
    // Eski tashlab ketilgan sessiyalar hisobga olinsin
    await supabase.rpc("close_abandoned_sessions");

    const { data: access, error: accessError } =
      await supabase.rpc("assignment_access", {
        p_assignment_id: assignmentId,
      });

    if (accessError) {
      throw new Error(
        `Vazifa tekshirilmadi: ${accessError.message}`,
      );
    }

    if (access !== "ok") {
      const reason =
        access === "overdue"
          ? "Bu vazifaning muddati tugagan."
          : access === "done"
            ? "Bu vazifani allaqachon ishlagansiz."
            : access === "not_member"
              ? "Siz bu guruhda emassiz."
              : "Vazifa topilmadi.";

      redirect(
        `/homework?xato=${encodeURIComponent(reason)}`,
      );
    }
  }

  /*
   * Premium tekshiruvi.
   *
   * Asosiy himoya start_timed_test() ichida — u ruxsat bo'lmasa
   * xato tashlaydi. Bu yerdagi tekshiruv xavfsizlik uchun emas,
   * ko'rinish uchun: o'quvchi test nomini, savollar sonini ko'rib,
   * "Boshlash" bosgandan keyin qizil xato olmasin.
   *
   * RPC xato bersa (masalan db/08 hali ishga tushirilmagan bo'lsa)
   * to'sib qo'ymaymiz — baribir bazadagi himoya ishlaydi.
   */
  const { data: canAccess, error: accessCheckError } = await supabase.rpc(
    "can_access_test",
    { p_test_id: testId },
  );

  if (!accessCheckError && canAccess === false) {
    return (
      <TestLockedScreen
        title={test.title}
        backHref={validatedLessonId !== null ? "/lessons" : "/tests"}
      />
    );
  }

  /*
   * Ochiq sessiya bormi?
   *
   * Sahifa manzildan buyruq olmaydi — u shunchaki "shu o'quvchining
   * shu testda tugallanmagan sessiyasi bormi?" deb so'raydi.
   *
   *   bor  → o'sha sessiya davom ettiriladi (qolgan vaqti bilan)
   *   yo'q → boshlash ekrani ko'rsatiladi
   *
   * Shu sababli manzilni qayta ochish, yangilash yoki "orqaga"
   * bosish hech qachon yangi sessiya ochmaydi.
   */
  const { data: activeSessionData } = await supabase.rpc(
    "active_test_session",
    { p_test_id: testId },
  );

  const session = (
    Array.isArray(activeSessionData)
      ? activeSessionData[0]
      : activeSessionData
  ) as TestSessionRow | null;

  if (!session?.session_id || !session.expires_at) {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    const [countResult, writtenResult, recentResult] = await Promise.all([
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("test_id", testId),

      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("test_id", testId)
        .eq("question_type", "written"),

      currentUser
        ? supabase
            .from("attempts")
            .select("id, percentage, completed_at")
            .eq("user_id", currentUser.id)
            .eq("test_id", testId)
            .not("completed_at", "is", null)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const last = recentResult.data as
      | { id: string; percentage: number | string; completed_at: string }
      | null;

    // Oxirgi 15 daqiqada topshirilgan bo'lsa — "hozirgina" deb hisoblaymiz
    const justSubmitted =
      last &&
      Date.now() - new Date(last.completed_at).getTime() < 15 * 60 * 1000
        ? {
            attemptId: last.id,
            percentage: Number(last.percentage ?? 0),
          }
        : null;

    const backHref =
      assignmentId !== null
        ? "/homework"
        : validatedLessonId !== null
          ? `/lessons/view?lessonId=${validatedLessonId}`
          : "/tests";

    const backLabel =
      assignmentId !== null
        ? "Uy vazifalarim"
        : validatedLessonId !== null
          ? "Darsga qaytish"
          : "Testlar";

    return (
      <TestStartScreen
        title={test.title}
        description={test.description}
        questionCount={countResult.count ?? 0}
        timeLimitMinutes={test.time_limit_minutes ?? null}
        startAction={beginTest.bind(
          null,
          testId,
          validatedLessonId,
          assignmentId,
        )}
        backHref={backHref}
        backLabel={backLabel}
        isAssignment={assignmentId !== null}
        hasWrittenQuestions={(writtenResult.count ?? 0) > 0}
        recentAttempt={justSubmitted}
        errorMessage={startError ?? null}
      />
    );
  }

  const initialRemainingSeconds =
    Math.max(
      0,
      Math.floor(
        Number(
          session.remaining_seconds,
        ) || 0,
      ),
    );

  const [
    { data: questionData, error: questionsError },
    { data: blockData, error: blocksError },
    draftResult,
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

    /*
     * Qoralama javoblar (db/14).
     *
     * Telefon o'chib qolgan yoki brauzer yopilgan bo'lsa, o'quvchi
     * qaytib kirganda shu javoblar bilan davom etadi. Migratsiya
     * hali ishga tushirilmagan bo'lsa xato qaytadi — sahifa buzilmasin
     * deb uni ataylab e'tiborsiz qoldiramiz.
     */
    supabase.rpc("load_answer_drafts", {
      p_session_id: session.session_id,
    }),
  ]);

  if (questionsError) {
    throw new Error(
      `Savollar yuklanmadi: ${questionsError.message}`,
    );
  }

  if (blocksError) {
    throw new Error(
      `Savol bloklari yuklanmadi: ${blocksError.message}`,
    );
  }

  const questions =
    (questionData ?? []) as QuestionRow[];

  const blocks =
    (blockData ?? []) as QuestionBlockRow[];

  /* Qoralamalarni "savol id → javob" ko'rinishiga o'tkazamiz */
  const savedAnswers: Record<string, string> = {};

  for (const row of (draftResult.data ??
    []) as AnswerDraftRow[]) {
    savedAnswers[String(row.question_id)] = row.answer ?? "";
  }

  if (questions.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
        <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h1 className="text-2xl font-bold">
            Savollar mavjud emas
          </h1>

          <p className="mt-3 text-slate-500">
            Bu testga hali savollar qo‘shilmagan.
          </p>
        </div>
      </main>
    );
  }

  const questionImageUrlMap =
    await createSignedUrlMap(
      supabase,
      questions,
    );

  const blockImageUrlMap =
    await createSignedUrlMap(
      supabase,
      blocks,
    );

  const questionsByBlock = new Map<
    number,
    QuestionRow[]
  >();

  for (const question of questions) {
    if (question.block_id === null) {
      continue;
    }

    const current =
      questionsByBlock.get(question.block_id) ?? [];

    current.push(question);

    questionsByBlock.set(
      question.block_id,
      current,
    );
  }

  for (const blockQuestions of questionsByBlock.values()) {
    blockQuestions.sort(
      (a, b) =>
        a.order_number - b.order_number,
    );
  }

  const items: RunnerItem[] = [];

  for (const question of questions) {
    if (question.block_id !== null) {
      continue;
    }

    items.push({
      kind: "choice",
      key: `question-${question.id}`,
      navNumber: question.order_number,
      questionId: question.id,
      questionText: question.question_text,
      imageUrl:
        questionImageUrlMap.get(question.id) ?? null,
      options: makeOptions([
        ["A", question.option_a],
        ["B", question.option_b],
        ["C", question.option_c],
        ["D", question.option_d],
      ]),
    });
  }

  for (const block of blocks) {
    const blockQuestions =
      questionsByBlock.get(block.id) ?? [];

    const common = {
      stimulusText: block.stimulus_text,
      imageUrl:
        blockImageUrlMap.get(block.id) ?? null,
    };

    if (block.block_type === "written_parts") {
      items.push({
        kind: "written",
        key: `written-${block.id}`,
        navNumber: block.order_number,
        ...common,
        parts: blockQuestions.map((question) => ({
          questionId: question.id,
          label: question.part_label ?? "",
          text: question.question_text,
        })),
      });

      continue;
    }

    const options = makeOptions([
      ["A", block.option_a],
      ["B", block.option_b],
      ["C", block.option_c],
      ["D", block.option_d],
      ["E", block.option_e],
      ["F", block.option_f],
    ]);

    blockQuestions.forEach((question, index) => {
      items.push({
        kind: "choice",
        key: `shared-${block.id}-${question.id}`,
        navNumber: block.order_number + index,
        questionId: question.id,
        questionText: question.question_text,
        ...common,
        options,
      });
    });
  }

  items.sort(
    (a, b) => a.navNumber - b.navNumber,
  );

  /*
   * Variantlarni aralashtirish.
   *
   * Har o'quvchida boshqacha tartib chiqadi, lekin sahifa yangilansa
   * tartib o'zgarmaydi. Javob asl harfi bilan yuboriladi, shuning
   * uchun baholash mantig'i o'zgarishsiz qoladi.
   */
  const {
    data: { user: answeringUser },
  } = await supabase.auth.getUser();

  const shuffleSeedBase = `${answeringUser?.id ?? "anon"}:${testId}`;

  for (const item of items) {
    if (item.kind !== "choice") {
      continue;
    }

    item.options = shuffleOptions(
      item.options,
      `${shuffleSeedBase}:${item.questionId}`,
    );
  }

  const submitAction =
    submitTimedTest.bind(
      null,
      validatedLessonId,
      assignmentId,
    );

  return (
    <TestRunner
      title={test.title}
      description={test.description}
      sessionId={session.session_id}
      expiresAt={session.expires_at}
      initialRemainingSeconds={
        initialRemainingSeconds
      }
      items={items}
      savedAnswers={savedAnswers}
      submitAction={submitAction}
    />
  );
}
