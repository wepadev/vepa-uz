import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, EyeOff, FileUp, Settings2 } from "lucide-react";

import { examIcon } from "@/lib/exam-visuals";
import { GROUP_EXAM_CODE } from "@/lib/group-tests";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import PageHeader, { headerButton, headerPrimaryButton } from "@/components/ui/page-header";

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
  title: string;
  is_published: boolean;
};

type TopicRow = {
  id: number;
  section_id: number;
  title: string;
  is_published: boolean;
};

type TestRow = {
  id: number;
  section_id: number | null;
  topic_id: number | null;
  title: string;
  is_published: boolean;
};

/**
 * Testlar katalogi — bitta sahifada daraxt ko'rinishida.
 *
 * Ilgari testga yetish uchun to'rtta sahifadan o'tilardi:
 * yo'nalish → bo'lim → mavzu → test. Endi hammasi shu yerda
 * ochilib-yopiladigan ro'yxat: testni bosish bilan savollari
 * ochiladi.
 *
 * Yaratish, tartiblash va nashr qilish o'z sahifalarida qoldi —
 * har bir qatordagi ⚙ havolasi o'sha sahifaga olib boradi.
 */

/** Nashr qilinmaganlar uchun kichik yorliq */
function DraftBadge({ published }: { published: boolean }) {
  if (published) return null;

  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      Qoralama
    </span>
  );
}

/** Daraxt qatoridagi "boshqarish" havolasi */
function ManageLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-mb-brand hover:bg-blue-50"
    >
      <Settings2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      <span className="hidden sm:inline">Boşqariş</span>
    </Link>
  );
}

