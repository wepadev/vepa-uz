import Link from "next/link";
import {
  revalidatePath,
} from "next/cache";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";
import CreateLessonForm from "@/components/admin/create-lesson-form";
import MathText from "@/components/math-text";
import YouTubeEmbed from "@/components/youtube-embed";
import SubmitButton from "@/components/ui/submit-button";

type PageProps = {
  searchParams: Promise<{
    categoryId?: string;
  }>;
};

type LessonRow = {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  video_url: string | null;
  content: string | null;
  order_number: number;
  is_published: boolean;
  created_at: string;
};

type LessonTestRow = {
  lesson_id: number;
  test_id: number;
};

type TestRow = {
  id: number;
  title: string;
  is_published: boolean;
};

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.is_active !== true
  ) {
    redirect("/");
  }

  return supabase;
}

function isValidVideoUrl(value: string) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

async function createLesson(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const supabase = await requireAdmin();

  const categoryId = Number(
    formData.get("categoryId"),
  );

  const title = String(
    formData.get("title") ?? "",
  ).trim();

  const description = String(
    formData.get("description") ?? "",
  ).trim();

  const videoUrl = String(
    formData.get("videoUrl") ?? "",
  ).trim();

  const content = String(
    formData.get("content") ?? "",
  ).trim();

  /* Bir darsga bir nechta test biriktirilishi mumkin */
  const testIds = formData
    .getAll("testIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  const errors: Record<string, string> = {};

  if (
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    return {
      status: "error",
      message:
        "Dars bo‘limi ma’lumotlari noto‘g‘ri.",
      errors: {},
    };
  }

  if (title.length < 2) {
    errors.title =
      "Dars nomini kiriting.";
  }

  if (title.length > 150) {
    errors.title =
      "Dars nomi 150 ta belgidan oshmasin.";
  }

  if (!videoUrl) {
    errors.videoUrl =
      "YouTube video havolasini kiriting.";
  } else if (!isValidVideoUrl(videoUrl)) {
    errors.videoUrl =
      "Video havolasini to‘liq kiriting.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message:
        "Qizil bilan ko‘rsatilgan joylarni to‘g‘rilang.",
      errors,
    };
  }

  const {
    data: category,
    error: categoryError,
  } = await supabase
    .from("lesson_categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();

  if (
    categoryError ||
    !category
  ) {
    return {
      status: "error",
      message:
        "Dars bo‘limi topilmadi.",
      errors: {},
    };
  }

  if (testIds.length > 0) {
    const {
      data: selectedTests,
      error: testError,
    } = await supabase
      .from("tests")
      .select("id")
      .in("id", testIds);

    if (
      testError ||
      (selectedTests ?? []).length !== testIds.length
    ) {
      return {
        status: "error",
        message:
          "Tanlangan testlardan biri topilmadi.",
        errors: {},
      };
    }
  }

  const {
    data: lastLesson,
    error: orderError,
  } = await supabase
    .from("lessons")
    .select("order_number")
    .eq("category_id", categoryId)
    .order("order_number", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    return {
      status: "error",
      message:
        "Darslar tartibini aniqlab bo‘lmadi.",
      errors: {},
    };
  }

  const nextOrderNumber =
    (lastLesson?.order_number ?? 0) + 1;

  const {
    data: createdLesson,
    error: insertError,
  } = await supabase
    .from("lessons")
    .insert({
      category_id: categoryId,
      title,
      description: description || null,
      video_url: videoUrl,
      content: content || null,
      order_number: nextOrderNumber,
      is_published: false,
    })
    .select("id")
    .single();

  if (insertError || !createdLesson) {
    return {
      status: "error",
      message:
        "Videodarsni saqlab bo‘lmadi.",
      errors: {},
    };
  }

  if (testIds.length > 0) {
    const { error: linkError } = await supabase
      .from("lesson_tests")
      .insert(
        testIds.map((id, index) => ({
          lesson_id: createdLesson.id,
          test_id: id,
          order_number: index + 1,
        })),
      );

    if (linkError) {
      return {
        status: "error",
        message: `Testlar biriktirilmadi: ${linkError.message}`,
        errors: {},
      };
    }
  }

  revalidatePath(
    "/admin/lessons/manage",
  );

  revalidatePath("/admin/lessons");
  revalidatePath("/lessons");

  redirect(
    `/admin/lessons/manage?categoryId=${categoryId}`,
  );
}

async function changeLessonState(
  formData: FormData,
) {
  "use server";

  const supabase = await requireAdmin();

  const categoryId = Number(
    formData.get("categoryId"),
  );

  const lessonId = Number(
    formData.get("lessonId"),
  );

  const nextState =
    formData.get("nextState") === "true";

  if (
    !Number.isInteger(categoryId) ||
    !Number.isInteger(lessonId) ||
    categoryId <= 0 ||
    lessonId <= 0
  ) {
    redirect("/admin/lessons");
  }

  const { error } = await supabase
    .from("lessons")
    .update({
      is_published: nextState,
    })
    .eq("id", lessonId)
    .eq("category_id", categoryId);

  if (error) {
    redirect(
      `/admin/lessons/manage?categoryId=${categoryId}`,
    );
  }

  revalidatePath(
    "/admin/lessons/manage",
  );

  revalidatePath("/admin/lessons");
  revalidatePath("/lessons");

  redirect(
    `/admin/lessons/manage?categoryId=${categoryId}`,
  );
}

async function deleteLesson(
  formData: FormData,
) {
  "use server";

  const supabase = await requireAdmin();

  const categoryId = Number(
    formData.get("categoryId"),
  );

  const lessonId = Number(
    formData.get("lessonId"),
  );

  if (
    !Number.isInteger(categoryId) ||
    !Number.isInteger(lessonId) ||
    categoryId <= 0 ||
    lessonId <= 0
  ) {
    redirect("/admin/lessons");
  }

  const { error: deleteError } =
    await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId)
      .eq("category_id", categoryId);

  if (deleteError) {
    redirect(
      `/admin/lessons/manage?categoryId=${categoryId}`,
    );
  }

  const {
    data: remainingLessons,
    error: remainingError,
  } = await supabase
    .from("lessons")
    .select("id")
    .eq("category_id", categoryId)
    .order("order_number", {
      ascending: true,
    })
    .order("id", {
      ascending: true,
    });

  if (!remainingError) {
    for (
      let index = 0;
      index <
      (remainingLessons?.length ?? 0);
      index += 1
    ) {
      const lesson =
        remainingLessons?.[index];

      if (!lesson) {
        continue;
      }

      await supabase
        .from("lessons")
        .update({
          order_number: index + 1,
        })
        .eq("id", lesson.id)
        .eq("category_id", categoryId);
    }
  }

  revalidatePath(
    "/admin/lessons/manage",
  );

  revalidatePath("/admin/lessons");
  revalidatePath("/lessons");

  redirect(
    `/admin/lessons/manage?categoryId=${categoryId}`,
  );
}

