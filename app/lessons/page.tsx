
import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";

import EmptyState from "@/components/ui/empty-state";
import ProgressRing from "@/components/ui/progress-ring";

import {
  buildBestScoreMap,
  buildLessonTestMap,
  isLessonPassed,
} from "@/lib/lesson-progress";
import { requireSectionAccess } from "@/lib/require-section-access";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Videodarslar",
  description:
    "Mavzular böyiça videodarslar va ular uçun testlar.",
};

type CategoryRow = {
  id: number;
  title: string;
  description: string | null;
  order_number: number;
};

type LessonRow = {
  id: number;
  category_id: number;
};

type LessonTestRow = {
  lesson_id: number;
  test_id: number;
};

type AttemptRow = {
  test_id: number;
  percentage: number | string;
};

export default async function LessonsPage() {
  const { supabase, user } = await requireSectionAccess("lessons");

  const [
    categoriesResult,
    lessonsResult,
    linksResult,
  ] = await Promise.all([
    supabase
      .from("lesson_categories")
      .select(`
        id,
        title,
        description,
        order_number
      `)
      .eq("is_published", true)
      .order("order_number", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      }),

    supabase
      .from("lessons")
      .select(`
        id,
        category_id
      `)
      .eq("is_published", true),

    supabase
      .from("lesson_tests")
      .select("lesson_id, test_id"),
  ]);

  if (categoriesResult.error) {
    throw new Error(
      `Dars bölimlari yuklanmadi: ${categoriesResult.error.message}`,
    );
  }

  if (lessonsResult.error) {
    throw new Error(
      `Darslar yuklanmadi: ${lessonsResult.error.message}`,
    );
  }

  if (linksResult.error) {
    throw new Error(
      `Dars testlari yuklanmadi: ${linksResult.error.message}`,
    );
  }

  const categories =
    (categoriesResult.data ??
      []) as CategoryRow[];

  const lessons =
    (lessonsResult.data ??
      []) as LessonRow[];

  const lessonIdSet = new Set(
    lessons.map((lesson) => lesson.id),
  );

  const testsByLesson = buildLessonTestMap(
    ((linksResult.data ?? []) as LessonTestRow[]).filter((row) =>
      lessonIdSet.has(row.lesson_id),
    ),
  );

  const testIds = [
    ...new Set([...testsByLesson.values()].flat()),
  ];

  let attempts: AttemptRow[] = [];

  if (testIds.length > 0) {
    const { data, error } = await supabase
      .from("attempts")
      .select("test_id, percentage")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .in("test_id", testIds);

    if (error) {
      throw new Error(
        `Test natijalari yuklanmadi: ${error.message}`,
      );
    }

    attempts = (data ?? []) as AttemptRow[];
  }

  const bestScoreMap = buildBestScoreMap(attempts);

  const categoryMetrics = new Map<
    number,
    {
      total: number;
      completed: number;
    }
  >();

  for (const category of categories) {
    const categoryLessons =
      lessons.filter(
        (lesson) =>
          lesson.category_id ===
          category.id,
      );

    const completed = categoryLessons.filter((lesson) =>
      isLessonPassed(
        testsByLesson.get(lesson.id) ?? [],
        bestScoreMap,
      ),
    ).length;

    categoryMetrics.set(category.id, {
      total: categoryLessons.length,
      completed,
    });
  }

  const totalLessons = lessons.length;
  const totalCompleted = [...categoryMetrics.values()].reduce(
    (sum, metrics) => sum + metrics.completed,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        glyph="lessons"
        title="Videodarslar"
        subtitle={
          totalLessons > 0
            ? `${totalCompleted} / ${totalLessons} dars ötilgan`
            : undefined
        }
      />

      <section className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {categories.length === 0 ? (
          <EmptyState glyph="lessons" title="Hozirça dars yöq">
            Darslar qöşilişi bilan şu yerda çiqadi.
          </EmptyState>
        ) : (
          <>
            <p className="eyebrow">Kurslar</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {categories.map((category) => {
                const metrics = categoryMetrics.get(category.id) ?? {
                  total: 0,
                  completed: 0,
                };

                const percentage =
                  metrics.total > 0
                    ? Math.round((metrics.completed / metrics.total) * 100)
                    : 0;

                const empty = metrics.total === 0;
                const done = !empty && metrics.completed === metrics.total;

                const body = (
                  <>
                    <ProgressRing
                      value={percentage}
                      size={60}
                      stroke={6}
                      tone={done ? "success" : "brand"}
                    >
                      <span className="num text-[13px] font-bold text-mb-ink">
                        {empty ? "—" : `${percentage}%`}
                      </span>
                    </ProgressRing>

                    <span className="min-w-0 flex-1">
                      <span className="eyebrow block text-[11px]">
                        {category.order_number}-kurs
                      </span>
                      <span className="mt-0.5 block text-[17px] font-bold leading-snug text-mb-ink">
                        {category.title}
                      </span>
                      <span className="num mt-1 block text-[13px] text-mb-muted">
                        {empty
                          ? "Darslar tez orada qöşiladi"
                          : done
                            ? `${metrics.total} darsning hammasi ötilgan`
                            : metrics.completed === 0
                              ? `${metrics.total} dars`
                              : `${metrics.completed} / ${metrics.total} dars ötilgan`}
                      </span>
                    </span>

                    {!empty && (
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    )}
                  </>
                );

                return empty ? (
                  <div
                    key={category.id}
                    className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 p-4 opacity-80"
                  >
                    {body}
                  </div>
                ) : (
                  <Link
                    key={category.id}
                    href={`/lessons/category?categoryId=${category.id}`}
                    className="edge group flex items-center gap-4 rounded-2xl border border-mb-line bg-white p-4"
                  >
                    {body}
                  </Link>
                );
              })}
            </div>

            <p className="mt-4 flex items-start gap-2 text-sm leading-5 text-mb-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Darslar ketma-ket oçiladi: dars testini 90% ga işlasangiz,
              keyingi dars oçiladi.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
