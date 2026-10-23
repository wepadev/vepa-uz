import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";
import { normalizeVideoUrl } from "@/lib/video-url";
import {
  MAX_EXAMPLE_LABEL,
  parseExampleLines,
} from "@/lib/topic-examples";
import CreateTopicForm from "@/components/admin/create-topic-form";
import EditTopicForm from "@/components/admin/edit-topic-form";
import TopicExamplesEditor, {
  type AdminExample,
} from "@/components/admin/topic-examples-editor";
import SubmitButton from "@/components/ui/submit-button";

type PageProps = {
  searchParams: Promise<{
    textbookId?: string;
  }>;
};

type TopicRow = {
  id: number;
  textbook_id: number;
  title: string;
  order_number: number;
  /** Mavzu videoyechimi — bitta videoda hamma misollar */
  video_url: string | null;
};

type ExampleRow = {
  id: number;
  topic_id: number;
  label: string;
  video_url: string | null;
  order_number: number;
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

async function createTopic(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const supabase = await requireAdmin();

  const textbookId = Number(
    formData.get("textbookId"),
  );

  const title = String(
    formData.get("title") ?? "",
  ).trim();

  const video = normalizeVideoUrl(
    formData.get("videoUrl") as string | null,
  );

  if (
    !Number.isInteger(textbookId) ||
    textbookId <= 0
  ) {
    return {
      status: "error",
      message:
        "Darslik ma’lumotlari noto‘g‘ri.",
      errors: {},
    };
  }

  const errors: Record<string, string> = {};

  if (title.length < 2) {
    errors.title =
      "Mavzu nomini kiriting.";
  }

  if (title.length > 200) {
    errors.title =
      "Mavzu nomi 200 ta belgidan oshmasin.";
  }

  if (video.error) {
    errors.videoUrl = video.error;
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
    data: textbook,
    error: textbookError,
  } = await supabase
    .from("textbooks")
    .select("id")
    .eq("id", textbookId)
    .maybeSingle();

  if (
    textbookError ||
    !textbook
  ) {
    return {
      status: "error",
      message:
        "Darslik topilmadi.",
      errors: {},
    };
  }

  const {
    data: existingTopic,
    error: existingError,
  } = await supabase
    .from("topics")
    .select("id")
    .eq("textbook_id", textbookId)
    .ilike("title", title)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return {
      status: "error",
      message:
        "Mavzu nomini tekshirib bo‘lmadi.",
      errors: {},
    };
  }

  if (existingTopic) {
    return {
      status: "error",
      message:
        "Bu mavzu avval qo‘shilgan.",
      errors: {
        title:
          "Boshqa mavzu nomini kiriting.",
      },
    };
  }

  const {
    data: lastTopic,
    error: orderError,
  } = await supabase
    .from("topics")
    .select("order_number")
    .eq("textbook_id", textbookId)
    .order("order_number", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    return {
      status: "error",
      message:
        "Mavzular tartibini aniqlab bo‘lmadi.",
      errors: {},
    };
  }

  const nextOrderNumber =
    (lastTopic?.order_number ?? 0) + 1;

  const { error: insertError } =
    await supabase
      .from("topics")
      .insert({
        textbook_id: textbookId,
        title,
        video_url: video.value,
        order_number:
          nextOrderNumber,
      });

  if (insertError) {
    return {
      status: "error",
      message:
        "Mavzuni qo‘shib bo‘lmadi.",
      errors: {},
    };
  }

  revalidatePath(
    "/admin/textbooks/manage",
  );

  revalidatePath("/admin/textbooks");
  revalidatePath("/textbooks");

  return {
    status: "success",
    message:
      "Mavzu muvaffaqiyatli qo‘shildi.",
    errors: {},
  };
}

