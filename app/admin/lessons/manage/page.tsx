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
import ConfirmSubmitButton from "@/components/admin/confirm-submit-button";
import CreatePanel from "@/components/admin/create-panel";
import RowMenu, { rowMenuDanger, rowMenuItem } from "@/components/admin/row-menu";
import { getYouTubeThumbnail } from "@/lib/youtube";
import SubmitButton from "@/components/ui/submit-button";
import { parseOrderNumber } from "@/lib/lesson-order";
import { moveLessonTo } from "@/lib/lesson-order-db";

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
  is_free: boolean;
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

  /* Bo'sh qoldirilsa dars oxiriga qo'yiladi */
  const orderNumber = parseOrderNumber(
    formData.get("orderNumber"),
  );

  /* Har bir dars sukut bo'yicha Premium; bepullik faqat qo'lda */
  const isFree = formData.get("isFree") === "on";

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

  if (orderNumber === undefined) {
    errors.orderNumber =
      "Tartib raqami 1 yoki undan katta butun son bo‘lsin.";
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
      is_free: isFree,
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

  if (
    orderNumber &&
    orderNumber < nextOrderNumber
  ) {
    const moveError = await moveLessonTo(
      supabase,
      categoryId,
      createdLesson.id,
      orderNumber,
    );

    if (moveError) {
      return {
        status: "error",
        message: `Dars saqlandi, lekin tartib raqami qo‘yilmadi: ${moveError}`,
        errors: {},
      };
    }
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

/*
 * Videodarsni qo'lda bepul qilish.
 *
 * Qoida test tomonidagi `tests.is_free` bilan bir xil: avtomatik
 * hech narsa bepul bo'lmaydi, faqat shu tugma bosilgan dars ochiq
 * bo'ladi. Premium obunasi borlar baribir hamma darsni ko'radi,
 * shuning uchun bu belgi faqat obunasi yo'qlar uchun ishlaydi.
 *
 * Bepul dars KETMA-KETLIKDAN TASHQARIDA ochiladi: unga yetib
 * borish uchun oldingi darslarni 90% ga yopish shart emas.
 * Keyingi pullik dars esa eski qoida bo'yicha qoladi.
 */
async function changeLessonFreeState(
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
      is_free: nextState,
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
  revalidatePath("/lessons/category");
  revalidatePath("/lessons/view");

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
        is_free,
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

  const freeLessons =
    lessons.filter(
      (lesson) => lesson.is_free,
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

          <p className="text-sm text-slate-500">
            {lessons.length} dars · {publishedLessons} nashrda · {freeLessons}{" "}
            bepul
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
        <CreatePanel
          label="Yangi videodars"
          defaultOpen={lessons.length === 0}
        >
          <CreateLessonForm
            categoryId={categoryId}
            nextOrderNumber={lessons.length + 1}
            tests={tests}
            action={createLesson}
          />
        </CreatePanel>

        {lessons.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
            {lessons.map((lesson, index) => {
              const attachedTests = (testIdsByLesson.get(lesson.id) ?? [])
                .map((id) => testMap.get(id))
                .filter((test): test is TestRow => Boolean(test));

              const thumbnail = getYouTubeThumbnail(lesson.video_url);

              return (
                <article
                  key={lesson.id}
                  className={`flex items-start gap-3 px-3 py-3 sm:px-4 ${index > 0 ? "border-t border-mb-line" : ""}`}
                >
                  <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                    {lesson.order_number}
                  </span>

                  {thumbnail ? (
                    <a
                      href={lesson.video_url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Videoni YouTube'da ochish"
                      className="hidden shrink-0 overflow-hidden rounded-lg sm:block"
                    >
                      <img
                        src={thumbnail}
                        alt=""
                        loading="lazy"
                        className="h-[54px] w-24 object-cover"
                      />
                    </a>
                  ) : (
                    <span className="hidden h-[54px] w-24 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] text-slate-400 sm:grid">
                      video yo‘q
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/lessons/edit?categoryId=${categoryId}&lessonId=${lesson.id}`}
                      className="block truncate text-[15px] font-semibold text-mb-ink hover:text-mb-brand"
                    >
                      {lesson.title}
                    </Link>

                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mb-muted">
                      {!lesson.is_published && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                          Yopiq
                        </span>
                      )}
                      <span
                        className={
                          lesson.is_free
                            ? "rounded-full bg-teal-50 px-2 py-0.5 font-semibold text-teal-700"
                            : "rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700"
                        }
                      >
                        {lesson.is_free ? "Bepul" : "Premium"}
                      </span>
                      {lesson.content && <span>nazariy qism bor</span>}
                      {attachedTests.length > 0 ? (
                        <span>
                          test:{" "}
                          {attachedTests.map((test, testIndex) => (
                            <span key={test.id}>
                              {testIndex > 0 && ", "}
                              <Link
                                href={`/admin/tests/manage?testId=${test.id}`}
                                className="font-semibold text-mb-brand hover:text-mb-brandDark"
                              >
                                {test.title}
                              </Link>
                              {!test.is_published && " (yopiq)"}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span>test yo‘q</span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/lessons/edit?categoryId=${categoryId}&lessonId=${lesson.id}`}
                      className="hidden min-h-10 items-center rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 sm:inline-flex"
                    >
                      Tahrirlash
                    </Link>

                    <RowMenu>
                      <Link
                        href={`/admin/lessons/edit?categoryId=${categoryId}&lessonId=${lesson.id}`}
                        className={`${rowMenuItem} sm:hidden`}
                      >
                        Tahrirlash
                      </Link>

                      <form action={changeLessonState}>
                        <input type="hidden" name="categoryId" value={categoryId} />
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <input
                          type="hidden"
                          name="nextState"
                          value={String(!lesson.is_published)}
                        />
                        <SubmitButton className={rowMenuItem}>
                          {lesson.is_published ? "Yopish" : "Nashr qilish"}
                        </SubmitButton>
                      </form>

                      <form action={changeLessonFreeState}>
                        <input type="hidden" name="categoryId" value={categoryId} />
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <input
                          type="hidden"
                          name="nextState"
                          value={String(!lesson.is_free)}
                        />
                        <SubmitButton className={rowMenuItem}>
                          {lesson.is_free ? "Premium qilish" : "Bepul qilish"}
                        </SubmitButton>
                      </form>

                      <form action={deleteLesson}>
                        <input type="hidden" name="categoryId" value={categoryId} />
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <ConfirmSubmitButton
                          className={rowMenuDanger}
                          title="Videodars o‘chirilsinmi?"
                          description={`“${lesson.title}” butunlay o‘chiriladi. Bu amalni orqaga qaytarib bo‘lmaydi.`}
                        >
                          O‘chirish
                        </ConfirmSubmitButton>
                      </form>
                    </RowMenu>
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