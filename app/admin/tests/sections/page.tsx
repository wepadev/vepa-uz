import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { GROUP_EXAM_CODE } from "@/lib/group-tests";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    exam?: string | string[];
  }>;
};

type ExamTypeRow = {
  id: number;
  code: string;
  title: string;
  description: string | null;
};

type SectionRow = {
  id: number;
  exam_type_id: number;
  title: string;
  description: string | null;
  order_number: number;
  is_published: boolean;
  created_at: string;
};

type TestRow = {
  id: number;
  section_id: number | null;
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

function readPositiveInteger(formData: FormData, name: string, label: string) {
  const value = Number(formData.get(name));

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} 0 dan katta butun son bo‘lishi kerak.`);
  }

  return value;
}

async function createSection(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const examTypeId = readPositiveInteger(
    formData,
    "examTypeId",
    "Yo‘nalish ID",
  );
  const orderNumber = readPositiveInteger(
    formData,
    "orderNumber",
    "Tartib raqami",
  );
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (title.length < 2) {
    throw new Error("Bo‘lim nomi kamida 2 ta belgidan iborat bo‘lsin.");
  }

  const { error } = await supabase.from("test_sections").insert({
    exam_type_id: examTypeId,
    title,
    description: description || null,
    order_number: orderNumber,
    is_published: false,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Bo‘lim saqlanmadi: ${error.message}`);
  }

  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/sections");
  revalidatePath("/tests");
  revalidatePath("/tests/sections");
}

async function updateSection(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const sectionId = readPositiveInteger(formData, "sectionId", "Bo‘lim ID");
  const orderNumber = readPositiveInteger(
    formData,
    "orderNumber",
    "Tartib raqami",
  );
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (title.length < 2) {
    throw new Error("Bo‘lim nomi kamida 2 ta belgidan iborat bo‘lsin.");
  }

  const { error } = await supabase
    .from("test_sections")
    .update({
      title,
      description: description || null,
      order_number: orderNumber,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sectionId);

  if (error) {
    throw new Error(`Bo‘lim tahrirlanmadi: ${error.message}`);
  }

  revalidatePath("/admin/tests/sections");
  revalidatePath("/tests/sections");
  revalidatePath("/tests/list");
}

async function changeSectionState(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const sectionId = readPositiveInteger(formData, "sectionId", "Bo‘lim ID");
  const nextState = String(formData.get("nextState")) === "true";

  const { error } = await supabase
    .from("test_sections")
    .update({
      is_published: nextState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sectionId);

  if (error) {
    throw new Error(`Bo‘lim holati o‘zgarmadi: ${error.message}`);
  }

  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/sections");
  revalidatePath("/tests");
  revalidatePath("/tests/sections");
  revalidatePath("/tests/list");
}

async function deleteSection(formData: FormData) {
  "use server";

  const supabase = await getAdminClient();
  const sectionId = readPositiveInteger(formData, "sectionId", "Bo‘lim ID");

  /*
   * Ichida test bo'lsa o'chirishga yo'l qo'ymaymiz.
   * Aks holda testlar bilan birga o'quvchilarning natijalari ham
   * yo'q bo'lib ketardi. Avval testlarni o'chirish yoki
   * boshqa bo'limga ko'chirish kerak.
   */
  const { count, error: countError } = await supabase
    .from("tests")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId);

  if (countError) {
    throw new Error(`Bo‘lim tekshirilmadi: ${countError.message}`);
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      `Bo‘limda ${count} ta test bor. Avval testlarni o‘chiring, keyin bo‘limni o‘chirasiz.`,
    );
  }

  const { error } = await supabase
    .from("test_sections")
    .delete()
    .eq("id", sectionId);

  if (error) {
    throw new Error(`Bo‘lim o‘chirilmadi: ${error.message}`);
  }

  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/sections");
  revalidatePath("/tests");
  revalidatePath("/tests/sections");
}