async function updateTopic(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const supabase = await requireAdmin();

  const textbookId = Number(
    formData.get("textbookId"),
  );

  const topicId = Number(
    formData.get("topicId"),
  );

  const title = String(
    formData.get("title") ?? "",
  ).trim();

  const video = normalizeVideoUrl(
    formData.get("videoUrl") as string | null,
  );

  if (
    !Number.isInteger(textbookId) ||
    !Number.isInteger(topicId) ||
    textbookId <= 0 ||
    topicId <= 0
  ) {
    return {
      status: "error",
      message:
        "Mavzu ma’lumotlari noto‘g‘ri.",
      errors: {},
    };
  }

  const errors: Record<string, string> = {};

  if (title.length < 2) {
    errors.title =
      "Mavzu nomini kiriting.";
  }

  if (title.length > 200) {
    errors.title =
      "Mavzu nomi 200 ta belgidan oshmasin.";
  }

  if (video.error) {
    errors.videoUrl = video.error;
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
    data: existingTopic,
    error: existingError,
  } = await supabase
    .from("topics")
    .select("id")
    .eq("textbook_id", textbookId)
    .ilike("title", title)
    .neq("id", topicId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return {
      status: "error",
      message:
        "Mavzu nomini tekshirib bo‘lmadi.",
      errors: {},
    };
  }

  if (existingTopic) {
    return {
      status: "error",
      message:
        "Bunday nomli mavzu mavjud.",
      errors: {
        title:
          "Boshqa mavzu nomini kiriting.",
      },
    };
  }

  /*
   * TOP kitobda video maydoni formada umuman yo'q — u yerda video
   * mavzuga emas, misolga biriktiriladi. Maydon yuborilmagan bo'lsa
   * `video_url` ga tegilmaydi, aks holda mavzu nomini tahrirlash
   * maktab darsligidagi videoni ham o'chirib yuborardi.
   */
  const topicPatch = formData.has("videoUrl")
    ? { title, video_url: video.value }
    : { title };

  const { error: updateError } =
    await supabase
      .from("topics")
      .update(topicPatch)
      .eq("id", topicId)
      .eq("textbook_id", textbookId);

  if (updateError) {
    return {
      status: "error",
      message:
        "Mavzuni yangilab bo‘lmadi.",
      errors: {},
    };
  }

  revalidatePath(
    "/admin/textbooks/manage",
  );

  revalidatePath("/admin/textbooks");
  revalidatePath("/textbooks");

  return {
    status: "success",
    message:
      "Mavzu muvaffaqiyatli yangilandi.",
    errors: {},
  };
}

async function deleteTopic(
  formData: FormData,
) {
  "use server";

  const supabase = await requireAdmin();

  const textbookId = Number(
    formData.get("textbookId"),
  );

  const topicId = Number(
    formData.get("topicId"),
  );

  if (
    !Number.isInteger(textbookId) ||
    !Number.isInteger(topicId) ||
    textbookId <= 0 ||
    topicId <= 0
  ) {
    return;
  }

  const { error: deleteError } =
    await supabase
      .from("topics")
      .delete()
      .eq("id", topicId)
      .eq("textbook_id", textbookId);

  if (deleteError) {
    return;
  }

  const {
    data: remainingTopics,
    error: remainingError,
  } = await supabase
    .from("topics")
    .select("id")
    .eq("textbook_id", textbookId)
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
      (remainingTopics?.length ?? 0);
      index += 1
    ) {
      const topic =
        remainingTopics?.[index];

      if (!topic) {
        continue;
      }

      await supabase
        .from("topics")
        .update({
          order_number: index + 1,
        })
        .eq("id", topic.id)
        .eq("textbook_id", textbookId);
    }
  }

  revalidatePath(
    "/admin/textbooks/manage",
  );

  revalidatePath("/admin/textbooks");
  revalidatePath("/textbooks");
}

/* =====================================================================
 * Mavzu misollari — faqat TOP kitoblarda
 *
 * TOP kitobda bitta mavzuda o'nlab misol bo'ladi, shuning uchun
 * qo'shish bittalab emas, ro'yxat bilan: har bir qator "nomi | havola".
 * ===================================================================== */

async function addTopicExamples(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const supabase = await requireAdmin();

  const textbookId = Number(formData.get("textbookId"));
  const topicId = Number(formData.get("topicId"));

  if (
    !Number.isInteger(textbookId) ||
    !Number.isInteger(topicId) ||
    textbookId <= 0 ||
    topicId <= 0
  ) {
    return {
      status: "error",
      message: "Mavzu ma’lumotlari noto‘g‘ri.",
      errors: {},
    };
  }

  const { rows, problems } = parseExampleLines(
    formData.get("lines") as string | null,
    normalizeVideoUrl,
  );

  if (problems.length > 0) {
    return {
      status: "error",
      message: "Quyidagi qatorlarni to‘g‘rilang.",
      errors: { lines: problems.slice(0, 8).join("\n") },
    };
  }

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("id")
    .eq("id", topicId)
    .eq("textbook_id", textbookId)
    .maybeSingle();

  if (topicError || !topic) {
    return {
      status: "error",
      message: "Mavzu topilmadi.",
      errors: {},
    };
  }

  const { data: lastExample, error: orderError } = await supabase
    .from("topic_examples")
    .select("order_number")
    .eq("topic_id", topicId)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    return {
      status: "error",
      message: "Misollar tartibini aniqlab bo‘lmadi.",
      errors: {},
    };
  }

  const start = (lastExample?.order_number ?? 0) + 1;

  const { error: insertError } = await supabase
    .from("topic_examples")
    .insert(
      rows.map((row, index) => ({
        topic_id: topicId,
        label: row.label,
        video_url: row.videoUrl,
        order_number: start + index,
      })),
    );

  if (insertError) {
    return {
      status: "error",
      message: "Misollarni qo‘shib bo‘lmadi.",
      errors: {},
    };
  }

  revalidatePath("/admin/textbooks/manage");
  revalidatePath("/textbooks");

  return {
    status: "success",
    message:
      rows.length === 1
        ? "Misol qo‘shildi."
        : `${rows.length} ta misol qo‘shildi.`,
    errors: {},
  };
}

