import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { GROUP_EXAM_CODE } from "@/lib/group-tests";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    topicId?: string | string[];
  }>;
};

type TopicRow = {
  id: number;
  section_id: number;
  title: string;
  description: string | null;
  order_number: number;
  is_published: boolean;
  is_free: boolean;
};

type SectionRow = {
  id: number;
  exam_type_id: number;
  title: string;
  description: string | null;
  order_number: number;
  is_published: boolean;
};

type ExamTypeRow = {
  id: number;
  code: string;
  title: string;
};

type TestRow = {
  id: number;
  section_id: number;
  topic_id: number | null;
  title: string;
  description: string | null;
  time_limit_minutes: number | string;
  order_number: number;
  is_published: boolean;
  is_free: boolean;
  created_at: string;
};

type LessonTestRow = {
  test_id: number;
};

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.is_active !== true) {
    redirect("/");
  }

  return supabase;
}

/*
 * Katalog o'zgarganda keshni yangilash. Bitta ro'yxat — yangi
 * sahifa qo'shilsa shu yerga qo'shiladi, har bir amalga alohida
 * yozilmaydi.
 */
function revalidateCatalog() {
  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/sections");
  revalidatePath("/admin/tests/section");
  revalidatePath("/admin/tests/topic");
  revalidatePath("/admin/tests/manage");
  revalidatePath("/tests");
  revalidatePath("/tests/sections");
  revalidatePath("/tests/topics");
  revalidatePath("/tests/list");
}

