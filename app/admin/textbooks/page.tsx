import Link from "next/link";

import ConfirmSubmitButton from "@/components/admin/confirm-submit-button";
import CreatePanel from "@/components/admin/create-panel";
import RowMenu, { rowMenuDanger, rowMenuItem } from "@/components/admin/row-menu";

import AdminTabs from "@/components/admin/admin-tabs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import AppAlert from "@/components/ui/app-alert";
import CreateTextbookForm from "@/components/admin/create-textbook-form";
import {
  MAX_GRADE,
  MIN_GRADE,
  isValidGrade,
} from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/ui/submit-button";

type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  errors: Record<string, string>;
};

type TextbookRow = {
  id: number;
  title: string;
  grade: number | null;
  cover_url: string | null;
  author_name: string | null;
  book_type: "school" | "popular";
  is_published: boolean;
  created_at: string;
};

type TopicRow = {
  textbook_id: number;
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

const COVER_BUCKET = "textbook-covers";
const MAX_COVER_BYTES = 2.5 * 1024 * 1024;

const ALLOWED_COVER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

type SupabaseServerClient = Awaited<
  ReturnType<typeof createClient>
>;

function coverExtension(image: File) {
  if (image.type === "image/png") return "png";
  if (image.type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Muqova rasmini Storage'ga yuklaydi va ochiq havolasini qaytaradi.
 *
 * Bucket ochiq bo'lgani uchun imzo kerak emas — havola bevosita
 * `cover_url` ga yoziladi va o'quvchi sahifasida shundayligicha
 * ishlatiladi.
 */
async function uploadCover(
  supabase: SupabaseServerClient,
  image: File | null,
) {
  if (!image || image.size === 0) {
    return null;
  }

  if (!ALLOWED_COVER_TYPES.has(image.type)) {
    throw new Error("Faqat PNG, JPG yoki WEBP rasm yuklang.");
  }

  if (image.size > MAX_COVER_BYTES) {
    throw new Error("Rasm hajmi 2.5 MB dan oşmasin.");
  }

  const path = `${crypto.randomUUID()}.${coverExtension(image)}`;

  const { error } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(path, image, {
      contentType: image.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    const missingBucket =
      error.message.toLowerCase().includes("bucket");

    throw new Error(
      missingBucket
        ? "Rasm ombori topilmadi. Supabase’da db/31-muqova-rasmlari.sql faylini işga tuşiring."
        : `Rasm yuklanmadi: ${error.message}`,
    );
  }

  const { data } = supabase.storage
    .from(COVER_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

/** Eski muqova faylini o'chiradi — Storage bekorga to'lmasin */
async function removeCover(
  supabase: SupabaseServerClient,
  url: string | null,
) {
  if (!url || !url.includes(`/${COVER_BUCKET}/`)) {
    return;
  }

  const path = url.split(`/${COVER_BUCKET}/`)[1];

  if (!path) {
    return;
  }

  await supabase.storage
    .from(COVER_BUCKET)
    .remove([decodeURIComponent(path)]);
}

function isValidUrl(value: string) {
  if (!value) {
    return true;
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

async function createTextbook(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  "use server";

  const supabase = await requireAdmin();

  const title = String(
    formData.get("title") ?? "",
  ).trim();

  const bookType = String(
    formData.get("bookType") ?? "",
  ).trim();

  const gradeValue = String(
    formData.get("grade") ?? "",
  ).trim();

  const authorName = String(
    formData.get("authorName") ?? "",
  ).trim();

  const coverUrl = String(
    formData.get("coverUrl") ?? "",
  ).trim();

  const coverImage = formData.get("coverImage");

  const coverFile =
    coverImage instanceof File && coverImage.size > 0
      ? coverImage
      : null;

  const grade =
    bookType === "school" &&
    gradeValue
      ? Number(gradeValue)
      : null;

  const errors: Record<string, string> = {};

  if (
    bookType !== "school" &&
    bookType !== "popular"
  ) {
    errors.bookType =
      "Darslik turini tanlang.";
  }

  if (title.length < 2) {
    errors.title =
      "Darslik nomini kiriting.";
  }

  if (title.length > 150) {
    errors.title =
      "Darslik nomi 150 ta belgidan oşmasin.";
  }

  if (
    bookType === "school" &&
    !isValidGrade(grade)
  ) {
    errors.grade = `Maktab darsligi uçun sinfni tanlang (${MIN_GRADE}–${MAX_GRADE}).`;
  }

  if (authorName.length > 150) {
    errors.authorName =
      "Muallif nomi 150 ta belgidan oşmasin.";
  }

  if (
    coverUrl &&
    !isValidUrl(coverUrl)
  ) {
    errors.coverUrl =
      "Rasm havolasini töliq kiriting.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message:
        "Qizil bilan körsatilgan joylarni töğrilang.",
      errors,
    };
  }

  let duplicateQuery = supabase
    .from("textbooks")
    .select("id")
    .eq("book_type", bookType)
    .ilike("title", title);

  if (bookType === "school") {
    duplicateQuery =
      duplicateQuery.eq("grade", grade);
  }

  const {
    data: existingTextbook,
    error: existingError,
  } = await duplicateQuery
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return {
      status: "error",
      message:
        "Darslik ma’lumotlarini tekşirib bölmadi.",
      errors: {},
    };
  }

  if (existingTextbook) {
    return {
      status: "error",
      message:
        "Bu darslik avval yaratilgan.",
      errors: {
        title:
          "Boşqa darslik nomini kiriting.",
      },
    };
  }

  /* Fayl yuklangan bo'lsa u ustun turadi, bo'lmasa havola */
  let uploadedCover: string | null = null;

  try {
    uploadedCover = await uploadCover(supabase, coverFile);
  } catch (error) {
    return {
      status: "error",
      message: "Muqova yuklanmadi.",
      errors: {
        coverImage:
          error instanceof Error
            ? error.message
            : "Rasmni yuklab bölmadi.",
      },
    };
  }

  const { error: insertError } =
    await supabase
      .from("textbooks")
      .insert({
        title,
        book_type: bookType,
        grade,
        author_name:
          authorName || null,
        cover_url:
          uploadedCover || coverUrl || null,
        is_published: false,
      });

  if (insertError) {
    /* Yozuv saqlanmagan bo'lsa rasm ham osilib qolmasin */
    await removeCover(supabase, uploadedCover);

    return {
      status: "error",
      message:
        `Darslikni yaratib bölmadi: ${insertError.message}`,
      errors: {},
    };
  }

  revalidatePath("/admin/textbooks");
  revalidatePath("/textbooks");
  revalidatePath("/textbooks/school");
  revalidatePath("/textbooks/popular");

  return {
    status: "success",
    message:
      "Darslik muvaffaqiyatli yaratildi.",
    errors: {},
  };
}

async function changePublishedState(
  formData: FormData,
) {
  "use server";

  const supabase = await requireAdmin();

  const textbookId = Number(
    formData.get("textbookId"),
  );

  const nextState =
    formData.get("nextState") === "true";

  if (
    !Number.isInteger(textbookId) ||
    textbookId <= 0
  ) {
    return;
  }

  const { error } = await supabase
    .from("textbooks")
    .update({
      is_published: nextState,
    })
    .eq("id", textbookId);

  if (error) {
    throw new Error(
      "Darslik holatini özgartirib bölmadi.",
    );
  }

  revalidatePath("/admin/textbooks");
  revalidatePath("/textbooks");
  revalidatePath("/textbooks/school");
  revalidatePath("/textbooks/popular");
}

/**
 * Mavjud darslikning muqovasini almashtirish yoki olib tashlash.
 *
 * Darslikni tahrirlash sahifasi yo'q, shuning uchun bu amal
 * darslik kartasining ichida turadi — eng ko'p kerak bo'ladigan
 * o'zgarish aynan muqova.
 */
async function updateCover(formData: FormData) {
  "use server";

  const supabase = await requireAdmin();

  /*
   * Xatolarni "throw" qilmaymiz — u umumiy xato ekraniga olib
   * boradi va sabab ko'rinmaydi. O'rniga sahifaning o'ziga
   * tushunarli xabar bilan qaytamiz.
   */
  const fail = (message: string) => {
    redirect(
      `/admin/textbooks?xato=${encodeURIComponent(message)}`,
    );
  };

  const textbookId = Number(formData.get("textbookId"));

  if (!Number.isInteger(textbookId) || textbookId <= 0) {
    fail("Darslik topilmadi.");
  }

  const { data: textbook, error: readError } = await supabase
    .from("textbooks")
    .select("cover_url")
    .eq("id", textbookId)
    .maybeSingle();

  if (readError || !textbook) {
    fail("Darslik topilmadi.");
  }

  const previous = (textbook as { cover_url: string | null } | null)
    ?.cover_url ?? null;

  const remove = formData.get("remove") === "1";

  const image = formData.get("coverImage");

  const file =
    image instanceof File && image.size > 0 ? image : null;

  if (!remove && !file) {
    fail("Rasm tanlanmadi. Faylni belgilab, keyin saqlang.");
  }

  let uploaded: string | null = null;

  if (!remove) {
    try {
      uploaded = await uploadCover(supabase, file);
    } catch (error) {
      fail(
        error instanceof Error
          ? error.message
          : "Rasm yuklanmadi.",
      );
    }
  }

  const { error } = await supabase
    .from("textbooks")
    .update({ cover_url: uploaded })
    .eq("id", textbookId);

  if (error) {
    await removeCover(supabase, uploaded);

    fail(`Muqova saqlanmadi: ${error.message}`);
  }

  /* Yangisi o'rnatilgach eskisini o'chiramiz */
  await removeCover(supabase, previous);

  revalidatePath("/admin/textbooks");
  revalidatePath("/textbooks");
  revalidatePath("/textbooks/school");
  revalidatePath("/textbooks/popular");

  redirect("/admin/textbooks?xabar=Muqova+saqlandi");
}

/**
 * Darslik nomi, muallifi va sinfini o'zgartirish.
 *
 * Ilgari darslikni faqat yaratish va o'chirish mumkin edi: nomida
 * xato bo'lsa uni o'chirib, qaytadan yaratishga to'g'ri kelardi —
 * mavzular bilan birga.
 */
async function updateTextbook(formData: FormData) {
  "use server";

  const supabase = await requireAdmin();

  const fail = (message: string) => {
    redirect(`/admin/textbooks?xato=${encodeURIComponent(message)}`);
  };

  const textbookId = Number(formData.get("textbookId"));
  const title = String(formData.get("title") ?? "").trim();
  const authorName = String(formData.get("authorName") ?? "").trim();
  const gradeValue = String(formData.get("grade") ?? "").trim();

  if (!Number.isInteger(textbookId) || textbookId <= 0) {
    fail("Darslik topilmadi.");
  }

  if (title.length < 2 || title.length > 150) {
    fail("Darslik nomi 2–150 ta belgidan iborat bölsin.");
  }

  const { data: current, error: readError } = await supabase
    .from("textbooks")
    .select("book_type")
    .eq("id", textbookId)
    .maybeSingle();

  if (readError || !current) {
    fail("Darslik topilmadi.");
  }

  const isSchool =
    (current as { book_type: string } | null)?.book_type === "school";

  const grade = isSchool && gradeValue ? Number(gradeValue) : null;

  if (isSchool && !isValidGrade(grade)) {
    fail(`Maktab darsligi uçun sinfni tanlang (${MIN_GRADE}–${MAX_GRADE}).`);
  }

  const { error } = await supabase
    .from("textbooks")
    .update({
      title,
      author_name: authorName || null,
      grade,
    })
    .eq("id", textbookId);

  if (error) {
    fail(`Saqlanmadi: ${error.message}`);
  }

  revalidatePath("/admin/textbooks");
  revalidatePath("/textbooks");
  revalidatePath("/textbooks/school");
  revalidatePath("/textbooks/popular");

  redirect("/admin/textbooks?xabar=Darslik+yangilandi");
}

async function deleteTextbook(
  formData: FormData,
) {
  "use server";

  const supabase = await requireAdmin();

  const textbookId = Number(
    formData.get("textbookId"),
  );

  if (
    !Number.isInteger(textbookId) ||
    textbookId <= 0
  ) {
    return;
  }

  const {
    count,
    error: countError,
  } = await supabase
    .from("topics")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("textbook_id", textbookId);

  if (countError) {
    throw new Error(
      "Darslik mavzularini tekşirib bölmadi.",
    );
  }

  if (count && count > 0) {
    throw new Error(
      "Mavzulari mavjud darslikni öçirib bölmaydi.",
    );
  }

  const { error: deleteError } =
    await supabase
      .from("textbooks")
      .delete()
      .eq("id", textbookId);

  if (deleteError) {
    throw new Error(
      "Darslikni öçirib bölmadi.",
    );
  }

  revalidatePath("/admin/textbooks");
  revalidatePath("/textbooks");
  revalidatePath("/textbooks/school");
  revalidatePath("/textbooks/popular");
}

function TextbookCard({
  textbook,
  topicCount,
}: {
  textbook: TextbookRow;
  topicCount: number;
}) {
  const isSchool =
    textbook.book_type === "school";

  return (
    <article className="rounded-2xl border border-mb-line bg-white px-3 py-3 shadow-sm sm:px-4">
      <div className="flex items-center gap-3">
        {textbook.cover_url ? (
          <img
            loading="lazy"
            decoding="async"
            src={textbook.cover_url}
            alt=""
            className="h-14 w-11 shrink-0 rounded-md bg-slate-100 object-contain"
          />
        ) : (
          <span className="grid h-14 w-11 shrink-0 place-items-center rounded-md bg-slate-100 text-lg font-bold text-blue-300">
            {isSchool ? textbook.grade : "M"}
          </span>
        )}

        <Link
          href={`/admin/textbooks/manage?textbookId=${textbook.id}`}
          className="min-w-0 flex-1"
        >
          <span className="block truncate text-[15px] font-semibold text-mb-ink hover:text-mb-brand">
            {textbook.title}
          </span>

          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-mb-muted">
            {!textbook.is_published && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                Yopiq
              </span>
            )}
            {isSchool && <span>{textbook.grade}-sinf</span>}
            <span>{topicCount} mavzu</span>
            {textbook.author_name && <span>{textbook.author_name}</span>}
          </span>
        </Link>

        <RowMenu>
          <form action={changePublishedState}>
            <input type="hidden" name="textbookId" value={textbook.id} />
            <input
              type="hidden"
              name="nextState"
              value={String(!textbook.is_published)}
            />
            <SubmitButton className={rowMenuItem}>
              {textbook.is_published ? "Yopiş" : "Naşr qiliş"}
            </SubmitButton>
          </form>

          {topicCount === 0 && (
            <form action={deleteTextbook}>
              <input type="hidden" name="textbookId" value={textbook.id} />
              <ConfirmSubmitButton
                className={rowMenuDanger}
                title="Darslik öçirilsinmi?"
                description={`“${textbook.title}” butunlay öçiriladi.`}
              >
                Öçiriş
              </ConfirmSubmitButton>
            </form>
          )}
        </RowMenu>
      </div>

      <div className="mt-1 pl-14">
        {/* Ma'lumotlarni tahrirlash */}
        <details className="rounded-xl open:mt-2 open:border open:border-slate-200 open:bg-slate-50 open:p-3">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand">
            Nomi va muallifini tahrirlaş
          </summary>

          <form action={updateTextbook} className="mt-3 grid gap-3">
            <input type="hidden" name="textbookId" value={textbook.id} />

            <div>
              <label
                htmlFor={`title-${textbook.id}`}
                className="block text-xs font-semibold text-slate-600"
              >
                Darslik nomi
              </label>

              <input
                id={`title-${textbook.id}`}
                name="title"
                required
                maxLength={150}
                defaultValue={textbook.title}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor={`author-${textbook.id}`}
                className="block text-xs font-semibold text-slate-600"
              >
                Muallif (ixtiyoriy)
              </label>

              <input
                id={`author-${textbook.id}`}
                name="authorName"
                maxLength={150}
                defaultValue={textbook.author_name ?? ""}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {isSchool && (
              <div>
                <label
                  htmlFor={`grade-${textbook.id}`}
                  className="block text-xs font-semibold text-slate-600"
                >
                  Sinf
                </label>

                <select
                  id={`grade-${textbook.id}`}
                  name="grade"
                  defaultValue={String(textbook.grade ?? "")}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                >
                  {Array.from(
                    { length: MAX_GRADE - MIN_GRADE + 1 },
                    (_, index) => MIN_GRADE + index,
                  ).map((value) => (
                    <option key={value} value={value}>
                      {value}-sinf
                    </option>
                  ))}
                </select>
              </div>
            )}

            <SubmitButton className="min-h-11 rounded-xl bg-mb-brand px-4 text-sm font-bold text-white hover:bg-mb-brandDark">
              Saqlaş
            </SubmitButton>
          </form>
        </details>

        {/* Muqova — bu yerda almashtiriladi */}
        <details className="rounded-xl open:mt-2 open:border open:border-slate-200 open:bg-slate-50 open:p-3">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-semibold text-mb-brand">
            {textbook.cover_url
              ? "Muqovani almaştiriş"
              : "Muqova qöyiş"}
          </summary>

          <form action={updateCover} className="mt-3">
            <input
              type="hidden"
              name="textbookId"
              value={textbook.id}
            />

            <input
              type="file"
              name="coverImage"
              accept="image/png,image/jpeg,image/webp"
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mb-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-mb-brandDark"
            />

            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              PNG, JPG yoki WEBP; 2.5 MB gaça. Kitob surati oq
              yoki şaffof fonda bölsa çiroyli tuşadi.
            </p>

            <SubmitButton className="mt-3 rounded-xl bg-mb-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-mb-brandDark">
              Saqlaş
            </SubmitButton>
          </form>

          {textbook.cover_url && (
            <form action={updateCover} className="mt-2">
              <input
                type="hidden"
                name="textbookId"
                value={textbook.id}
              />

              <input type="hidden" name="remove" value="1" />

              <SubmitButton className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
                Muqovani olib taşlaş
              </SubmitButton>
            </form>
          )}
        </details>
      </div>
    </article>
  );
}

type PageProps = {
  searchParams: Promise<{
    xato?: string | string[];
    xabar?: string | string[];
  }>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminTextbooksPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const errorMessage = single(params.xato);
  const infoMessage = single(params.xabar);

  const supabase = await requireAdmin();

  const [
    textbooksResult,
    topicsResult,
  ] = await Promise.all([
    supabase
      .from("textbooks")
      .select(`
        id,
        title,
        grade,
        cover_url,
        author_name,
        book_type,
        is_published,
        created_at
      `)
      .order("book_type", {
        ascending: true,
      })
      .order("grade", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("topics")
      .select("textbook_id"),
  ]);

  if (textbooksResult.error) {
    throw new Error(
      `Darsliklar yuklanmadi: ${textbooksResult.error.message}`,
    );
  }

  if (topicsResult.error) {
    throw new Error(
      `Mavzular soni yuklanmadi: ${topicsResult.error.message}`,
    );
  }

  const textbooks =
    (textbooksResult.data ??
      []) as TextbookRow[];

  const topics =
    (topicsResult.data ??
      []) as TopicRow[];

  const topicCountMap =
    new Map<number, number>();

  for (const topic of topics) {
    topicCountMap.set(
      topic.textbook_id,
      (topicCountMap.get(
        topic.textbook_id,
      ) ?? 0) + 1,
    );
  }

  const schoolBooks =
    textbooks.filter(
      (book) =>
        book.book_type === "school",
    );

  const popularBooks =
    textbooks.filter(
      (book) =>
        book.book_type === "popular",
    );

  const publishedCount =
    textbooks.filter(
      (book) => book.is_published,
    ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <Link
                href="/admin"
                className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
              >
                ← Admin panelga qaytiş
              </Link>

              <h1 className="text-xl font-bold sm:text-2xl">Darslar</h1>

              <AdminTabs
                className="mt-2"
                active="/admin/textbooks"
                tabs={[
                { href: "/admin/lessons", label: "Videodarslar" },
                { href: "/admin/textbooks", label: "Darslik yeçimlari" },
              ]}
              />
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-xl bg-blue-50 px-4 py-2 font-semibold text-blue-800">
                Maktab: {schoolBooks.length}
              </span>

              <span className="rounded-xl bg-blue-50 px-4 py-2 font-semibold text-blue-800">
                Maşhur: {popularBooks.length}
              </span>

              <span className="rounded-xl bg-emerald-50 px-4 py-2 font-semibold text-emerald-800">
                Naşrda: {publishedCount}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {errorMessage && (
          <AppAlert variant="error" title="Bajarilmadi" className="mt-5">
            {errorMessage}
          </AppAlert>
        )}

        {infoMessage && (
          <AppAlert variant="success" title="Bajarildi" className="mt-5">
            {infoMessage}
          </AppAlert>
        )}
      </div>

      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
        <CreatePanel
          label="Yangi darslik"
          defaultOpen={schoolBooks.length + popularBooks.length === 0}
        >
          <CreateTextbookForm action={createTextbook} />
        </CreatePanel>

        <div className="mt-8 space-y-8">
          <section>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  Maktab darsliklari
                </h2>
              </div>

              <span className="text-sm font-semibold text-slate-500">
                {schoolBooks.length} ta
              </span>
            </div>

            {schoolBooks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                Maktab darsligi hali yaratilmagan.
              </div>
            ) : (
              <div className="space-y-2">
                {schoolBooks.map((book) => (
                  <TextbookCard
                    key={book.id}
                    textbook={book}
                    topicCount={
                      topicCountMap.get(
                        book.id,
                      ) ?? 0
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  Maşhur darslik yeçimlari
                </h2>
              </div>

              <span className="text-sm font-semibold text-slate-500">
                {popularBooks.length} ta
              </span>
            </div>

            {popularBooks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                Maşhur darslik hali yaratilmagan.
              </div>
            ) : (
              <div className="space-y-2">
                {popularBooks.map((book) => (
                  <TextbookCard
                    key={book.id}
                    textbook={book}
                    topicCount={
                      topicCountMap.get(
                        book.id,
                      ) ?? 0
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