export default async function ManageLessonsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const categoryId = Number(
    params.categoryId,
  );

  if (
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    notFound();
  }

  const supabase = await requireAdmin();

  const [
    categoryResult,
    lessonsResult,
    testsResult,
    linksResult,
  ] = await Promise.all([
    supabase
      .from("lesson_categories")
      .select(`
        id,
        title,
        description,
        is_published
      `)
      .eq("id", categoryId)
      .single(),

    supabase
      .from("lessons")
      .select(`
        id,
        category_id,
        title,
        description,
        video_url,
        content,
        order_number,
        is_published,
        created_at
      `)
      .eq("category_id", categoryId)
      .order("order_number", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      }),

    supabase
      .from("tests")
      .select(`
        id,
        title,
        is_published
      `)
      .order("title", {
        ascending: true,
      }),

    supabase
      .from("lesson_tests")
      .select("lesson_id, test_id")
      .order("order_number", { ascending: true }),
  ]);

  if (
    categoryResult.error ||
    !categoryResult.data
  ) {
    notFound();
  }

  if (lessonsResult.error) {
    throw new Error(
      `Darslar yuklanmadi: ${lessonsResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(
      `Testlar yuklanmadi: ${testsResult.error.message}`,
    );
  }

  if (linksResult.error) {
    throw new Error(
      `Dars testlari yuklanmadi: ${linksResult.error.message}`,
    );
  }

  const testIdsByLesson = new Map<number, number[]>();

  for (const link of (linksResult.data ?? []) as LessonTestRow[]) {
    testIdsByLesson.set(link.lesson_id, [
      ...(testIdsByLesson.get(link.lesson_id) ?? []),
      link.test_id,
    ]);
  }

  const category =
    categoryResult.data;

  const lessons =
    (lessonsResult.data ??
      []) as LessonRow[];

  const tests =
    (testsResult.data ??
      []) as TestRow[];

  const testMap = new Map(
    tests.map((test) => [
      test.id,
      test,
    ]),
  );

  const publishedLessons =
    lessons.filter(
      (lesson) =>
        lesson.is_published,
    ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/admin/lessons"
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← Dars bo‘limlariga qaytish
            </Link>

            <h1 className="text-xl font-bold sm:text-2xl">
              {category.title}
            </h1>

            {category.description && (
              <p className="mt-1 text-sm text-slate-500">
                {category.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm text-blue-800">
              Darslar:{" "}
              <strong>
                {lessons.length}
              </strong>
            </div>

            <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
              Nashr qilingan:{" "}
              <strong>
                {publishedLessons}
              </strong>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[400px_1fr]">
        <div>
          <CreateLessonForm
            categoryId={categoryId}
            tests={tests}
            action={createLesson}
          />
        </div>

        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-bold">
              Videodarslar
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Jami: {lessons.length} ta
            </p>
          </div>

          {lessons.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <h3 className="text-lg font-bold">
                Hozircha videodars yo‘q
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Chap tomondagi forma orqali
                birinchi darsni qo‘shing.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {lessons.map((lesson) => {
                const attachedTests = (
                  testIdsByLesson.get(lesson.id) ?? []
                )
                  .map((id) => testMap.get(id))
                  .filter(
                    (test): test is TestRow => Boolean(test),
                  );

                return (
                  <article
                    key={lesson.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                          {lesson.order_number}
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold">
                              {lesson.title}
                            </h3>

                            <span
                              className={
                                lesson.is_published
                                  ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                              }
                            >
                              {lesson.is_published
                                ? "Nashr qilingan"
                                : "Yopiq"}
                            </span>
                          </div>

                          {lesson.description && (
                            <p className="mt-2 leading-7 text-slate-600">
                              {lesson.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-3">
                        <Link
                          href={`/admin/lessons/edit?categoryId=${categoryId}&lessonId=${lesson.id}`}
                          className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Tahrirlash
                        </Link>
                        <form
                          action={
                            changeLessonState
                          }
                        >
                          <input
                            type="hidden"
                            name="categoryId"
                            value={categoryId}
                          />

                          <input
                            type="hidden"
                            name="lessonId"
                            value={lesson.id}
                          />

                          <input
                            type="hidden"
                            name="nextState"
                            value={String(
                              !lesson.is_published,
                            )}
                          />

                          <SubmitButton

                            className={
                              lesson.is_published
                                ? "rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
                                : "rounded-xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
                            }
                          >
                            {lesson.is_published
                              ? "Yopish"
                              : "Nashr qilish"}
                          </SubmitButton>
                        </form>

                        <form action={deleteLesson}>
                          <input
                            type="hidden"
                            name="categoryId"
                            value={categoryId}
                          />

                          <input
                            type="hidden"
                            name="lessonId"
                            value={lesson.id}
                          />

                          <SubmitButton

                            className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                          >
                            O‘chirish
                          </SubmitButton>
                        </form>
                      </div>
                    </div>

                    {lesson.video_url && (
                      <div className="mt-5 overflow-hidden rounded-2xl">
                        <YouTubeEmbed
                          url={lesson.video_url}
                        />
                      </div>
                    )}

                    {lesson.content && (
                      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-5 leading-8 text-blue-950">
                        <p className="mb-3 text-sm font-bold">
                          Nazariy qism
                        </p>

                        <MathText
                          content={
                            lesson.content
                          }
                        />
                      </div>
                    )}

                    <div className="mt-5 border-t border-slate-100 pt-4">
                      {attachedTests.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-slate-500">
                            Testlar:
                          </span>

                          {attachedTests.map((test) => (
                            <Link
                              key={test.id}
                              href={`/admin/tests/manage?testId=${test.id}`}
                              className="font-semibold text-blue-600 hover:text-blue-700"
                            >
                              {test.title}
                              {!test.is_published && " (yopiq)"}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Test biriktirilmagan.
                        </p>
                      )}
                    </div>
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