function readPositiveInteger(formData: FormData, name: string, label: string) {
  const value = Number(formData.get(name));

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} 0 dan katta butun son bo‘lishi kerak.`);
  }

  return value;
}

function readTimeLimit(formData: FormData) {
  const value = Number(formData.get("timeLimitMinutes"));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Test vaqti 0 dan katta son bo‘lishi kerak.");
  }

  return value;
}

async function createTest(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const sectionId = readPositiveInteger(formData, "sectionId", "Bo‘lim ID");
  const topicId = readPositiveInteger(formData, "topicId", "Mavzu ID");
  const orderNumber = readPositiveInteger(
    formData,
    "orderNumber",
    "Tartib raqami",
  );
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const timeLimitMinutes = readTimeLimit(formData);

  if (title.length < 3) {
    throw new Error("Test nomi kamida 3 ta belgidan iborat bo‘lsin.");
  }

  /*
   * `section_id` ham yoziladi: uy vazifasi testini aniqlaydigan
   * `is_group_only_test()` va eski hisobotlar aynan shu ustunga
   * tayanadi. Mavzu esa yangi qatlam.
   */
  const { error } = await supabase.from("tests").insert({
    section_id: sectionId,
    topic_id: topicId,
    title,
    description: description || null,
    time_limit_minutes: timeLimitMinutes,
    order_number: orderNumber,
    is_published: false,
    is_free: false,
  });

  if (error) {
    throw new Error(`Test saqlanmadi: ${error.message}`);
  }

  revalidateCatalog();
}

async function updateTest(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const testId = readPositiveInteger(formData, "testId", "Test ID");
  const orderNumber = readPositiveInteger(
    formData,
    "orderNumber",
    "Tartib raqami",
  );
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const timeLimitMinutes = readTimeLimit(formData);

  if (title.length < 3) {
    throw new Error("Test nomi kamida 3 ta belgidan iborat bo‘lsin.");
  }

  const { error } = await supabase
    .from("tests")
    .update({
      title,
      description: description || null,
      time_limit_minutes: timeLimitMinutes,
      order_number: orderNumber,
    })
    .eq("id", testId);

  if (error) {
    throw new Error(`Test tahrirlanmadi: ${error.message}`);
  }

  revalidateCatalog();
  revalidatePath("/tests/take");
}

/**
 * Testni boshqa mavzuga ko'chirish.
 *
 * Savollar, natijalar va uy vazifalari testning o'ziga bog'langan,
 * shuning uchun ular birga ko'chadi — faqat `topic_id` va u bilan
 * birga `section_id` o'zgaradi.
 *
 * Bitta nozik joy bor: guruh bo'limidagi test doim bepul qilib
 * qo'yiladi (db/10 dagi trigger). Uni ochiq bo'limga ko'chirganda
 * shu belgi qolib ketmasligi kerak, aks holda pulli mavzu ichida
 * bitta test bepul bo'lib qoladi.
 */
async function moveTest(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const testId = readPositiveInteger(formData, "testId", "Test ID");
  const targetTopicId = readPositiveInteger(
    formData,
    "targetTopicId",
    "Mavzu",
  );

  const { data: test, error: testError } = await supabase
    .from("tests")
    .select("id, section_id, topic_id")
    .eq("id", testId)
    .maybeSingle();

  if (testError || !test) {
    throw new Error("Ko‘chiriladigan test topilmadi.");
  }

  if (test.topic_id === targetTopicId) {
    throw new Error("Test allaqachon shu mavzuda turibdi.");
  }

  const { data: targetTopic, error: targetError } = await supabase
    .from("test_topics")
    .select("id, section_id")
    .eq("id", targetTopicId)
    .maybeSingle();

  if (targetError || !targetTopic) {
    throw new Error("Tanlangan mavzu topilmadi.");
  }

  /* Guruh yo'nalishidan chiqayotgan testdan bepul belgisi olinadi */
  const { data: sections, error: sectionsError } = await supabase
    .from("test_sections")
    .select("id, exam_type_id")
    .in("id", [test.section_id, targetTopic.section_id]);

  if (sectionsError) {
    throw new Error(`Bo‘limlar tekshirilmadi: ${sectionsError.message}`);
  }

  const sectionRows = (sections ?? []) as Array<{
    id: number;
    exam_type_id: number;
  }>;

  const sourceExamTypeId = sectionRows.find(
    (row) => row.id === test.section_id,
  )?.exam_type_id;
  const targetExamTypeId = sectionRows.find(
    (row) => row.id === targetTopic.section_id,
  )?.exam_type_id;

  const { data: examTypes, error: examTypesError } = await supabase
    .from("test_exam_types")
    .select("id, code")
    .in(
      "id",
      [sourceExamTypeId, targetExamTypeId].filter(
        (id): id is number => typeof id === "number",
      ),
    );

  if (examTypesError) {
    throw new Error(`Yo‘nalish tekshirilmadi: ${examTypesError.message}`);
  }

  const codeById = new Map(
    ((examTypes ?? []) as Array<{ id: number; code: string }>).map((row) => [
      row.id,
      row.code,
    ]),
  );

  const leavingGroupSection =
    codeById.get(sourceExamTypeId ?? -1) === GROUP_EXAM_CODE &&
    codeById.get(targetExamTypeId ?? -1) !== GROUP_EXAM_CODE;

  /* Yangi mavzuning oxiriga qo'yamiz */
  const { data: lastTest } = await supabase
    .from("tests")
    .select("order_number")
    .eq("topic_id", targetTopicId)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("tests")
    .update({
      topic_id: targetTopicId,
      section_id: targetTopic.section_id,
      order_number: (lastTest?.order_number ?? 0) + 1,
      ...(leavingGroupSection ? { is_free: false } : {}),
    })
    .eq("id", testId);

  if (error) {
    throw new Error(`Test ko‘chirilmadi: ${error.message}`);
  }

  revalidateCatalog();
  revalidatePath("/leaderboard");

  redirect(`/admin/tests/topic?topicId=${targetTopicId}`);
}

/**
 * Bitta testni qo'lda bepul qilish yoki qaytarish.
 *
 * Avtomatik qoida (birinchi bo'limning birinchi mavzusi) o'z holicha
 * ishlaydi; bu tugma undan tashqaridagi istisno uchun — masalan
 * ochiq dars yoki reklama testi.
 */
async function toggleTestFree(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const testId = readPositiveInteger(formData, "testId", "Test ID");
  const nextState = String(formData.get("nextState")) === "true";

  const { error } = await supabase
    .from("tests")
    .update({ is_free: nextState })
    .eq("id", testId);

  if (error) {
    throw new Error(`Bepullik o‘zgarmadi: ${error.message}`);
  }

  revalidateCatalog();
}

async function changeTestState(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const testId = readPositiveInteger(formData, "testId", "Test ID");
  const nextState = String(formData.get("nextState")) === "true";

  const { error } = await supabase
    .from("tests")
    .update({ is_published: nextState })
    .eq("id", testId);

  if (error) {
    throw new Error(`Test holati o‘zgarmadi: ${error.message}`);
  }

  revalidateCatalog();
  revalidatePath("/leaderboard");
}

async function duplicateTest(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const testId = readPositiveInteger(formData, "testId", "Test ID");

  const { data: source, error: sourceError } = await supabase
    .from("tests")
    .select(
      "section_id, topic_id, title, description, time_limit_minutes, is_free, order_number",
    )
    .eq("id", testId)
    .single();

  if (sourceError || !source) {
    throw new Error("Nusxa olinadigan test topilmadi.");
  }

  const { data: lastTest } = await supabase
    .from("tests")
    .select("order_number")
    .eq("topic_id", source.topic_id)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: copy, error: copyError } = await supabase
    .from("tests")
    .insert({
      section_id: source.section_id,
      topic_id: source.topic_id,
      title: `${source.title} (nusxa)`,
      description: source.description,
      time_limit_minutes: source.time_limit_minutes,
      is_free: false,
      is_published: false,
      order_number: (lastTest?.order_number ?? 0) + 1,
    })
    .select("id")
    .single();

  if (copyError || !copy) {
    throw new Error(`Nusxa yaratilmadi: ${copyError?.message}`);
  }

  try {
    // --- Bloklar (yozma va umumiy variantli savollar) ---
    const { data: blocks, error: blocksError } = await supabase
      .from("question_blocks")
      .select("*")
      .eq("test_id", testId)
      .order("order_number", { ascending: true });

    if (blocksError) {
      throw new Error(blocksError.message);
    }

    const blockIdMap = new Map<number, number>();

    for (const block of blocks ?? []) {
      const { id: oldId, test_id: _t, ...rest } = block as Record<string, unknown> & {
        id: number;
        test_id: number;
      };

      const { data: newBlock, error } = await supabase
        .from("question_blocks")
        .insert({ ...rest, test_id: copy.id })
        .select("id")
        .single();

      if (error || !newBlock) {
        throw new Error(error?.message ?? "Blok nusxalanmadi.");
      }

      blockIdMap.set(oldId, newBlock.id);
    }

    // --- Savollar ---
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", testId)
      .order("order_number", { ascending: true });

    if (questionsError) {
      throw new Error(questionsError.message);
    }

    const questionIdMap = new Map<number, number>();

    for (const question of questions ?? []) {
      const { id: oldId, test_id: _t, block_id, ...rest } =
        question as Record<string, unknown> & {
          id: number;
          test_id: number;
          block_id: number | null;
        };

      const { data: newQuestion, error } = await supabase
        .from("questions")
        .insert({
          ...rest,
          test_id: copy.id,
          block_id:
            block_id === null ? null : blockIdMap.get(block_id) ?? null,
        })
        .select("id")
        .single();

      if (error || !newQuestion) {
        throw new Error(error?.message ?? "Savol nusxalanmadi.");
      }

      questionIdMap.set(oldId, newQuestion.id);
    }

    // --- Javob kalitlari ---
    const oldQuestionIds = [...questionIdMap.keys()];

    if (oldQuestionIds.length > 0) {
      const { data: answerKeys, error: answersError } = await supabase
        .from("answer_keys")
        .select("*")
        .in("question_id", oldQuestionIds);

      if (answersError) {
        throw new Error(answersError.message);
      }

      const rows = (answerKeys ?? []).map((key) => {
        const { id: _id, question_id, ...rest } =
          key as Record<string, unknown> & {
            id: number;
            question_id: number;
          };

        return {
          ...rest,
          question_id: questionIdMap.get(question_id),
        };
      });

      if (rows.length > 0) {
        const { error } = await supabase.from("answer_keys").insert(rows);

        if (error) {
          throw new Error(error.message);
        }
      }
    }
  } catch (error) {
    // Yarim nusxa qolmasin
    await supabase.from("tests").delete().eq("id", copy.id);

    throw new Error(
      `Nusxa olinmadi: ${
        error instanceof Error ? error.message : "noma’lum xato"
      }`,
    );
  }

  revalidateCatalog();

  redirect(`/admin/tests/manage?testId=${copy.id}`);
}

async function deleteTest(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const testId = readPositiveInteger(formData, "testId", "Test ID");

  if (formData.get("confirm") !== "1") {
    throw new Error(
      "O‘chirishdan oldin tasdiqlash katakchasini belgilang.",
    );
  }

  /*
   * Test yolg'iz o'chirilmaydi: undan qolgan urinishlar reytingda,
   * natijalar tarixida va takrorlash ro'yxatida osilib qolardi.
   * Hammasini baza tomonidagi funksiya bir tranzaksiyada tozalaydi.
   */
  const { error } = await supabase.rpc("delete_test_completely", {
    p_test_id: testId,
  });

  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error(
        "Supabase’da db/27-testni-ochirish.sql faylini ishga tushiring.",
      );
    }

    throw new Error(`Test o‘chirilmadi: ${error.message}`);
  }

  revalidateCatalog();
  revalidatePath("/results");
  revalidatePath("/reyting");
  revalidatePath("/takrorlash");
}

export default async function AdminTopicTestsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const topicId = Number(singleValue(params.topicId));

  if (!Number.isInteger(topicId) || topicId <= 0) {
    notFound();
  }

  const supabase = await getAdminClient();

  const { data: topicData, error: topicError } = await supabase
    .from("test_topics")
    .select(
      "id, section_id, title, description, order_number, is_published, is_free",
    )
    .eq("id", topicId)
    .maybeSingle();

  if (topicError) {
    throw new Error(`Mavzu yuklanmadi: ${topicError.message}`);
  }

  if (!topicData) notFound();

  const topic = topicData as TopicRow;

  const { data: sectionData, error: sectionError } = await supabase
    .from("test_sections")
    .select(`
      id,
      exam_type_id,
      title,
      description,
      order_number,
      is_published
    `)
    .eq("id", topic.section_id)
    .maybeSingle();

  if (sectionError) {
    throw new Error(`Bo‘lim yuklanmadi: ${sectionError.message}`);
  }

  if (!sectionData) notFound();

  const section = sectionData as SectionRow;

  const { data: examTypeData, error: examTypeError } = await supabase
    .from("test_exam_types")
    .select("id, code, title")
    .eq("id", section.exam_type_id)
    .maybeSingle();

  if (examTypeError) {
    throw new Error(
      `Test yo‘nalishi yuklanmadi: ${examTypeError.message}`,
    );
  }

  if (!examTypeData) notFound();

  const examType = examTypeData as ExamTypeRow;

  const [
    testsResult,
    firstSectionResult,
    firstTopicResult,
    lessonTestsResult,
    allTopicsResult,
    allSectionsResult,
    allExamTypesResult,
  ] = await Promise.all([
    supabase
      .from("tests")
      .select(`
        id,
        section_id,
        topic_id,
        title,
        description,
        time_limit_minutes,
        order_number,
        is_published,
        is_free,
        created_at
      `)
      .eq("topic_id", topic.id)
      .order("order_number", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("test_sections")
      .select("id")
      .eq("exam_type_id", examType.id)
      .eq("is_published", true)
      .order("order_number", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),

    /* Bepul mavzu — birinchi bo'limning birinchi nashr qilingan mavzusi */
    supabase
      .from("test_topics")
      .select("id")
      .eq("section_id", section.id)
      .eq("is_published", true)
      .order("order_number", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("lesson_tests")
      .select("test_id"),

    /* Ko'chirish uchun barcha mavzular kerak */
    supabase
      .from("test_topics")
      .select("id, section_id, title, order_number")
      .order("order_number", { ascending: true })
      .order("id", { ascending: true }),

    supabase
      .from("test_sections")
      .select("id, exam_type_id, title, order_number")
      .order("order_number", { ascending: true })
      .order("id", { ascending: true }),

    supabase
      .from("test_exam_types")
      .select("id, code, title, order_number")
      .order("order_number", { ascending: true }),
  ]);

  if (testsResult.error) {
    throw new Error(`Testlar yuklanmadi: ${testsResult.error.message}`);
  }

  if (firstSectionResult.error) {
    throw new Error(
      `Bepul bo‘lim aniqlanmadi: ${firstSectionResult.error.message}`,
    );
  }

  if (lessonTestsResult.error) {
    throw new Error(
      `Dars testlari tekshirilmadi: ${lessonTestsResult.error.message}`,
    );
  }

  if (firstTopicResult.error) {
    throw new Error(
      `Bepul mavzu aniqlanmadi: ${firstTopicResult.error.message}`,
    );
  }

  if (
    allSectionsResult.error ||
    allExamTypesResult.error ||
    allTopicsResult.error
  ) {
    throw new Error(
      `Ro‘yxatlar yuklanmadi: ${
        allSectionsResult.error?.message ??
        allExamTypesResult.error?.message ??
        allTopicsResult.error?.message
      }`,
    );
  }

  const tests = (testsResult.data ?? []) as TestRow[];
  const lessonTestIds = new Set(
    ((lessonTestsResult.data ?? []) as LessonTestRow[]).map(
      (row) => row.test_id,
    ),
  );
  /*
   * Bepul qoidasi: yo'nalishning birinchi nashr qilingan bo'limi,
   * uning birinchi nashr qilingan mavzusi — o'sha mavzudagi barcha
   * testlar bepul. db/34 dagi `free_topic_id()` bilan bir xil.
   */
  const isFirstPublishedSection = firstSectionResult.data?.id === section.id;
  const isAutoFreeTopic =
    isFirstPublishedSection && firstTopicResult.data?.id === topic.id;

  /*
   * Mavzu qo'lda bepul qilingan bo'lsa ham undagi testlar ochiq.
   * Bepullik bo'limdan meros olinmaydi: Premium bo'lim ichidagi
   * bepul mavzu ham ishlaydi (db/35).
   */
  const isFreeTopic = isAutoFreeTopic || topic.is_free;

  /*
   * Ko'chirish ro'yxati: bo'lim nomi ostida o'sha bo'limning
   * mavzulari. Testning hozirgi mavzusi ro'yxatda ko'rinmaydi.
   */
  const allSections = (allSectionsResult.data ?? []) as Array<{
    id: number;
    exam_type_id: number;
    title: string;
  }>;

  const allTopics = (allTopicsResult.data ?? []) as Array<{
    id: number;
    section_id: number;
    title: string;
  }>;

  const allExamTypes = (allExamTypesResult.data ?? []) as ExamTypeRow[];

  const moveGroups = allExamTypes
    .flatMap((exam) =>
      allSections
        .filter((row) => row.exam_type_id === exam.id)
        .map((row) => ({
          title: `${exam.title} · ${row.title}`,
          topics: allTopics.filter(
            (item) => item.section_id === row.id && item.id !== topic.id,
          ),
        })),
    )
    .filter((group) => group.topics.length > 0);

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const textareaClass = `${inputClass} resize-none`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div>
            <Link
              href={`/admin/tests/section?sectionId=${section.id}`}
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← {section.title} mavzulariga qaytish
            </Link>
            <h1 className="text-xl font-bold sm:text-2xl">{topic.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {examType.title} · {section.title} — testlarni yarating, savollar
              qo‘shing va nashr holatini boshqaring.
            </p>
          </div>

          <Link
            href={`/tests/list?topicId=${topic.id}`}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Foydalanuvchi ko‘rinishi
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[390px_1fr] lg:py-12">
        <div>
          <form
            action={createTest}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <input type="hidden" name="sectionId" value={section.id} />
            <input type="hidden" name="topicId" value={topic.id} />
            <h2 className="text-2xl font-bold">Yangi test</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Test yaratilgach, “Savollarni boshqarish” orqali savollarni
              qo‘shasiz.
            </p>

            <label className="mt-6 block text-sm font-bold text-slate-700">
              Test nomi
            </label>
            <input
              name="title"
              required
              minLength={3}
              placeholder="Masalan: Algebra — 1-test"
              className={inputClass}
            />

            <label className="mt-5 block text-sm font-bold text-slate-700">
              Tavsif
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder="Masalan: 20 ta savoldan iborat test"
              className={textareaClass}
            />

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700">
                  Vaqt (daqiqa)
                </label>
                <input
                  name="timeLimitMinutes"
                  type="number"
                  min="0.01"
                  step="any"
                  defaultValue="30"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700">
                  Tartib raqami
                </label>
                <input
                  name="orderNumber"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={tests.length + 1}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {/*
              Guruh testlarida bepul/premium tushunchasi yo'q —
              uy vazifasi har doim ochiq, shuning uchun bu yo'nalishda
              hech qanday izoh ko'rsatilmaydi.
            */}
            {examType.code !== GROUP_EXAM_CODE && (
              <div
                className={
                  isFreeTopic
                    ? "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
                    : "mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800"
                }
              >
                {isAutoFreeTopic
                  ? "Bu yo‘nalishning birinchi mavzusi — bu yerdagi barcha testlar avtomatik bepul bo‘ladi."
                  : topic.is_free
                    ? "Bu mavzu qo‘lda bepul qilingan — bu yerdagi barcha testlar ochiq bo‘ladi."
                    : "Bu mavzudagi testlar Premium bo‘ladi. Bepul testlar yo‘nalishning birinchi bo‘limidagi birinchi mavzuda turadi."}
              </div>
            )}

            <SubmitButton
              className="mt-6 w-full rounded-xl bg-mb-brand px-5 py-3 font-bold text-white hover:bg-mb-brandDark"
            >
              Testni yaratish
            </SubmitButton>
          </form>
        </div>

        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-bold">Testlar</h2>
            <p className="mt-1 text-sm text-slate-500">Jami: {tests.length} ta</p>
          </div>

          {!tests.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-bold text-slate-700">Hozircha test yaratilmagan</p>
              <p className="mt-2 text-sm text-slate-500">
                Chap tomondagi forma orqali birinchi testni yarating.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tests.map((test) => {
                const isAutomaticFree = isFreeTopic;
                const isEffectivelyFree = test.is_free || isAutomaticFree;
                const isLessonTest = lessonTestIds.has(test.id);

                return (
                  <article
                    key={test.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                            {test.order_number}
                          </span>
                          <h3 className="text-xl font-bold">{test.title}</h3>
                          <span
                            className={
                              test.is_published
                                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"
                            }
                          >
                            {test.is_published ? "Faol" : "Qoralama"}
                          </span>
                          <span
                            className={
                              isEffectivelyFree
                                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                : "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                            }
                          >
                            {!isEffectivelyFree
                              ? "Premium"
                              : isAutoFreeTopic
                                ? "Avtomatik bepul"
                                : topic.is_free
                                  ? "Mavzu bepul"
                                  : "Bepul"}
                          </span>
                          {isLessonTest && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                              Darsga biriktirilgan
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-sm font-bold text-blue-700">
                          Vaqt: {test.time_limit_minutes} daqiqa
                        </p>
                        {test.description && (
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            {test.description}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link
                          href={`/admin/tests/manage?testId=${test.id}`}
                          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700"
                        >
                          Savollarni boshqarish
                        </Link>

                        <form action={duplicateTest}>
                          <input type="hidden" name="testId" value={test.id} />
                          <SubmitButton
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Nusxa olish
                          </SubmitButton>
                        </form>

                        <form action={changeTestState}>
                          <input type="hidden" name="testId" value={test.id} />
                          <input
                            type="hidden"
                            name="nextState"
                            value={String(!test.is_published)}
                          />
                          <SubmitButton
                            className={
                              test.is_published
                                ? "rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-200"
                                : "rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-200"
                            }
                          >
                            {test.is_published ? "Testni yopish" : "Nashr qilish"}
                          </SubmitButton>
                        </form>

                        {/*
                          Qo'lda bepul qilish. Mavzuning o'zi bepul
                          bo'lsa tugma kerak emas — test allaqachon
                          ochiq, bosish hech narsani o'zgartirmasdi.
                          Guruh testlari ham doim bepul (db/10).
                        */}
                        {!isAutomaticFree &&
                          examType.code !== GROUP_EXAM_CODE && (
                            <form action={toggleTestFree}>
                              <input
                                type="hidden"
                                name="testId"
                                value={test.id}
                              />
                              <input
                                type="hidden"
                                name="nextState"
                                value={String(!test.is_free)}
                              />
                              <SubmitButton
                                className={
                                  test.is_free
                                    ? "rounded-xl bg-blue-100 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-200"
                                    : "rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-200"
                                }
                              >
                                {test.is_free
                                  ? "Premium qilish"
                                  : "Bepul qilish"}
                              </SubmitButton>
                            </form>
                          )}
                      </div>
                    </div>

                    {moveGroups.length > 0 && (
                      <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50">
                        <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-blue-700">
                          Boshqa mavzuga ko‘chirish
                        </summary>

                        <form
                          action={moveTest}
                          className="border-t border-slate-200 bg-white p-5"
                        >
                          <input
                            type="hidden"
                            name="testId"
                            value={test.id}
                          />

                          <p className="text-sm leading-6 text-slate-600">
                            Savollari, natijalari va berilgan uy
                            vazifalari test bilan birga ko‘chadi —
                            hech narsa yo‘qolmaydi. Test yangi
                            mavzuning oxiriga qo‘yiladi.
                          </p>

                          {examType.code === GROUP_EXAM_CODE && (
                            <p className="mt-2 text-sm leading-6 text-amber-700">
                              Diqqat: guruh testini ochiq bo‘limga
                              ko‘chirsangiz u katalogda o‘quvchilarga
                              ko‘rinadi va bepul belgisi olib
                              tashlanadi.
                            </p>
                          )}

                          <label
                            htmlFor={`move-${test.id}`}
                            className="mt-4 block text-sm font-bold text-slate-700"
                          >
                            Qaysi mavzuga
                          </label>

                          <select
                            id={`move-${test.id}`}
                            name="targetTopicId"
                            required
                            className={inputClass}
                          >
                            {moveGroups.map((group) => (
                              <optgroup
                                key={group.title}
                                label={group.title}
                              >
                                {group.topics.map((row) => (
                                  <option key={row.id} value={row.id}>
                                    {row.title}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>

                          <SubmitButton className="mt-4 min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700">
                            Ko‘chirish
                          </SubmitButton>
                        </form>
                      </details>
                    )}

                    <details className="mt-5 rounded-2xl border border-red-200 bg-red-50/50">
                      <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-red-700">
                        Testni o‘chirish
                      </summary>

                      <div className="px-5 pb-5">
                        <p className="text-sm leading-6 text-red-900">
                          “{test.title}” testi butunlay o‘chiriladi.
                          Savollari, o‘quvchilar ishlagan natijalari,
                          reytingdagi balli, uy vazifasi sifatida
                          berilgan bo‘lsa o‘shandan olingan ball va
                          tangasi, takrorlash ro‘yxatidagi savollari —
                          hammasi birga ketadi va qaytarib bo‘lmaydi.
                        </p>

                        <p className="mt-2 text-sm leading-6 text-red-900">
                          Natijalar saqlanib qolishi kerak bo‘lsa
                          o‘chirmang — “Testni yopish” tugmasini
                          bosing, test o‘quvchilarga ko‘rinmay qoladi.
                        </p>

                        <form action={deleteTest} className="mt-4">
                          <input type="hidden" name="testId" value={test.id} />

                          <label className="flex items-center gap-2 text-sm font-bold text-red-700">
                            <input
                              type="checkbox"
                              name="confirm"
                              value="1"
                              className="h-4 w-4 accent-red-600"
                            />
                            Natijalari bilan birga o‘chirilishiga roziman
                          </label>

                          <SubmitButton
                            className="mt-3 min-h-11 rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700"
                          >
                            Ha, o‘chirilsin
                          </SubmitButton>
                        </form>
                      </div>
                    </details>

                    <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-blue-700">
                        Test ma’lumotlarini tahrirlash
                      </summary>
                      <form
                        action={updateTest}
                        className="border-t border-slate-200 bg-white p-5"
                      >
                        <input type="hidden" name="testId" value={test.id} />
                        <div className="grid gap-5 md:grid-cols-3">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700">
                              Test nomi
                            </label>
                            <input
                              name="title"
                              required
                              minLength={3}
                              defaultValue={test.title}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700">
                              Tartib raqami
                            </label>
                            <input
                              name="orderNumber"
                              type="number"
                              min="1"
                              step="1"
                              required
                              defaultValue={test.order_number}
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <label className="mt-5 block text-sm font-bold text-slate-700">
                          Tavsif
                        </label>
                        <textarea
                          name="description"
                          rows={3}
                          defaultValue={test.description ?? ""}
                          className={textareaClass}
                        />

                        <label className="mt-5 block text-sm font-bold text-slate-700">
                          Vaqt (daqiqada)
                        </label>
                        <input
                          name="timeLimitMinutes"
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          defaultValue={test.time_limit_minutes}
                          className={inputClass}
                        />

                        <SubmitButton
                          className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700"
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
      </section>
    </main>
  );
}
