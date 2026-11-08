import { revalidatePath } from "next/cache";
import {
  notFound,
  redirect,
} from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";
import EditLessonForm from "@/components/admin/edit-lesson-form";
import { parseOrderNumber } from "@/lib/lesson-order";
import { moveLessonTo } from "@/lib/lesson-order-db";
import { loadLessonTestOptions } from "@/lib/lesson-test-options";
import BackLink from "@/components/ui/back-link";

type PageProps = {
  searchParams: Promise<{
    categoryId?: string;
    lessonId?: string;
  }>;
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

function isValidUrl(value: string) {
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

async function updateLesson(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const supabase = await requireAdmin();

  const categoryId = Number(
    formData.get("categoryId"),
  );

  const lessonId = Number(
    formData.get("lessonId"),
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

  const orderNumber = parseOrderNumber(
    formData.get("orderNumber"),
  );

  const isFree = formData.get("isFree") === "on";

  const testIds = formData
    .getAll("testIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (
    !Number.isInteger(categoryId) ||
    !Number.isInteger(lessonId) ||
    categoryId <= 0 ||
    lessonId <= 0
  ) {
    return {
      status: "error",
      message:
        "Videodars ma’lumotlari notöğri.",
      errors: {},
    };
  }

  const errors: Record<string, string> = {};

  if (title.length < 2) {
    errors.title =
      "Dars nomini kiriting.";
  }

  if (title.length > 150) {
    errors.title =
      "Dars nomi 150 ta belgidan oşmasin.";
  }

  if (!videoUrl) {
    errors.videoUrl =
      "YouTube video havolasini kiriting.";
  } else if (!isValidUrl(videoUrl)) {
    errors.videoUrl =
      "Video havolasini töliq kiriting.";
  }

  if (orderNumber === undefined) {
    errors.orderNumber =
      "Tartib raqami 1 yoki undan katta butun son bölsin.";
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
    data: existingLesson,
    error: existingLessonError,
  } = await supabase
    .from("lessons")
    .select("id, order_number")
    .eq("id", lessonId)
    .eq("category_id", categoryId)
    .maybeSingle();

  if (
    existingLessonError ||
    !existingLesson
  ) {
    return {
      status: "error",
      message:
        "Tahrirlanadigan videodars topilmadi.",
      errors: {},
    };
  }

  if (testIds.length > 0) {
    const {
      data: selectedTests,
      error: selectedTestError,
    } = await supabase
      .from("tests")
      .select("id")
      .in("id", testIds);

    if (
      selectedTestError ||
      (selectedTests ?? []).length !== testIds.length
    ) {
      return {
        status: "error",
        message:
          "Tanlangan testlardan biri topilmadi.",
        errors: {
          testIds: "Röyxatni qayta tekşiring.",
        },
      };
    }
  }

  const { error: updateError } =
    await supabase
      .from("lessons")
      .update({
        title,
        description:
          description || null,
        video_url: videoUrl,
        content: content || null,
        is_free: isFree,
      })
      .eq("id", lessonId)
      .eq("category_id", categoryId);

  if (updateError) {
    return {
      status: "error",
      message:
        "Videodarsni yangilab bölmadi.",
      errors: {},
    };
  }

  if (
    orderNumber &&
    orderNumber !== existingLesson.order_number
  ) {
    const moveError = await moveLessonTo(
      supabase,
      categoryId,
      lessonId,
      orderNumber,
    );

    if (moveError) {
      return {
        status: "error",
        message: `Tartib raqami özgarmadi: ${moveError}`,
        errors: {},
      };
    }
  }

  /*
   * Test bog'lamlari qaytadan yoziladi: avval eskisi o'chadi,
   * so'ng belgilanganlari qo'shiladi. Natijalar testning o'ziga
   * bog'langani uchun bu yerda hech narsa yo'qolmaydi.
   */
  const { error: clearError } = await supabase
    .from("lesson_tests")
    .delete()
    .eq("lesson_id", lessonId);

  if (clearError) {
    return {
      status: "error",
      message: `Eski testlar uzilmadi: ${clearError.message}`,
      errors: {},
    };
  }

  if (testIds.length > 0) {
    const { error: linkError } = await supabase
      .from("lesson_tests")
      .insert(
        testIds.map((id, index) => ({
          lesson_id: lessonId,
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
  revalidatePath("/lessons/category");

  redirect(
    `/admin/lessons/manage?categoryId=${categoryId}`,
  );
}

export default async function EditLessonPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const categoryId = Number(
    params.categoryId,
  );

  const lessonId = Number(
    params.lessonId,
  );

  if (
    !Number.isInteger(categoryId) ||
    !Number.isInteger(lessonId) ||
    categoryId <= 0 ||
    lessonId <= 0
  ) {
    notFound();
  }

  const supabase = await requireAdmin();

  const [
    categoryResult,
    lessonResult,
    testsResult,
    linksResult,
  ] = await Promise.all([
    supabase
      .from("lesson_categories")
      .select("id, title")
      .eq("id", categoryId)
      .maybeSingle(),

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
        is_free
      `)
      .eq("id", lessonId)
      .eq("category_id", categoryId)
      .maybeSingle(),

    loadLessonTestOptions(supabase),

    supabase
      .from("lesson_tests")
      .select("test_id")
      .eq("lesson_id", lessonId)
      .order("order_number", { ascending: true }),
  ]);

  if (
    categoryResult.error ||
    !categoryResult.data ||
    lessonResult.error ||
    !lessonResult.data
  ) {
    notFound();
  }

  const category =
    categoryResult.data;

  const lesson =
    lessonResult.data;

  const tests = testsResult;

  if (linksResult.error) {
    throw new Error(
      `Dars testlari yuklanmadi: ${linksResult.error.message}`,
    );
  }

  const attachedTestIds = (
    (linksResult.data ?? []) as Array<{ test_id: number }>
  ).map((row) => row.test_id);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">
          <BackLink
            href={`/admin/lessons/manage?categoryId=${categoryId}`}
            label="Videodarslar"
            className="mb-2"
          />

          <h1 className="text-xl font-bold sm:text-2xl">
            {lesson.order_number}-darsni
            tahrirlaş
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Bölim: {category.title}
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <EditLessonForm
          categoryId={categoryId}
          lessonId={lessonId}
          title={lesson.title}
          description={
            lesson.description ?? ""
          }
          videoUrl={
            lesson.video_url ?? ""
          }
          content={
            lesson.content ?? ""
          }
          orderNumber={lesson.order_number}
          isFree={lesson.is_free === true}
          testIds={attachedTestIds}
          tests={tests}
          action={updateLesson}
        />
      </section>
    </main>
  );
}