
import ConfirmSubmitButton from "@/components/admin/confirm-submit-button";
import CreatePanel from "@/components/admin/create-panel";
import RowMenu, { rowMenuDanger } from "@/components/admin/row-menu";
import { revalidatePath } from "next/cache";
import {
  notFound,
  redirect,
} from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/current-user";
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
import BackLink from "@/components/ui/back-link";

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
        "Darslik ma’lumotlari notöğri.",
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
      "Mavzu nomi 200 ta belgidan oşmasin.";
  }

  if (video.error) {
    errors.videoUrl = video.error;
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
        "Mavzu nomini tekşirib bölmadi.",
      errors: {},
    };
  }

  if (existingTopic) {
    return {
      status: "error",
      message:
        "Bu mavzu avval qöşilgan.",
      errors: {
        title:
          "Boşqa mavzu nomini kiriting.",
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
        "Mavzular tartibini aniqlab bölmadi.",
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
        "Mavzuni qöşib bölmadi.",
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
      "Mavzu muvaffaqiyatli qöşildi.",
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
        "Mavzu ma’lumotlari notöğri.",
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
      "Mavzu nomi 200 ta belgidan oşmasin.";
  }

  if (video.error) {
    errors.videoUrl = video.error;
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
        "Mavzu nomini tekşirib bölmadi.",
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
          "Boşqa mavzu nomini kiriting.",
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
        "Mavzuni yangilab bölmadi.",
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
      message: "Mavzu ma’lumotlari notöğri.",
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
      message: "Quyidagi qatorlarni töğrilang.",
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
      message: "Misollar tartibini aniqlab bölmadi.",
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
      message: "Misollarni qöşib bölmadi.",
      errors: {},
    };
  }

  revalidatePath("/admin/textbooks/manage");
  revalidatePath("/textbooks");

  return {
    status: "success",
    message:
      rows.length === 1
        ? "Misol qöşildi."
        : `${rows.length} ta misol qöşildi.`,
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
      message: "Misol ma’lumotlari notöğri.",
      errors: {},
    };
  }

  const errors: Record<string, string> = {};

  if (label.length === 0) {
    errors.label = "Misol nomini kiriting.";
  }

  if (label.length > MAX_EXAMPLE_LABEL) {
    errors.label = `Misol nomi ${MAX_EXAMPLE_LABEL} ta belgidan oşmasin.`;
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
      message: "Misolni yangilab bölmadi.",
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
            <BackLink
              href="/admin/textbooks"
              label="Darsliklar"
              className="mb-2"
            />

            <h1 className="text-xl font-bold sm:text-2xl">
              {textbook.title}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {textbook.book_type === "school"
                ? `${textbook.grade}-sinf maktab darsligi`
                : textbook.author_name
                  ? `Maşhur darslik • ${textbook.author_name}`
                  : "Maşhur darslik"}
            </p>
          </div>

          <p className="text-sm text-slate-500">
            {!textbook.is_published && "Yopiq · "}
            {topics.length} mavzu
            {isPopular && <> · {totalExamples} misol</>}
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
        <CreatePanel label="Yangi mavzu" defaultOpen={topics.length === 0}>
          <CreateTopicForm
            textbookId={textbookId}
            showVideo={!isPopular}
            action={createTopic}
          />
        </CreatePanel>

        {topics.length > 0 && (
          <div className="mt-5 rounded-2xl border border-mb-line bg-white shadow-sm">
            {topics.map((topic, index) => {
              const hasVideo = Boolean(topic.video_url);
              const examples = examplesByTopic.get(topic.id) ?? [];

              return (
                <article
                  key={topic.id}
                  className={`px-3 py-3 sm:px-4 ${index > 0 ? "border-t border-mb-line" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                      {topic.order_number}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-mb-ink">
                        {topic.title}
                      </p>

                      <p className="mt-0.5 text-xs">
                        {isPopular ? (
                          examples.length > 0 ? (
                            <span className="text-mb-muted">
                              {examples.length} ta misol
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-700">
                              Misol hali yöq
                            </span>
                          )
                        ) : hasVideo ? (
                          <span className="text-mb-muted">video bor</span>
                        ) : (
                          <span className="font-semibold text-amber-700">
                            Video hali yöq
                          </span>
                        )}
                      </p>
                    </div>

                    <RowMenu>
                      <form action={deleteTopic}>
                        <input type="hidden" name="textbookId" value={textbookId} />
                        <input type="hidden" name="topicId" value={topic.id} />
                        <ConfirmSubmitButton
                          className={rowMenuDanger}
                          title="Mavzu öçirilsinmi?"
                          description={`“${topic.title}” butunlay öçiriladi.`}
                        >
                          Öçiriş
                        </ConfirmSubmitButton>
                      </form>
                    </RowMenu>
                  </div>

                  <div className="pl-11">
                    <details className="mt-1">
                      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand hover:text-mb-brandDark">
                        {isPopular ? "Nomini tahrirlaş" : "Nomi va videosini tahrirlaş"}
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