function TestLinks({ tests }: { tests: TestRow[] }) {
  if (tests.length === 0) {
    return <p className="px-3 py-2 text-xs text-mb-muted">Test yöq</p>;
  }

  return (
    <ul>
      {tests.map((test) => (
        <li key={test.id}>
          <Link
            href={`/admin/tests/manage?testId=${test.id}`}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
          >
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-mb-muted"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">{test.title}</span>
            <DraftBadge published={test.is_published} />
          </Link>
        </li>
      ))}
    </ul>
  );
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

export default async function AdminTestsPage() {
  const supabase = await getAdminClient();

  const [examTypesResult, sectionsResult, topicsResult, testsResult] =
    await Promise.all([
      supabase
        .from("test_exam_types")
        .select("id, code, title, description, order_number, is_published")
        .order("order_number", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("test_sections")
        .select("id, exam_type_id, title, is_published")
        .order("order_number", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("test_topics")
        .select("id, section_id, title, is_published")
        .order("order_number", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("tests")
        .select("id, section_id, topic_id, title, is_published")
        .not("section_id", "is", null)
        .order("order_number", { ascending: true })
        .order("id", { ascending: true }),
    ]);

  if (examTypesResult.error) {
    throw new Error(
      `Test yönalişlari yuklanmadi: ${examTypesResult.error.message}`,
    );
  }

  if (sectionsResult.error) {
    throw new Error(
      `Test bölimlari yuklanmadi: ${sectionsResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(`Testlar soni yuklanmadi: ${testsResult.error.message}`);
  }

  const examTypes = (examTypesResult.data ?? []) as ExamTypeRow[];
  const sections = (sectionsResult.data ?? []) as SectionRow[];
  const tests = (testsResult.data ?? []) as TestRow[];

  /* db/34 ishga tushirilmagan bo'lsa mavzular bo'sh — testlar "Mavzusiz"da */
  const topics = (topicsResult.data ?? []) as TopicRow[];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        sticky={false}
        backHref="/admin"
        backLabel="Admin panel"
        title="Testlar"
        subtitle="Yönaliş → bölim → mavzu → test. Oçiş uçun bosing."
        width="7xl"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/tests/yechimlar" className={headerButton}>
              Yozma yeçimlar
            </Link>
            <Link href="/tests" className={headerButton}>
              Öquvçi körinişi
            </Link>
          </div>
        }
      >
        <Link href="/admin/tests/import" className={headerPrimaryButton}>
          <FileUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          PDF’dan test yaratiş
        </Link>
      </PageHeader>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {!examTypes.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-lg font-bold text-slate-700">
              Katalog migratsiyasi hali işlatilmagan
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Avval 25_test_catalog_hierarchy.sql faylini Supabase’da Run qiling.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {examTypes.map((examType) => {
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
                <details
                  key={examType.id}
                  className="group overflow-hidden rounded-2xl border border-mb-line bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mb-tint text-mb-brand">
                      <ExamIcon className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold">{examType.title}</span>

                        {isGroupExam ? (
                          <span
                            title="Bu yönaliş öquvçiga körinmaydi — testlari faqat uy vazifasi bölib oçiladi"
                            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700"
                          >
                            <EyeOff className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
                            Faqat admin
                          </span>
                        ) : (
                          <DraftBadge published={examType.is_published} />
                        )}
                      </span>

                      <span className="block text-xs text-mb-muted">
                        {examSections.length} bölim · {testCount} test
                      </span>
                    </span>

                    <ManageLink
                      href={`/admin/tests/sections?exam=${encodeURIComponent(examType.code)}`}
                      label="Bölimlarni boşqariş"
                    />

                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-mb-muted transition group-open:rotate-90"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </summary>

                  <div className="space-y-2 border-t border-mb-line bg-slate-50/60 p-3">
                    {examSections.length === 0 && (
                      <p className="px-2 py-2 text-sm text-mb-muted">
                        Bölim yöq.{" "}
                        <Link
                          href={`/admin/tests/sections?exam=${encodeURIComponent(examType.code)}`}
                          className="font-semibold text-mb-brand"
                        >
                          Bölim yaratiş
                        </Link>
                      </p>
                    )}

                    {examSections.map((section) => {
                      const sectionTopics = topics.filter(
                        (topic) => topic.section_id === section.id,
                      );
                      const sectionTests = tests.filter(
                        (test) => test.section_id === section.id,
                      );
                      const topicIds = new Set(sectionTopics.map((topic) => topic.id));
                      const looseTests = sectionTests.filter(
                        (test) => test.topic_id === null || !topicIds.has(test.topic_id),
                      );

                      return (
                        <details
                          key={section.id}
                          className="group/section rounded-xl border border-mb-line bg-white"
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3">
                            <ChevronRight
                              className="h-4 w-4 shrink-0 text-mb-muted transition group-open/section:rotate-90"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate font-semibold">
                              {section.title}
                            </span>
                            <span className="shrink-0 text-xs text-mb-muted">
                              {sectionTests.length} test
                            </span>
                            <DraftBadge published={section.is_published} />
                            <ManageLink
                              href={`/admin/tests/section?sectionId=${section.id}`}
                              label="Mavzularni boşqariş"
                            />
                          </summary>

                          <div className="space-y-1 border-t border-mb-line px-2 py-2">
                            {sectionTopics.map((topic) => (
                              <div key={topic.id} className="rounded-lg">
                                <div className="flex items-center gap-2 px-3 pt-2">
                                  <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide text-slate-500">
                                    {topic.title}
                                  </span>
                                  <DraftBadge published={topic.is_published} />
                                  <ManageLink
                                    href={`/admin/tests/topic?topicId=${topic.id}`}
                                    label="Mavzu testlarini boşqariş"
                                  />
                                </div>

                                <TestLinks
                                  tests={sectionTests.filter(
                                    (test) => test.topic_id === topic.id,
                                  )}
                                />
                              </div>
                            ))}

                            {looseTests.length > 0 && (
                              <div>
                                {sectionTopics.length > 0 && (
                                  <p className="px-3 pt-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Mavzusiz
                                  </p>
                                )}
                                <TestLinks tests={looseTests} />
                              </div>
                            )}

                            {sectionTopics.length === 0 && looseTests.length === 0 && (
                              <p className="px-3 py-2 text-xs text-mb-muted">
                                Hali mavzu yoki test yöq.
                              </p>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