async function updateTopicExample(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const supabase = await requireAdmin();

  const topicId = Number(formData.get("topicId"));
  const exampleId = Number(formData.get("exampleId"));

  const label = String(formData.get("label") ?? "").trim();
  const video = normalizeVideoUrl(
    formData.get("videoUrl") as string | null,
  );

  if (
    !Number.isInteger(topicId) ||
    !Number.isInteger(exampleId) ||
    topicId <= 0 ||
    exampleId <= 0
  ) {
    return {
      status: "error",
      message: "Misol ma’lumotlari noto‘g‘ri.",
      errors: {},
    };
  }

  const errors: Record<string, string> = {};

  if (label.length === 0) {
    errors.label = "Misol nomini kiriting.";
  }

  if (label.length > MAX_EXAMPLE_LABEL) {
    errors.label = `Misol nomi ${MAX_EXAMPLE_LABEL} ta belgidan oshmasin.`;
  }

  if (video.error) {
    errors.videoUrl = video.error;
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: errors.label ?? errors.videoUrl ?? "",
      errors,
    };
  }

  const { error: updateError } = await supabase
    .from("topic_examples")
    .update({
      label,
      video_url: video.value,
    })
    .eq("id", exampleId)
    .eq("topic_id", topicId);

  if (updateError) {
    return {
      status: "error",
      message: "Misolni yangilab bo‘lmadi.",
      errors: {},
    };
  }

  revalidatePath("/admin/textbooks/manage");
  revalidatePath("/textbooks");

  return {
    status: "success",
    message: "Misol yangilandi.",
    errors: {},
  };
}

async function deleteTopicExample(formData: FormData) {
  "use server";

  const supabase = await requireAdmin();

  const topicId = Number(formData.get("topicId"));
  const exampleId = Number(formData.get("exampleId"));

  if (
    !Number.isInteger(topicId) ||
    !Number.isInteger(exampleId) ||
    topicId <= 0 ||
    exampleId <= 0
  ) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("topic_examples")
    .delete()
    .eq("id", exampleId)
    .eq("topic_id", topicId);

  if (deleteError) {
    return;
  }

  /* Raqamlar orasida bo'shliq qolmasin */
  await supabase.rpc("renumber_topic_examples", {
    p_topic_id: topicId,
  });

  revalidatePath("/admin/textbooks/manage");
  revalidatePath("/textbooks");
}

