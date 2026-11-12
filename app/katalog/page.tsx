import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight, ClipboardCheck, MonitorPlay } from "lucide-react";

import PageHeader from "@/components/ui/page-header";
import { accents } from "@/components/ui/section-visual";
import { getCatalogTree } from "@/lib/public-catalog-tree";
import { getCurrentUser } from "@/lib/supabase/current-user";

/*
 * Ochiq katalog: saytdagi barça test mavzulari, videodarslar va
 * darsliklar ro'yxati.
 *
 * Mehmon (va Google) shu yerda nima borligini ko'radi. Elementni
 * bosganda saytning o'z sahifasi ochiladi: mehmondan kirish
 * so'raladi, kirgandan keyin aynan o'sha mavzu yoki dars ochiladi.
 */
export const metadata: Metadata = {
  title: "Katalog — barça testlar, videodarslar va darsliklar",
  description:
    "Vepa Ustoz platformasidagi barça matematika test mavzulari, videodarslar va darslik yeçimlari röyxati.",
  alternates: { canonical: "/katalog" },
};

function SectionTitle({
  id,
  icon: Icon,
  tone,
  title,
  count,
}: {
  id: string;
  icon: typeof ClipboardCheck;
  tone: string;
  title: string;
  count: string;
}) {
  return (
    <div id={id} className="flex items-center gap-3">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" strokeWidth={2.1} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-mb-ink sm:text-xl">{title}</h2>
        <p className="text-sm text-mb-muted">{count}</p>
      </div>
    </div>
  );
}

function FreeBadge() {
  return (
    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      Bepul
    </span>
  );
}

const rowClass =
  "press flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-mb-brand";

export default async function CatalogPage() {
  const [tree, user] = await Promise.all([getCatalogTree(), getCurrentUser()]);
  const isGuest = !user;

  const topicCount =
    tree?.exams.reduce(
      (sum, exam) => sum + exam.sections.reduce((s, section) => s + section.topics.length, 0),
      0,
    ) ?? 0;
  const lessonCount =
    tree?.categories.reduce((sum, category) => sum + category.lessons.length, 0) ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 pb-24 text-slate-900 md:pb-10">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        title="Katalog"
        subtitle="Platformadagi barça mavzular"
        action={
          isGuest ? (
            <Link
              href="/auth/login?next=%2Fkatalog"
              className="press inline-flex min-h-10 items-center rounded-xl bg-mb-brand px-4 text-sm font-semibold text-white hover:bg-mb-brandDark"
            >
              Kiriş
            </Link>
          ) : null
        }
      />

      <div className="mx-auto max-w-5xl space-y-6 px-3 py-5 sm:px-6 sm:py-8">
        {/* Bölimlar böyiça tez ötiş */}
        <nav aria-label="Katalog bölimlari" className="flex flex-wrap gap-2">
          {[
            ["#testlar", "Testlar"],
            ["#darslar", "Videodarslar"],
            ["#yecimlar", "Darslik yeçimlari"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="press inline-flex min-h-10 items-center rounded-full border border-mb-line bg-white px-4 text-sm font-semibold text-slate-700 hover:border-mb-brand hover:text-mb-brand"
            >
              {label}
            </a>
          ))}
        </nav>

        {isGuest && (
          <p className="rounded-2xl border border-mb-line bg-white p-4 text-sm leading-6 text-slate-600">
            Istalgan mavzuni bosing: kirgandan yoki bepul röyxatdan
            ötgandan keyin aynan öşa mavzu oçiladi.{" "}
            <Link href="/auth/sign-up" className="font-semibold text-mb-brand hover:text-mb-brandDark">
              Bepul boşlaş
            </Link>
          </p>
        )}

        {!tree && (
          <p className="rounded-2xl border border-mb-line bg-white p-5 text-center text-sm text-mb-muted">
            Katalog hozir yuklanmadi. Birozdan keyin qayta urinib köring.
          </p>
        )}

        {tree && (
          <>
            <section className="space-y-3 scroll-mt-20" aria-labelledby="testlar">
              <SectionTitle
                id="testlar"
                icon={ClipboardCheck}
                tone={accents.tests.tile}
                title="Testlar"
                count={`${topicCount} ta mavzu`}
              />

              {tree.exams.map((exam) => (
                <details
                  key={exam.id}
                  className="group rounded-2xl border border-mb-line bg-white"
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-bold text-mb-ink">{exam.title}</span>
                      {exam.description && (
                        <span className="block truncate text-sm text-mb-muted">
                          {exam.description}
                        </span>
                      )}
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-90"
                      aria-hidden="true"
                    />
                  </summary>

                  <div className="space-y-4 border-t border-mb-line px-2 py-3 sm:px-3">
                    {exam.sections.map((section) => (
                      <div key={section.id}>
                        <h3 className="px-3 pb-1 text-sm font-bold uppercase tracking-wide text-slate-500">
                          {section.title}
                        </h3>
                        <ul>
                          {section.topics.map((topic) => (
                            <li key={topic.id}>
                              <Link href={`/tests/list?topicId=${topic.id}`} className={rowClass}>
                                <span className="min-w-0 flex-1">{topic.title}</span>
                                {topic.isFree && <FreeBadge />}
                                <span className="shrink-0 text-xs text-mb-muted">
                                  {topic.testCount} test
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </section>

            <section className="space-y-3 scroll-mt-20" aria-labelledby="darslar">
              <SectionTitle
                id="darslar"
                icon={MonitorPlay}
                tone={accents.content.tile}
                title="Videodarslar"
                count={`${lessonCount} ta dars`}
              />

              {tree.categories.map((category) => (
                <details
                  key={category.id}
                  className="group rounded-2xl border border-mb-line bg-white"
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <span className="font-bold text-mb-ink">
                      {category.title}
                      <span className="ml-2 text-sm font-normal text-mb-muted">
                        {category.lessons.length} ta dars
                      </span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-90"
                      aria-hidden="true"
                    />
                  </summary>

                  <ul className="border-t border-mb-line px-2 py-2 sm:px-3">
                    {category.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link href={`/lessons/view?lessonId=${lesson.id}`} className={rowClass}>
                          {lesson.orderNumber != null && (
                            <span className="w-8 shrink-0 text-xs font-semibold text-mb-muted">
                              {lesson.orderNumber}.
                            </span>
                          )}
                          <span className="min-w-0 flex-1">{lesson.title}</span>
                          {lesson.isFree && <FreeBadge />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </section>

            {tree.textbooks.length > 0 && (
              <section className="space-y-3 scroll-mt-20" aria-labelledby="yecimlar">
                <SectionTitle
                  id="yecimlar"
                  icon={BookOpen}
                  tone={accents.content.tile}
                  title="Darslik yeçimlari"
                  count={`${tree.textbooks.length} ta darslik`}
                />

                <ul className="rounded-2xl border border-mb-line bg-white px-2 py-2 sm:px-3">
                  {tree.textbooks.map((book) => (
                    <li key={book.id}>
                      <Link href={`/textbooks/topics?textbookId=${book.id}`} className={rowClass}>
                        <span className="min-w-0 flex-1">{book.title}</span>
                        {book.grade != null && (
                          <span className="shrink-0 text-xs text-mb-muted">{book.grade}-sinf</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
