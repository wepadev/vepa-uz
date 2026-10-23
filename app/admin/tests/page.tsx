import Link from "next/link";
import { redirect } from "next/navigation";
import { EyeOff, FileUp } from "lucide-react";

import { examIcon } from "@/lib/exam-visuals";
import { GROUP_EXAM_CODE } from "@/lib/group-tests";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ExamTypeRow = {
  id: number;
  code: "attestatsiya" | "milliy-sertifikat" | "sat" | "guruh-testlari";
  title: string;
  description: string | null;
  order_number: number;
  is_published: boolean;
};

type SectionRow = {
  id: number;
  exam_type_id: number;
};

type TestRow = {
  id: number;
  section_id: number | null;
};

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
 * Ikonkalar lib/exam-visuals.ts dan olinadi — foydalanuvchi katalogi
 * bilan bitta manba. Bu yerda faqat admin kartasining ranglari turadi.
 */
/*
 * Yo'nalish kartasining ko'rinishi.
 *
 * Avval har bir yo'nalish o'z rangiga ega edi (ko'k, yashil,
 * binafsha, moviy) va sahifa rang-barang bo'lib ketgandi. Endi
 * hammasi bitta brend ko'kida: yo'nalishni rang emas, ikonka va
 * nom ajratib turadi.
 */
const cardVisual = {
  accent: "bg-mb-brand",
  icon: "bg-mb-tint text-mb-brand",
  button: "bg-mb-brand hover:bg-mb-brandDark",
} as const;

export default async function AdminTestsPage() {
  const supabase = await getAdminClient();

  const [examTypesResult, sectionsResult, testsResult] = await Promise.all([
    supabase
      .from("test_exam_types")
      .select("id, code, title, description, order_number, is_published")
      .order("order_number", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("test_sections").select("id, exam_type_id"),
    supabase.from("tests").select("id, section_id").not("section_id", "is", null),
  ]);

  if (examTypesResult.error) {
    throw new Error(
      `Test yo‘nalishlari yuklanmadi: ${examTypesResult.error.message}`,
    );
  }

  if (sectionsResult.error) {
    throw new Error(
      `Test bo‘limlari yuklanmadi: ${sectionsResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(`Testlar soni yuklanmadi: ${testsResult.error.message}`);
  }

  const examTypes = (examTypesResult.data ?? []) as ExamTypeRow[];
  const sections = (sectionsResult.data ?? []) as SectionRow[];
  const tests = (testsResult.data ?? []) as TestRow[];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div>
            <Link
              href="/admin"
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← Admin panelga qaytish
            </Link>
            <h1 className="text-xl font-bold sm:text-2xl">Testlarni boshqarish</h1>
            <p className="mt-1 text-sm text-slate-500">
              Yo‘nalish → mavzu yoki bo‘lim → test tartibida kontent yarating.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/tests/import"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100"
            >
              <FileUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              PDF’dan test yaratish
            </Link>

            <Link
              href="/tests"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
            >
              Foydalanuvchi sahifasini ko‘rish
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero butun saytdagi bitta ohangda: tekis brend ko‘ki */}
        <div className="rounded-2xl border border-blue-100 bg-mb-brand p-6 text-white shadow-lg sm:p-9">
          <p className="text-sm font-bold text-blue-100">Yangi katalog tuzilmasi</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-5xl">
            Yo‘nalishni tanlang
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100 sm:text-base">
            Har bir yo‘nalishda bo‘limlar yaratasiz.
          </p>

          <p className="mt-3 inline-flex items-start gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs leading-5 text-blue-50 ring-1 ring-white/20 sm:text-sm">
            <EyeOff
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>
              “Guruhlar uchun maxsus testlar” katalogda ko‘rinmaydi. U yerdagi
              testlar faqat guruhga uy vazifasi qilib berilganda ochiladi.
            </span>
          </p>
        </div>

        {!examTypes.length ? (
          <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-lg font-bold text-slate-700">
              Katalog migratsiyasi hali ishlatilmagan
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Avval 25_test_catalog_hierarchy.sql faylini Supabase’da Run qiling.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {examTypes.map((examType) => {
              const visual = cardVisual;
              const ExamIcon = examIcon(examType.code);
              const isGroupExam = examType.code === GROUP_EXAM_CODE;
              const examSections = sections.filter(
                (section) => section.exam_type_id === examType.id,
              );
              const sectionIds = new Set(examSections.map((section) => section.id));
              const testCount = tests.filter(
                (test) => test.section_id !== null && sectionIds.has(test.section_id),
              ).length;

              return (
                <article
                  key={examType.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm"
                >
                  <div className={`h-2 ${visual.accent}`} />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className={`grid h-14 w-14 place-items-center rounded-2xl ${visual.icon}`}
                      >
                        <ExamIcon
                          className="h-7 w-7"
                          strokeWidth={1.9}
                          aria-hidden="true"
                        />
                      </span>
                      {isGroupExam ? (
                        <span
                          title="Bu yo‘nalish o‘quvchiga ko‘rinmaydi"
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                        >
                          <EyeOff
                            className="h-3.5 w-3.5"
                            strokeWidth={2.2}
                            aria-hidden="true"
                          />
                          Faqat admin
                        </span>
                      ) : (
                        <span
                          className={
                            examType.is_published
                              ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                              : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                          }
                        >
                          {examType.is_published ? "Faol" : "Yopiq"}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-5 text-2xl font-bold">{examType.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                      {examType.description || "Test yo‘nalishi"}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-3 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          Bo‘limlar
                        </p>
                        <p className="mt-1 text-xl font-bold">
                          {examSections.length}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          Testlar
                        </p>
                        <p className="mt-1 text-xl font-bold">{testCount}</p>
                      </div>
                    </div>

                    <Link
                      href={`/admin/tests/sections?exam=${encodeURIComponent(examType.code)}`}
                      className={`mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-center font-bold text-white ${visual.button}`}
                    >
                      Bo‘limlarni boshqarish
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
