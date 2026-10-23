/**
 * Bo'lim ichidagi mavzular.
 *
 * Katalog tartibi: yo'nalish -> bo'lim -> MAVZU -> test.
 * Testlar `/admin/tests/topic` sahifasida boshqariladi — bu yerda
 * faqat mavzular: yaratish, tartiblash, nashr qilish, o'chirish.
 */
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { GROUP_EXAM_CODE } from "@/lib/group-tests";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    sectionId?: string | string[];
  }>;
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

type TopicRow = {
  id: number;
  section_id: number;
  title: string;
  description: string | null;
  order_number: number;
  is_published: boolean;
  is_free: boolean;
};

type TestRow = {
  id: number;
  topic_id: number | null;
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
 * Katalog o'zgarganda keshni yangilash. Bitta ro'yxat — yangi sahifa
 * qo'shilsa shu yerga qo'shiladi, har bir amalga alohida yozilmaydi.
 */
function revalidateCatalog() {
  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/sections");
  revalidatePath("/admin/tests/section");
  revalidatePath("/admin/tests/topic");
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

function readTitle(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();

  if (title.length < 2) {
    throw new Error("Mavzu nomi kamida 2 ta belgidan iborat bo‘lsin.");
  }

  return title;
}

async function createTopic(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const sectionId = readPositiveInteger(formData, "sectionId", "Bo‘lim ID");
  const orderNumber = readPositiveInteger(
    formData,
    "orderNumber",
    "Tartib raqami",
  );
  const title = readTitle(formData);
  const description = String(formData.get("description") ?? "").trim();

  const { error } = await supabase.from("test_topics").insert({
    section_id: sectionId,
    title,
    description: description || null,
    order_number: orderNumber,
    is_published: false,
  });

  if (error) {
    throw new Error(`Mavzu saqlanmadi: ${error.message}`);
  }

  revalidateCatalog();
}

async function updateTopic(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const topicId = readPositiveInteger(formData, "topicId", "Mavzu ID");
  const orderNumber = readPositiveInteger(
    formData,
    "orderNumber",
    "Tartib raqami",
  );
  const title = readTitle(formData);
  const description = String(formData.get("description") ?? "").trim();

  const { error } = await supabase
    .from("test_topics")
    .update({
      title,
      description: description || null,
      order_number: orderNumber,
    })
    .eq("id", topicId);

  if (error) {
    throw new Error(`Mavzu tahrirlanmadi: ${error.message}`);
  }

  revalidateCatalog();
}

async function changeTopicState(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const topicId = readPositiveInteger(formData, "topicId", "Mavzu ID");
  const nextState = String(formData.get("nextState")) === "true";

  const { error } = await supabase
    .from("test_topics")
    .update({ is_published: nextState })
    .eq("id", topicId);

  if (error) {
    throw new Error(`Mavzu holati o‘zgarmadi: ${error.message}`);
  }

  revalidateCatalog();
}

/**
 * Mavzuni qo'lda bepul qilish yoki qaytarish.
 *
 * Avtomatik qoida (birinchi bo'limning birinchi nashr qilingan
 * mavzusi) o'z holicha ishlaydi. Bu tugma undan tashqaridagi istisno
 * uchun: Premium bo'lim ichida ham bitta mavzuni ochiq qo'yish
 * mumkin — bepullik bo'limdan meros olinmaydi, har bir test
 * darajasida hal bo'ladi.
 */
async function toggleTopicFree(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const topicId = readPositiveInteger(formData, "topicId", "Mavzu ID");
  const nextState = String(formData.get("nextState")) === "true";

  const { error } = await supabase
    .from("test_topics")
    .update({ is_free: nextState })
    .eq("id", topicId);

  if (error) {
    throw new Error(`Bepullik o‘zgarmadi: ${error.message}`);
  }

  revalidateCatalog();
}

/**
 * Mavzuni o'chirish.
 *
 * Ichida test turgan mavzu o'chirilmaydi. Sabab: testda o'quvchilar
 * natijalari, reyting balli va uy vazifalari bo'lishi mumkin —
 * mavzu bilan birga ularni yo'qotib yubormaslik kerak. Avval
 * testlarni boshqa mavzuga ko'chiring yoki o'chiring.
 */
async function deleteTopic(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const topicId = readPositiveInteger(formData, "topicId", "Mavzu ID");

  const { count, error: countError } = await supabase
    .from("tests")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId);

  if (countError) {
    throw new Error(`Testlar tekshirilmadi: ${countError.message}`);
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      `Mavzuda ${count} ta test bor. Avval ularni ko‘chiring yoki o‘chiring.`,
    );
  }

  const { error } = await supabase
    .from("test_topics")
    .delete()
    .eq("id", topicId);

  if (error) {
    throw new Error(`Mavzu o‘chirilmadi: ${error.message}`);
  }

  revalidateCatalog();
}