export default async function ManageTextbookPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const textbookId = Number(
    params.textbookId,
  );

  if (
    !Number.isInteger(textbookId) ||
    textbookId <= 0
  ) {
    notFound();
  }

  const supabase = await requireAdmin();

  const [
    textbookResult,
    topicsResult,
  ] = await Promise.all([
    supabase
      .from("textbooks")
      .select(`
        id,
        title,
        grade,
        author_name,
        book_type,
        is_published
      `)
      .eq("id", textbookId)
      .maybeSingle(),

    supabase
      .from("topics")
      .select(`
        id,
        textbook_id,
        title,
        order_number,
        video_url
      `)
      .eq("textbook_id", textbookId)
      .order("order_number", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      }),

  ]);

  if (
    textbookResult.error ||
    !textbookResult.data
  ) {
    notFound();
  }

  if (topicsResult.error) {
    throw new Error(
      `Mavzular yuklanmadi: ${topicsResult.error.message}`,
    );
  }

  const textbook =
    textbookResult.data;

  const topics =
    (topicsResult.data ??
      []) as TopicRow[];

  /*
   * Misollar faqat TOP kitoblarda. Maktab darsligida mavzuga bitta
   * video biriktiriladi — o'sha tartib o'zgarmadi.
   */
  const isPopular = textbook.book_type === "popular";

  const examplesByTopic = new Map<number, AdminExample[]>();

  if (isPopular && topics.length > 0) {
    const { data: exampleRows, error: examplesError } = await supabase
      .from("topic_examples")
      .select(`
        id,
        topic_id,
        label,
        video_url,
        order_number
      `)
      .in(
        "topic_id",
        topics.map((topic) => topic.id),
      )
      .order("order_number", { ascending: true })
      .order("id", { ascending: true });

    /*
     * Jadval hali yo'q bo'lsa (db/33 ishga tushirilmagan) sahifa
     * ishlashda davom etsin — misollar bo'limi bo'sh chiqadi.
     */
    if (!examplesError) {
      for (const row of (exampleRows ?? []) as ExampleRow[]) {
        const list = examplesByTopic.get(row.topic_id) ?? [];

        list.push({
          id: row.id,
          label: row.label,
          videoUrl: row.video_url,
          orderNumber: row.order_number,
        });

        examplesByTopic.set(row.topic_id, list);
      }
    }
  }

  const totalExamples = [...examplesByTopic.values()].reduce(
    (sum, list) => sum + list.length,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/admin/textbooks"
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← Darsliklarga qaytish
            </Link>

            <h1 className="text-xl font-bold sm:text-2xl">
              {textbook.title}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {textbook.book_type === "school"
                ? `${textbook.grade}-sinf maktab darsligi`
                : textbook.author_name
                  ? `Mashhur darslik • ${textbook.author_name}`
                  : "Mashhur darslik"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <span
              className={
                textbook.is_published
                  ? "rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                  : "rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"
              }
            >
              {textbook.is_published
                ? "Nashr qilingan"
                : "Yopiq"}
            </span>

            <span className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              Mavzular: {topics.length}
            </span>

            {isPopular && (
              <span className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Misollar: {totalExamples}
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[380px_1fr]">
        <div>
          <CreateTopicForm
            textbookId={textbookId}
            showVideo={!isPopular}
            action={createTopic}
          />
        </div>

        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-bold">
              Darslik mavzulari
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Jami: {topics.length} ta mavzu
            </p>
          </div>

          {topics.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <h3 className="text-lg font-bold">
                Hozircha mavzu yo‘q
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Chap tomondagi forma orqali
                birinchi mavzuni qo‘shing.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topics.map((topic) => {
                const hasVideo = Boolean(topic.video_url);
                const examples =
                  examplesByTopic.get(topic.id) ?? [];

                return (
                  <article
                    key={topic.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                      <div className="flex min-w-0 items-start gap-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700">
                          {topic.order_number}
                        </span>

                        <div className="min-w-0">
                          <h3 className="text-xl font-bold">
                            {topic.title}
                          </h3>

                          <p className="mt-2 flex flex-wrap gap-2 text-sm">
                            {isPopular ? (
                              examples.length > 0 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                  {examples.length} ta misol
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                                  Misol hali qo‘shilmagan
                                </span>
                              )
                            ) : hasVideo ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                Videoyechim qo‘shilgan
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                                Video hali yo‘q
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-3">
                        <form action={deleteTopic}>
                            <input
                              type="hidden"
                              name="textbookId"
                              value={textbookId}
                            />

                            <input
                              type="hidden"
                              name="topicId"
                              value={topic.id}
                            />

                            <SubmitButton
                              className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
                            >
                            O‘chirish
                          </SubmitButton>
                        </form>
                      </div>
                    </div>

                    <details className="mt-5 border-t border-slate-100 pt-4">
                      <summary className="cursor-pointer text-sm font-semibold text-mb-brand hover:text-mb-brandDark">
                        {isPopular
                          ? "Mavzu nomini tahrirlash"
                          : "Mavzu nomi va videosini tahrirlash"}
                      </summary>

                      <EditTopicForm
                        key={`${topic.id}-${topic.title}-${topic.video_url ?? ""}`}
                        textbookId={textbookId}
                        topicId={topic.id}
                        title={topic.title}
                        videoUrl={topic.video_url}
                        showVideo={!isPopular}
                        action={updateTopic}
                      />
                    </details>

                    {isPopular && (
                      <TopicExamplesEditor
                        textbookId={textbookId}
                        topicId={topic.id}
                        examples={examples}
                        addAction={addTopicExamples}
                        updateAction={updateTopicExample}
                        deleteAction={deleteTopicExample}
                      />
                    )}
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