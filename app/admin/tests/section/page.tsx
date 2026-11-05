/**
 * Bo'lim ichidagi mavzular.
 *
 * Katalog tartibi: yo'nalish -> bo'lim -> MAVZU -> test.
 * Testlar `/admin/tests/topic` sahifasida boshqariladi — bu yerda
 * faqat mavzular: yaratish, tartiblash, nashr qilish, o'chirish.
 */
import Link from "next/link";

import ConfirmSubmitButton from "@/components/admin/confirm-submit-button";
import CreatePanel from "@/components/admin/create-panel";
import RowMenu, { rowMenuDanger, rowMenuItem } from "@/components/admin/row-menu";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { GROUP_EXAM_CODE } from "@/lib/group-tests";
import { getCurrentUser } from "@/lib/supabase/current-user";
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
  const user = await getCurrentUser();

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
    throw new Error(`${label} 0 dan katta butun son bölişi kerak.`);
  }

  return value;
}

function readTitle(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();

  if (title.length < 2) {
    throw new Error("Mavzu nomi kamida 2 ta belgidan iborat bölsin.");
  }

  return title;
}

async function createTopic(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const sectionId = readPositiveInteger(formData, "sectionId", "Bölim ID");
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
    throw new Error(`Mavzu holati özgarmadi: ${error.message}`);
  }

  /*
   * Mavzu naşr qilinganda uning içidagi barça qoralama testlar ham
   * naşr qilinadi — har birini alohida oçib çiqiş şart emas.
   * Mavzu yopilganda testlarga tegilmaydi: mavzu yopiq turganda
   * o'quvçi ularni baribir körmaydi.
   */
  if (nextState) {
    const { error: testsError } = await supabase
      .from("tests")
      .update({ is_published: true })
      .eq("topic_id", topicId)
      .eq("is_published", false);

    if (testsError) {
      throw new Error(
        `Mavzu naşr qilindi, lekin testlar naşr qilinmadi: ${testsError.message}`,
      );
    }

    revalidatePath("/leaderboard");
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
    throw new Error(`Bepullik özgarmadi: ${error.message}`);
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
    throw new Error(`Testlar tekşirilmadi: ${countError.message}`);
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      `Mavzuda ${count} ta test bor. Avval ularni köçiring yoki öçiring.`,
    );
  }

  const { error } = await supabase
    .from("test_topics")
    .delete()
    .eq("id", topicId);

  if (error) {
    throw new Error(`Mavzu öçirilmadi: ${error.message}`);
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
    throw new Error(`Bölim yuklanmadi: ${sectionError.message}`);
  }

  if (!sectionData) notFound();

  const section = sectionData as SectionRow;

  const { data: examTypeData, error: examTypeError } = await supabase
    .from("test_exam_types")
    .select("id, code, title")
    .eq("id", section.exam_type_id)
    .maybeSingle();

  if (examTypeError) {
    throw new Error(`Test yönalişi yuklanmadi: ${examTypeError.message}`);
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
      `Bepul bölim aniqlanmadi: ${firstSectionResult.error.message}`,
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
              ← {examType.title} bölimlariga qaytiş
            </Link>
            <h1 className="text-xl font-bold sm:text-2xl">{section.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Mavzularni yarating va tartiblang. Testlar mavzu içida turadi.
            </p>
          </div>

          <Link
            href={`/tests/topics?sectionId=${section.id}`}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Foydalanuvçi körinişi
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
        {orphanCount > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Bu bölimda mavzuga biriktirilmagan{" "}
            <strong>{orphanCount} ta test</strong> bor. Ular öquvçiga
            körinmaydi. db/34 migratsiyasini Supabase’da işga
            tuşirsangiz, ular “Umumiy” mavzusiga tuşadi.
          </div>
        )}

        <CreatePanel label="Yangi mavzu" defaultOpen={topics.length === 0}>
          <form
            action={createTopic}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <input type="hidden" name="sectionId" value={section.id} />
            <h2 className="text-2xl font-bold">Yangi mavzu</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Mavzu avval qoralama holatda yaratiladi. Testlar tayyor
              bölgaç naşr qilasiz.
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
              placeholder="Ixtiyoriy — mavzu haqida qisqaça"
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
                  ? "Bu yönalişning birinçi bölimi. Tartib böyiça birinçi naşr qilingan mavzudagi barça testlar bepul böladi."
                  : "Bu bölimdagi mavzular Premium böladi. Bepul mavzu yönalişning birinçi bölimida turadi."}
              </div>
            )}

            <SubmitButton className="mt-6 w-full rounded-xl bg-mb-brand px-5 py-3 font-bold text-white hover:bg-mb-brandDark">
              Mavzuni yaratiş
            </SubmitButton>
          </form>
        </CreatePanel>

        <div className="mt-5">
          <div className="mb-3">
            {!isGroupExam && (
              <details className="text-sm leading-6 text-slate-600">
                <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand">
                  Qaysi mavzu bepul böladi?
                </summary>
                <div className="mt-1 rounded-2xl border border-mb-line bg-white px-4 py-3">
                {!section.is_published ? (
                  <>
                    Bu bölim hali <strong>qoralama</strong>. Avtomatik bepul
                    mavzu faqat naşr qilingan bölimlarda aniqlanadi.
                  </>
                ) : !isFirstPublishedSection ? (
                  <>
                    Avtomatik bepul mavzu yönalişning{" "}
                    <strong>birinçi</strong> naşr qilingan bölimida
                    turadi. Bu bölim birinçi emas, şuning uçun bu yerdagi
                    mavzular Premium.
                  </>
                ) : freeTopicTitle ? (
                  <>
                    Hozir <strong>“{freeTopicTitle}”</strong> avtomatik bepul
                    mavzu — bu bölimdagi birinçi naşr qilingan mavzu.
                  </>
                ) : (
                  <>
                    Hozir avtomatik bepul mavzu yöq: bu bölimda naşr
                    qilingan mavzu hali yöq. Qoralama mavzu öquvçiga
                    körinmaydi, şuning uçun u bepul ham bölmaydi.
                  </>
                )}

                <span className="mt-2 block">
                  Undan taşqari istalgan mavzuni{" "}
                  <strong>qölda bepul</strong> qilib qöysangiz böladi —
                  bölim Premium bölsa ham öşa mavzu oçiq qoladi
                  {manualFreeCount > 0
                    ? ` (hozir ${manualFreeCount} ta şunday mavzu bor).`
                    : "."}
                </span>
                </div>
              </details>
            )}
          </div>

          {topics.length > 0 && (
            <div className="space-y-2">
              {topics.map((topic) => {
                const testCount = testCountByTopic.get(topic.id) ?? 0;
                const isAutoFree = topic.id === freeTopicId;
                const isPendingFree = topic.id === pendingFreeTopicId;
                const isFreeTopic = isAutoFree || topic.is_free;

                return (
                  <article
                    key={topic.id}
                    className="rounded-2xl border border-mb-line bg-white px-3 py-3 shadow-sm sm:px-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                        {topic.order_number}
                      </span>

                      <Link
                        href={`/admin/tests/topic?topicId=${topic.id}`}
                        className="min-w-0 flex-1"
                      >
                        <span className="block truncate text-[15px] font-semibold text-mb-ink hover:text-mb-brand">
                          {topic.title}
                        </span>

                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mb-muted">
                          {!topic.is_published && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                              Qoralama
                            </span>
                          )}
                          {!isGroupExam && (isFreeTopic || isPendingFree) && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                              {topic.is_free
                                ? "Qölda bepul"
                                : isAutoFree
                                  ? "Bepul"
                                  : "Naşr qilinsa bepul"}
                            </span>
                          )}
                          <span>{testCount} test</span>
                        </span>
                      </Link>

                      <RowMenu>
                        <form action={changeTopicState}>
                          <input type="hidden" name="topicId" value={topic.id} />
                          <input
                            type="hidden"
                            name="nextState"
                            value={String(!topic.is_published)}
                          />
                          <SubmitButton className={rowMenuItem}>
                            {topic.is_published ? "Yopiş" : "Naşr qiliş"}
                          </SubmitButton>
                        </form>

                        {/*
                          Avtomatik bepul mavzuda tugma kerak emas:
                          u allaqachon ochiq. Guruh testlari ham doim
                          bepul (db/10).
                        */}
                        {!isGroupExam && !isAutoFree && (
                          <form action={toggleTopicFree}>
                            <input type="hidden" name="topicId" value={topic.id} />
                            <input
                              type="hidden"
                              name="nextState"
                              value={String(!topic.is_free)}
                            />
                            <SubmitButton className={rowMenuItem}>
                              {topic.is_free ? "Premium qiliş" : "Bepul qiliş"}
                            </SubmitButton>
                          </form>
                        )}

                        {testCount === 0 ? (
                          <form action={deleteTopic}>
                            <input type="hidden" name="topicId" value={topic.id} />
                            <ConfirmSubmitButton
                              className={rowMenuDanger}
                              title="Mavzu öçirilsinmi?"
                              description={`“${topic.title}” mavzusi öçiriladi. Içida test yöq, heç qanday natija yöqolmaydi.`}
                            >
                              Öçiriş
                            </ConfirmSubmitButton>
                          </form>
                        ) : (
                          <p className="px-3 py-2 text-xs leading-5 text-mb-muted">
                            Öçiriş uçun avval içidagi {testCount} ta testni
                            köçiring yoki öçiring.
                          </p>
                        )}
                      </RowMenu>
                    </div>

                    <details className="group/edit ml-11 mt-1 rounded-xl open:border open:border-slate-200 open:bg-slate-50">
                      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand group-open/edit:px-3">
                        Tahrirlaş
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
      </section>
    </main>
  );
}