export default async function AdminSectionTopicsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const sectionId = Number(singleValue(params.sectionId));

  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    notFound();
  }

  const supabase = await getAdminClient();

  const { data: sectionData, error: sectionError } = await supabase
    .from("test_sections")
    .select("id, exam_type_id, title, description, order_number, is_published")
    .eq("id", sectionId)
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
    throw new Error(`Test yo‘nalishi yuklanmadi: ${examTypeError.message}`);
  }

  if (!examTypeData) notFound();

  const examType = examTypeData as ExamTypeRow;

  const [topicsResult, testsResult, firstSectionResult] = await Promise.all([
    supabase
      .from("test_topics")
      .select(
        "id, section_id, title, description, order_number, is_published, is_free",
      )
      .eq("section_id", section.id)
      .order("order_number", { ascending: true })
      .order("id", { ascending: true }),

    supabase.from("tests").select("id, topic_id").eq("section_id", section.id),

    supabase
      .from("test_sections")
      .select("id")
      .eq("exam_type_id", examType.id)
      .eq("is_published", true)
      .order("order_number", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (topicsResult.error) {
    throw new Error(`Mavzular yuklanmadi: ${topicsResult.error.message}`);
  }

  if (testsResult.error) {
    throw new Error(`Testlar soni yuklanmadi: ${testsResult.error.message}`);
  }

  if (firstSectionResult.error) {
    throw new Error(
      `Bepul bo‘lim aniqlanmadi: ${firstSectionResult.error.message}`,
    );
  }

  const topics = (topicsResult.data ?? []) as TopicRow[];

  const testCountByTopic = new Map<number, number>();

  for (const test of (testsResult.data ?? []) as TestRow[]) {
    if (test.topic_id === null) continue;

    testCountByTopic.set(
      test.topic_id,
      (testCountByTopic.get(test.topic_id) ?? 0) + 1,
    );
  }

  /*
   * Mavzusiz qolgan testlar: mavzu o'chirilganda yoki migratsiyadan
   * oldin yaratilganda shunday bo'ladi. Ular o'quvchiga ko'rinmaydi,
   * shuning uchun admin ularni ko'rib tursin.
   */
  const orphanCount = ((testsResult.data ?? []) as TestRow[]).filter(
    (test) => test.topic_id === null,
  ).length;

  /*
   * Avtomatik bepul mavzu: yo'nalishning birinchi NASHR QILINGAN
   * bo'limi, uning birinchi NASHR QILINGAN mavzusi. Qoralama mavzu
   * hisobga olinmaydi — u o'quvchiga umuman ko'rinmaydi.
   *
   * Shu sabab yangi yaratilgan mavzu "Premium" bo'lib turadi: u
   * hali qoralama. Nashr qilinsa avtomatik bepul bo'ladi, pastdagi
   * `pendingFreeTopicId` shuni oldindan aytib turadi.
   */
  const isFirstPublishedSection = firstSectionResult.data?.id === section.id;
  const firstPublishedIndex = topics.findIndex((topic) => topic.is_published);
  const freeTopicId =
    isFirstPublishedSection && firstPublishedIndex >= 0
      ? topics[firstPublishedIndex].id
      : null;

  /*
   * Qoralama mavzu nashr qilinsa bepul bo'ladimi: tartib bo'yicha
   * undan oldinda nashr qilingan mavzu bo'lmasa — ha.
   */
  const pendingFreeTopicId = isFirstPublishedSection
    ? topics.find(
        (topic, index) =>
          !topic.is_published &&
          (firstPublishedIndex < 0 || index < firstPublishedIndex),
      )?.id ?? null
    : null;

  const isGroupExam = examType.code === GROUP_EXAM_CODE;

  /* Ro'yxat ustidagi bitta qatorli tushuntirish */
  const freeTopicTitle =
    topics.find((topic) => topic.id === freeTopicId)?.title ?? null;
  const manualFreeCount = topics.filter((topic) => topic.is_free).length;

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const textareaClass = `${inputClass} resize-none`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div>
            <Link
              href={`/admin/tests/sections?exam=${encodeURIComponent(examType.code)}`}
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← {examType.title} bo‘limlariga qaytish
            </Link>
            <h1 className="text-xl font-bold sm:text-2xl">{section.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Mavzularni yarating va tartiblang. Testlar mavzu ichida turadi.
            </p>
          </div>

          <Link
            href={`/tests/topics?sectionId=${section.id}`}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Foydalanuvchi ko‘rinishi
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[390px_1fr] lg:py-12">
        <div>
          <form
            action={createTopic}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <input type="hidden" name="sectionId" value={section.id} />
            <h2 className="text-2xl font-bold">Yangi mavzu</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Mavzu avval qoralama holatda yaratiladi. Testlar tayyor
              bo‘lgach nashr qilasiz.
            </p>

            <label className="mt-6 block text-sm font-bold text-slate-700">
              Mavzu nomi
            </label>
            <input
              name="title"
              required
              minLength={2}
              placeholder="Masalan: Kvadrat tenglamalar"
              className={inputClass}
            />

            <label className="mt-5 block text-sm font-bold text-slate-700">
              Tavsif
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Ixtiyoriy — mavzu haqida qisqacha"
              className={textareaClass}
            />

            <label className="mt-5 block text-sm font-bold text-slate-700">
              Tartib raqami
            </label>
            <input
              name="orderNumber"
              type="number"
              min="1"
              step="1"
              defaultValue={topics.length + 1}
              required
              className={inputClass}
            />

            {examType.code !== GROUP_EXAM_CODE && (
              <div
                className={
                  isFirstPublishedSection
                    ? "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
                    : "mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800"
                }
              >
                {isFirstPublishedSection
                  ? "Bu yo‘nalishning birinchi bo‘limi. Tartib bo‘yicha birinchi nashr qilingan mavzudagi barcha testlar bepul bo‘ladi."
                  : "Bu bo‘limdagi mavzular Premium bo‘ladi. Bepul mavzu yo‘nalishning birinchi bo‘limida turadi."}
              </div>
            )}

            <SubmitButton className="mt-6 w-full rounded-xl bg-mb-brand px-5 py-3 font-bold text-white hover:bg-mb-brandDark">
              Mavzuni yaratish
            </SubmitButton>
          </form>

          {orphanCount > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              Bu bo‘limda mavzuga biriktirilmagan{" "}
              <strong>{orphanCount} ta test</strong> bor. Ular o‘quvchiga
              ko‘rinmaydi. db/34 migratsiyasini Supabase’da ishga
              tushirsangiz, ular “Umumiy” mavzusiga tushadi.
            </div>
          )}
        </div>

        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-bold">Mavzular</h2>
            <p className="mt-1 text-sm text-slate-500">
              Jami: {topics.length} ta
            </p>

            {!isGroupExam && (
              <div className="mt-3 rounded-2xl border border-mb-line bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                {!section.is_published ? (
                  <>
                    Bu bo‘lim hali <strong>qoralama</strong>. Avtomatik bepul
                    mavzu faqat nashr qilingan bo‘limlarda aniqlanadi.
                  </>
                ) : !isFirstPublishedSection ? (
                  <>
                    Avtomatik bepul mavzu yo‘nalishning{" "}
                    <strong>birinchi</strong> nashr qilingan bo‘limida
                    turadi. Bu bo‘lim birinchi emas, shuning uchun bu yerdagi
                    mavzular Premium.
                  </>
                ) : freeTopicTitle ? (
                  <>
                    Hozir <strong>“{freeTopicTitle}”</strong> avtomatik bepul
                    mavzu — bu bo‘limdagi birinchi nashr qilingan mavzu.
                  </>
                ) : (
                  <>
                    Hozir avtomatik bepul mavzu yo‘q: bu bo‘limda nashr
                    qilingan mavzu hali yo‘q. Qoralama mavzu o‘quvchiga
                    ko‘rinmaydi, shuning uchun u bepul ham bo‘lmaydi.
                  </>
                )}

                <span className="mt-2 block">
                  Undan tashqari istalgan mavzuni{" "}
                  <strong>qo‘lda bepul</strong> qilib qo‘ysangiz bo‘ladi —
                  bo‘lim Premium bo‘lsa ham o‘sha mavzu ochiq qoladi
                  {manualFreeCount > 0
                    ? ` (hozir ${manualFreeCount} ta shunday mavzu bor).`
                    : "."}
                </span>
              </div>
            )}
          </div>

          {!topics.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-bold text-slate-700">
                Hozircha mavzu yaratilmagan
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Chap tomondagi forma orqali birinchi mavzuni yarating.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topics.map((topic) => {
                const testCount = testCountByTopic.get(topic.id) ?? 0;
                const isAutoFree = topic.id === freeTopicId;
                const isPendingFree = topic.id === pendingFreeTopicId;
                const isFreeTopic = isAutoFree || topic.is_free;

                return (
                  <article
                    key={topic.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                            {topic.order_number}
                          </span>
                          <h3 className="text-xl font-bold">{topic.title}</h3>
                          <span
                            className={
                              topic.is_published
                                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"
                            }
                          >
                            {topic.is_published ? "Faol" : "Qoralama"}
                          </span>
                          {!isGroupExam && (
                            <span
                              className={
                                isFreeTopic
                                  ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                  : isPendingFree
                                    ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                                    : "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                              }
                            >
                              {topic.is_free
                                ? "Qo‘lda bepul"
                                : isAutoFree
                                  ? "Bepul mavzu"
                                  : isPendingFree
                                    ? "Nashr qilinsa bepul"
                                    : "Premium"}
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-sm font-bold text-blue-700">
                          {testCount} ta test
                        </p>
                        {topic.description && (
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            {topic.description}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link
                          href={`/admin/tests/topic?topicId=${topic.id}`}
                          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700"
                        >
                          Testlarni boshqarish
                        </Link>

                        <form action={changeTopicState}>
                          <input type="hidden" name="topicId" value={topic.id} />
                          <input
                            type="hidden"
                            name="nextState"
                            value={String(!topic.is_published)}
                          />
                          <SubmitButton
                            className={
                              topic.is_published
                                ? "rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-200"
                                : "rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-200"
                            }
                          >
                            {topic.is_published ? "Yopish" : "Nashr qilish"}
                          </SubmitButton>
                        </form>

                        {/*
                          Avtomatik bepul mavzuda tugma kerak emas:
                          u allaqachon ochiq, bosish hech narsani
                          o'zgartirmasdi. Guruh testlari ham doim
                          bepul (db/10).
                        */}
                        {!isGroupExam && !isAutoFree && (
                          <form action={toggleTopicFree}>
                            <input
                              type="hidden"
                              name="topicId"
                              value={topic.id}
                            />
                            <input
                              type="hidden"
                              name="nextState"
                              value={String(!topic.is_free)}
                            />
                            <SubmitButton
                              className={
                                topic.is_free
                                  ? "rounded-xl bg-blue-100 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-200"
                                  : "rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-200"
                              }
                            >
                              {topic.is_free
                                ? "Premium qilish"
                                : "Bepul qilish"}
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    </div>

                    <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-blue-700">
                        Mavzu ma’lumotlarini tahrirlash
                      </summary>
                      <form
                        action={updateTopic}
                        className="border-t border-slate-200 bg-white p-5"
                      >
                        <input type="hidden" name="topicId" value={topic.id} />
                        <div className="grid gap-5 md:grid-cols-3">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700">
                              Mavzu nomi
                            </label>
                            <input
                              name="title"
                              required
                              minLength={2}
                              defaultValue={topic.title}
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
                              defaultValue={topic.order_number}
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
                          defaultValue={topic.description ?? ""}
                          className={textareaClass}
                        />

                        <SubmitButton className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700">
                          O‘zgarishlarni saqlash
                        </SubmitButton>
                      </form>
                    </details>

                    {testCount === 0 ? (
                      <details className="mt-5 rounded-2xl border border-red-200 bg-red-50/50">
                        <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-red-700">
                          Mavzuni o‘chirish
                        </summary>

                        <div className="px-5 pb-5">
                          <p className="text-sm leading-6 text-red-900">
                            “{topic.title}” mavzusi o‘chiriladi. Ichida test
                            yo‘q, shuning uchun hech qanday natija yoki ball
                            yo‘qolmaydi.
                          </p>

                          <form action={deleteTopic} className="mt-4">
                            <input
                              type="hidden"
                              name="topicId"
                              value={topic.id}
                            />
                            <SubmitButton className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700">
                              Ha, o‘chirilsin
                            </SubmitButton>
                          </form>
                        </div>
                      </details>
                    ) : (
                      <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600">
                        Mavzuni o‘chirish uchun avval ichidagi{" "}
                        <strong>{testCount} ta testni</strong> boshqa mavzuga
                        ko‘chiring yoki o‘chiring.
                      </p>
                    )}
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