export default async function AdminTestSectionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const examCode = String(singleValue(params.exam) ?? "").trim();

  if (!examCode) notFound();

  const supabase = await getAdminClient();

  const { data: examTypeData, error: examTypeError } = await supabase
    .from("test_exam_types")
    .select("id, code, title, description")
    .eq("code", examCode)
    .maybeSingle();

  if (examTypeError) {
    throw new Error(
      `Test yo‘nalishi yuklanmadi: ${examTypeError.message}`,
    );
  }

  if (!examTypeData) notFound();

  const examType = examTypeData as ExamTypeRow;

  const [sectionsResult, testsResult, topicsResult] = await Promise.all([
    supabase
      .from("test_sections")
      .select(`
        id,
        exam_type_id,
        title,
        description,
        order_number,
        is_published,
        created_at
      `)
      .eq("exam_type_id", examType.id)
      .order("order_number", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("tests").select("id, section_id").not("section_id", "is", null),
    supabase.from("test_topics").select("id, section_id, is_free"),
  ]);

  if (sectionsResult.error) {
    throw new Error(
      `Bo‘limlar yuklanmadi: ${sectionsResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(`Testlar soni yuklanmadi: ${testsResult.error.message}`);
  }

  if (topicsResult.error) {
    throw new Error(`Mavzular soni yuklanmadi: ${topicsResult.error.message}`);
  }

  const sections = (sectionsResult.data ?? []) as SectionRow[];
  const tests = (testsResult.data ?? []) as TestRow[];
  const topics = (topicsResult.data ?? []) as Array<{
    id: number;
    section_id: number;
    is_free: boolean;
  }>;
  const firstPublishedSectionId =
    sections.find((section) => section.is_published)?.id ?? null;
  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const textareaClass = `${inputClass} resize-none`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div>
            <Link
              href="/admin/tests"
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← Test yo‘nalishlariga qaytish
            </Link>
            <h1 className="text-xl font-bold sm:text-2xl">{examType.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Mavzular yoki bo‘limlarni yarating va tartiblang.
            </p>
          </div>

          <Link
            href={`/tests/sections?exam=${encodeURIComponent(examType.code)}`}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Foydalanuvchi ko‘rinishi
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[380px_1fr] lg:py-12">
        <div>
          <form
            action={createSection}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <input type="hidden" name="examTypeId" value={examType.id} />
            <h2 className="text-2xl font-bold">Yangi bo‘lim</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Masalan: Algebra, Geometriya, Sonlar va amallar yoki Mock testlar.
            </p>

            <label className="mt-6 block text-sm font-bold text-slate-700">
              Bo‘lim nomi
            </label>
            <input
              name="title"
              required
              minLength={2}
              placeholder="Masalan: Algebra"
              className={inputClass}
            />

            <label className="mt-5 block text-sm font-bold text-slate-700">
              Qisqacha tavsif
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder="Bo‘lim haqida qisqacha ma’lumot"
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
              defaultValue="1"
              required
              className={inputClass}
            />

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              Yangi bo‘lim avval qoralama holatda yaratiladi. Testlar tayyor
              bo‘lgach nashr qilasiz.
            </div>

            <SubmitButton
              className="mt-6 w-full rounded-xl bg-mb-brand px-5 py-3 font-bold text-white hover:bg-mb-brandDark"
            >
              Bo‘limni yaratish
            </SubmitButton>
          </form>
        </div>

        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-bold">Bo‘limlar</h2>
            <p className="mt-1 text-sm text-slate-500">
              Jami: {sections.length} ta. Birinchi nashr qilingan bo‘limning
              birinchi mavzusidagi barcha testlar bepul bo‘ladi.
            </p>
          </div>

          {!sections.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-bold text-slate-700">
                Hozircha bo‘lim yaratilmagan
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Chap tomondagi forma orqali birinchi bo‘limni yarating.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => {
                const testCount = tests.filter(
                  (test) => test.section_id === section.id,
                ).length;
                const sectionTopics = topics.filter(
                  (topic) => topic.section_id === section.id,
                );
                const topicCount = sectionTopics.length;
                const hasFreeTopic = sectionTopics.some(
                  (topic) => topic.is_free,
                );
                /*
                 * Guruh testlarida bepul/premium tushunchasi yo'q —
                 * uy vazifasi har doim ochiq. Shuning uchun bu
                 * yo'nalishda belgi ko'rsatilmaydi.
                 */
                const isAutomaticFreeSection =
                  examType.code !== GROUP_EXAM_CODE &&
                  section.id === firstPublishedSectionId;

                return (
                  <article
                    key={section.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                            {section.order_number}
                          </span>
                          <h3 className="text-xl font-bold">{section.title}</h3>
                          <span
                            className={
                              section.is_published
                                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"
                            }
                          >
                            {section.is_published ? "Nashr qilingan" : "Qoralama"}
                          </span>
                          {isAutomaticFreeSection && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                              Birinchi mavzu bepul
                            </span>
                          )}
                          {!isAutomaticFreeSection &&
                            hasFreeTopic &&
                            examType.code !== GROUP_EXAM_CODE && (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                                Qo‘lda bepul mavzu bor
                              </span>
                            )}
                        </div>

                        {section.description && (
                          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                            {section.description}
                          </p>
                        )}

                        <p className="mt-3 text-sm font-bold text-slate-500">
                          Mavzular:{" "}
                          <span className="text-slate-900">{topicCount} ta</span>
                          {" · "}
                          Testlar:{" "}
                          <span className="text-slate-900">{testCount} ta</span>
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link
                          href={`/admin/tests/section?sectionId=${section.id}`}
                          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700"
                        >
                          Mavzularni boshqarish
                        </Link>

                        <form action={changeSectionState}>
                          <input type="hidden" name="sectionId" value={section.id} />
                          <input
                            type="hidden"
                            name="nextState"
                            value={String(!section.is_published)}
                          />
                          <SubmitButton
                            className={
                              section.is_published
                                ? "rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-200"
                                : "rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-200"
                            }
                          >
                            {section.is_published ? "Bo‘limni yopish" : "Nashr qilish"}
                          </SubmitButton>
                        </form>
                      </div>
                    </div>

                    {testCount === 0 && (
                      <details className="mt-5 rounded-2xl border border-red-200 bg-red-50/50">
                        <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-red-700">
                          Bo‘limni o‘chirish
                        </summary>

                        <div className="px-5 pb-5">
                          <p className="text-sm leading-6 text-red-900">
                            “{section.title}” bo‘limi butunlay o‘chiriladi.
                            Bu amalni orqaga qaytarib bo‘lmaydi.
                          </p>

                          <form action={deleteSection} className="mt-4">
                            <input
                              type="hidden"
                              name="sectionId"
                              value={section.id}
                            />
                            <SubmitButton
                              className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700"
                            >
                              Ha, o‘chirilsin
                            </SubmitButton>
                          </form>
                        </div>
                      </details>
                    )}

                    {testCount > 0 && (
                      <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm leading-6 text-slate-600">
                        Bo‘limni o‘chirish uchun avval ichidagi{" "}
                        <strong>{testCount} ta testni</strong> o‘chiring —
                        aks holda o‘quvchilarning natijalari ham yo‘qoladi.
                      </p>
                    )}

                    <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-blue-700">
                        Bo‘lim ma’lumotlarini tahrirlash
                      </summary>
                      <form
                        action={updateSection}
                        className="border-t border-slate-200 bg-white p-5"
                      >
                        <input type="hidden" name="sectionId" value={section.id} />
                        <div className="grid gap-5 md:grid-cols-[1fr_160px]">
                          <div>
                            <label className="block text-sm font-bold text-slate-700">
                              Bo‘lim nomi
                            </label>
                            <input
                              name="title"
                              required
                              minLength={2}
                              defaultValue={section.title}
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
                              defaultValue={section.order_number}
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
                          defaultValue={section.description ?? ""}
                          className={textareaClass}
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
