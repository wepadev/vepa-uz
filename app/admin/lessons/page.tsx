import Link from "next/link";

import CreatePanel from "@/components/admin/create-panel";
import RowMenu, { rowMenuItem } from "@/components/admin/row-menu";

import AdminTabs from "@/components/admin/admin-tabs";
import {
  revalidatePath,
} from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";
import CreateLessonCategoryForm from "@/components/admin/create-lesson-category-form";
import SubmitButton from "@/components/ui/submit-button";
import PageHeader from "@/components/ui/page-header";

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

  const user = await getCurrentUser();

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
      "Bölim nomini kiriting.";
  }

  if (title.length > 100) {
    errors.title =
      "Bölim nomi 100 ta belgidan oşmasin.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message:
        "Qizil bilan körsatilgan joylarni töğrilang.",
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
        "Bölim nomini tekşirib bölmadi. Qayta urinib köring.",
      errors: {},
    };
  }

  if (existingCategory) {
    return {
      status: "error",
      message:
        "Bunday nomli dars bölimi avval yaratilgan.",
      errors: {
        title:
          "Boşqa bölim nomini kiriting.",
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
        "Bölimlar tartibini aniqlab bölmadi.",
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
        "Dars bölimini yaratib bölmadi. Qayta urinib köring.",
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
      "Dars bölimi ma’lumotlari notöğri.",
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
      "Bölim holatini özgartirib bölmadi.",
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
      `Dars bölimlari yuklanmadi: ${categoriesResult.error.message}`,
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
      <PageHeader
        sticky={false}
        backHref="/admin"
        backLabel="Admin panel"
        title="Darslar"
        width="7xl"
        chips={[`Bölimlar: ${categories.length}`, `Naşr qilingan: ${publishedCount}`]}
      >
        <AdminTabs
          active="/admin/lessons"
          tabs={[
            { href: "/admin/lessons", label: "Videodarslar" },
            { href: "/admin/textbooks", label: "Darslik yeçimlari" },
          ]}
        />
      </PageHeader>

      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
        <CreatePanel
          label="Yangi dars bölimi"
          defaultOpen={categories.length === 0}
        >
          <CreateLessonCategoryForm action={createCategory} />
        </CreatePanel>

        {categories.length > 0 && (
          <div className="mt-5 rounded-2xl border border-mb-line bg-white">
            {categories.map((category, index) => {
              const lessonCount = lessonCountMap.get(category.id) ?? 0;
              const freeCount = freeCountMap.get(category.id) ?? 0;

              return (
                <article
                  key={category.id}
                  className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${index > 0 ? "border-t border-mb-line" : ""}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                    {category.order_number}
                  </span>

                  <Link
                    href={`/admin/lessons/manage?categoryId=${category.id}`}
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate text-[15px] font-semibold text-mb-ink hover:text-mb-brand">
                      {category.title}
                    </span>

                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-mb-muted">
                      {!category.is_published && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                          Yopiq
                        </span>
                      )}
                      {lessonCount} dars
                      {freeCount > 0 && <> · {freeCount} bepul</>}
                    </span>
                  </Link>

                  <RowMenu>
                    <form action={changeCategoryState}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input
                        type="hidden"
                        name="nextState"
                        value={String(!category.is_published)}
                      />
                      <SubmitButton className={rowMenuItem}>
                        {category.is_published ? "Bölimni yopiş" : "Naşr qiliş"}
                      </SubmitButton>
                    </form>
                  </RowMenu>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}