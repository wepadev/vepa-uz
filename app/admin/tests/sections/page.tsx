import Link from "next/link";

import ConfirmSubmitButton from "@/components/admin/confirm-submit-button";
import CreatePanel from "@/components/admin/create-panel";
import RowMenu, { rowMenuDanger, rowMenuItem } from "@/components/admin/row-menu";
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

      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
        <CreatePanel label="Yangi bo‘lim" defaultOpen={sections.length === 0}>
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
        </CreatePanel>

        <div className="mt-5">
          <p className="mb-3 text-xs text-mb-muted">
            Birinchi nashr qilingan bo‘limning birinchi mavzusidagi testlar
            bepul bo‘ladi.
          </p>

          {sections.length > 0 && (
            <div className="space-y-2">
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
                    className="rounded-2xl border border-mb-line bg-white px-3 py-3 shadow-sm sm:px-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                        {section.order_number}
                      </span>

                      <Link
                        href={`/admin/tests/section?sectionId=${section.id}`}
                        className="min-w-0 flex-1"
                      >
                        <span className="block truncate text-[15px] font-semibold text-mb-ink hover:text-mb-brand">
                          {section.title}
                        </span>

                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mb-muted">
                          {!section.is_published && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                              Qoralama
                            </span>
                          )}
                          {(isAutomaticFreeSection ||
                            (hasFreeTopic && examType.code !== GROUP_EXAM_CODE)) && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                              {isAutomaticFreeSection ? "1-mavzu bepul" : "bepul mavzu bor"}
                            </span>
                          )}
                          <span>
                            {topicCount} mavzu · {testCount} test
                          </span>
                        </span>
                      </Link>

                      <RowMenu>
                        <form action={changeSectionState}>
                          <input type="hidden" name="sectionId" value={section.id} />
                          <input
                            type="hidden"
                            name="nextState"
                            value={String(!section.is_published)}
                          />
                          <SubmitButton className={rowMenuItem}>
                            {section.is_published ? "Bo‘limni yopish" : "Nashr qilish"}
                          </SubmitButton>
                        </form>

                        {testCount === 0 ? (
                          <form action={deleteSection}>
                            <input type="hidden" name="sectionId" value={section.id} />
                            <ConfirmSubmitButton
                              className={rowMenuDanger}
                              title="Bo‘lim o‘chirilsinmi?"
                              description={`“${section.title}” bo‘limi butunlay o‘chiriladi. Bu amalni orqaga qaytarib bo‘lmaydi.`}
                            >
                              O‘chirish
                            </ConfirmSubmitButton>
                          </form>
                        ) : (
                          <p className="px-3 py-2 text-xs leading-5 text-mb-muted">
                            O‘chirish uchun avval ichidagi {testCount} ta testni
                            o‘chiring.
                          </p>
                        )}
                      </RowMenu>
                    </div>

                    <details className="group/edit ml-11 mt-1 rounded-xl open:border open:border-slate-200 open:bg-slate-50">
                      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand group-open/edit:px-3">
                        Tahrirlash
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
