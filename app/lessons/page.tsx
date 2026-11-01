import Link from "next/link";

import { MonitorPlay } from "lucide-react";

import ContentCard from "@/components/ui/content-card";

import {
  buildBestScoreMap,
  buildLessonTestMap,
  isLessonPassed,
} from "@/lib/lesson-progress";
import { requireSectionAccess } from "@/lib/require-section-access";

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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 py-2.5 sm:px-6 sm:py-5">
          <Link
            href="/"
            className="inline-flex min-h-8 items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            ← Boş sahifa
          </Link>

          <h1 className="mt-0.5 text-lg font-bold sm:text-2xl">
            Videodarslar
          </h1>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-12">
        <div className="rounded-2xl bg-mb-brand p-4 text-white shadow-lg sm:rounded-3xl sm:p-6">
          <h2 className="text-xl font-bold sm:text-3xl">
            Dars bölimlari
          </h2>

          <p className="mt-2 text-sm leading-6 text-blue-100">
            Keyingi dars test natijasi 90% ga yetganda oçiladi.
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
            <p className="text-lg font-bold">Hozirça dars yöq</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-7 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const metrics =
                categoryMetrics.get(
                  category.id,
                ) ?? {
                  total: 0,
                  completed: 0,
                };

              const percentage =
                metrics.total > 0
                  ? Math.round(
                      (metrics.completed /
                        metrics.total) *
                        100,
                    )
                  : 0;

              return (
                <ContentCard
                  key={category.id}
                  href={`/lessons/category?categoryId=${category.id}`}
                  title={category.title}
                  description={category.description ?? ""}
                  actionLabel={
                    metrics.total > 0
                      ? "Oçiş"
                      : "Dars yöq"
                  }
                  icon={MonitorPlay}
                  accent="content"
                  disabled={metrics.total === 0}
                  meta={`${metrics.completed} / ${metrics.total} dars`}
                  badge={
                    <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-mb-muted shadow-sm">
                      {category.order_number}-bölim
                    </span>
                  }
                >
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                    <div
                      className={
                        percentage === 100
                          ? "h-full rounded-full bg-emerald-500"
                          : "h-full rounded-full bg-emerald-600/70"
                      }
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </ContentCard>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
