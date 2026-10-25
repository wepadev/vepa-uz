import Link from "next/link";
import {
  revalidatePath,
} from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";
import CreateLessonCategoryForm from "@/components/admin/create-lesson-category-form";
import SubmitButton from "@/components/ui/submit-button";

type CategoryRow = {
  id: number;
  title: string;
  description: string | null;
  order_number: number;
  is_published: boolean;
  created_at: string;
};

type LessonRow = {
  category_id: number;
  is_free: boolean;
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

async function createCategory(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const supabase = await requireAdmin();

  const title = String(
    formData.get("title") ?? "",
  ).trim();

  const description = String(
    formData.get("description") ?? "",
  ).trim();

  const errors: Record<string, string> = {};

  if (title.length < 2) {
    errors.title =
      "Bo‘lim nomini kiriting.";
  }

  if (title.length > 100) {
    errors.title =
      "Bo‘lim nomi 100 ta belgidan oshmasin.";
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
    data: existingCategory,
    error: existingError,
  } = await supabase
    .from("lesson_categories")
    .select("id")
    .ilike("title", title)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return {
      status: "error",
      message:
        "Bo‘lim nomini tekshirib bo‘lmadi. Qayta urinib ko‘ring.",
      errors: {},
    };
  }

  if (existingCategory) {
    return {
      status: "error",
      message:
        "Bunday nomli dars bo‘limi avval yaratilgan.",
      errors: {
        title:
          "Boshqa bo‘lim nomini kiriting.",
      },
    };
  }

  const {
    data: lastCategory,
    error: orderError,
  } = await supabase
    .from("lesson_categories")
    .select("order_number")
    .order("order_number", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    return {
      status: "error",
      message:
        "Bo‘limlar tartibini aniqlab bo‘lmadi.",
      errors: {},
    };
  }

  const nextOrderNumber =
    (lastCategory?.order_number ?? 0) + 1;

  const { error: insertError } =
    await supabase
      .from("lesson_categories")
      .insert({
        title,
        description:
          description || null,
        order_number:
          nextOrderNumber,
        is_published: false,
      });

  if (insertError) {
    return {
      status: "error",
      message:
        "Dars bo‘limini yaratib bo‘lmadi. Qayta urinib ko‘ring.",
      errors: {},
    };
  }

  revalidatePath("/admin/lessons");
  revalidatePath("/lessons");

  redirect("/admin/lessons");
}

async function changeCategoryState(
  formData: FormData,
) {
  "use server";

  const supabase = await requireAdmin();

  const categoryId = Number(
    formData.get("categoryId"),
  );

  const nextState =
    formData.get("nextState") === "true";

  if (
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    throw new Error(
      "Dars bo‘limi ma’lumotlari noto‘g‘ri.",
    );
  }

  const { error } = await supabase
    .from("lesson_categories")
    .update({
      is_published: nextState,
    })
    .eq("id", categoryId);

  if (error) {
    throw new Error(
      "Bo‘lim holatini o‘zgartirib bo‘lmadi.",
    );
  }

  revalidatePath("/admin/lessons");
  revalidatePath("/lessons");

  redirect("/admin/lessons");
}

export default async function AdminLessonsPage() {
  const supabase = await requireAdmin();

  const [
    categoriesResult,
    lessonsResult,
  ] = await Promise.all([
    supabase
      .from("lesson_categories")
      .select(`
        id,
        title,
        description,
        order_number,
        is_published,
        created_at
      `)
      .order("order_number", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      }),

    supabase
      .from("lessons")
      .select("category_id, is_free"),
  ]);

  if (categoriesResult.error) {
    throw new Error(
      `Dars bo‘limlari yuklanmadi: ${categoriesResult.error.message}`,
    );
  }

  if (lessonsResult.error) {
    throw new Error(
      `Darslar soni yuklanmadi: ${lessonsResult.error.message}`,
    );
  }

  const categories =
    (categoriesResult.data ??
      []) as CategoryRow[];

  const lessons =
    (lessonsResult.data ??
      []) as LessonRow[];

  const lessonCountMap =
    new Map<number, number>();

  /* Qo'lda bepul qilingan darslar soni */
  const freeCountMap =
    new Map<number, number>();

  for (const lesson of lessons) {
    const currentCount =
      lessonCountMap.get(
        lesson.category_id,
      ) ?? 0;

    lessonCountMap.set(
      lesson.category_id,
      currentCount + 1,
    );

    if (lesson.is_free) {
      freeCountMap.set(
        lesson.category_id,
        (freeCountMap.get(
          lesson.category_id,
        ) ?? 0) + 1,
      );
    }
  }

  const publishedCount =
    categories.filter(
      (category) =>
        category.is_published,
    ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/admin"
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← Admin panelga qaytish
            </Link>

            <h1 className="text-xl font-bold sm:text-2xl">
              Darslarni boshqarish
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Dars bo‘limlari va
              videodarslarni boshqarish
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm text-blue-800">
              Bo‘limlar:{" "}
              <strong>
                {categories.length}
              </strong>
            </div>

            <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
              Nashr qilingan:{" "}
              <strong>
                {publishedCount}
              </strong>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[380px_1fr]">
        <div>
          <CreateLessonCategoryForm
            action={createCategory}
          />
        </div>

        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-bold">
              Dars bo‘limlari
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Jami: {categories.length} ta
              bo‘lim
            </p>
          </div>

          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <h3 className="text-lg font-bold">
                Hozircha dars bo‘limi yo‘q
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Chap tomondagi forma orqali
                birinchi bo‘limni yarating.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map(
                (category) => {
                  const lessonCount =
                    lessonCountMap.get(
                      category.id,
                    ) ?? 0;

                  const freeCount =
                    freeCountMap.get(
                      category.id,
                    ) ?? 0;

                  return (
                    <article
                      key={category.id}
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                              {
                                category.order_number
                              }
                            </span>

                            <h3 className="text-xl font-bold">
                              {category.title}
                            </h3>

                            <span
                              className={
                                category.is_published
                                  ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                              }
                            >
                              {category.is_published
                                ? "Nashr qilingan"
                                : "Yopiq"}
                            </span>
                          </div>

                          {category.description && (
                            <p className="mt-3 leading-7 text-slate-600">
                              {
                                category.description
                              }
                            </p>
                          )}

                          <p className="mt-3 text-sm font-medium text-slate-500">
                            Darslar:{" "}
                            <strong className="text-slate-800">
                              {lessonCount} ta
                            </strong>

                            <span className="mx-2 text-slate-300">
                              |
                            </span>

                            Bepul:{" "}
                            <strong
                              className={
                                freeCount > 0
                                  ? "text-teal-700"
                                  : "text-slate-800"
                              }
                            >
                              {freeCount} ta
                            </strong>
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-3">
                          <Link
                            href={`/admin/lessons/manage?categoryId=${category.id}`}
                            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                          >
                            Darslarni boshqarish
                          </Link>

                          <form
                            action={
                              changeCategoryState
                            }
                          >
                            <input
                              type="hidden"
                              name="categoryId"
                              value={
                                category.id
                              }
                            />

                            <input
                              type="hidden"
                              name="nextState"
                              value={String(
                                !category.is_published,
                              )}
                            />

                            <SubmitButton

                              className={
                                category.is_published
                                  ? "rounded-xl bg-amber-100 px-5 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-200"
                                  : "rounded-xl bg-emerald-100 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-200"
                              }
                            >
                              {category.is_published
                                ? "Bo‘limni yopish"
                                : "Nashr qilish"}
                            </SubmitButton>
                          </form>
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}