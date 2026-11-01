/**
 * Test boshqaruvi sahifasining umumiy qismi.
 *
 * Ilgari bularning hammasi `page.tsx` ichida — 2781 qatorli bitta
 * faylda edi. Bu yerda faqat yordamchi funksiyalar va tiplar
 * turadi: ularni `page.tsx` ham, `actions.ts` ham ishlatadi.
 *
 * Faqat server komponentlari va server action'lari ishlatadi.
 */
import { randomUUID } from "node:crypto";

import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";

export const QUESTION_IMAGE_BUCKET = "question-images";
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const IMAGE_EXTENSION_BY_TYPE = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type QuestionRow = {
  id: number;
  question_text: string;
  image_path: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  order_number: number;
  question_type: "multiple_choice" | "written";
  block_id: number | null;
  part_label: string | null;
};

export type QuestionBlockRow = {
  id: number;
  test_id: number;
  block_type: "written_parts" | "shared_options";
  stimulus_text: string | null;
  image_path: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  option_f: string | null;
  order_number: number;
};

export type AnswerKeyRow = {
  question_id: number;
  correct_answer: string;
  accepted_answers: string[];
  solution_text: string | null;
  solution_video_url: string | null;
};

/** Admin tekshiruvi — umumiy yordamchi orqali */
export async function getAdminClient() {
  return requireAdmin();
}

export function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export function readImage(formData: FormData, name: string) {
  const value = formData.get(name);

  return value instanceof File && value.size > 0 ? value : null;
}

export function parseAcceptedAnswers(value: string, primaryAnswer: string) {
  const normalizedPrimary = primaryAnswer.trim().toLocaleLowerCase("uz");

  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((answer) => answer.trim())
        .filter(Boolean)
        .filter(
          (answer) => answer.toLocaleLowerCase("uz") !== normalizedPrimary,
        ),
    ),
  );
}

export function validateTestId(testId: number) {
  if (!Number.isInteger(testId) || testId <= 0) {
    throw new Error("Test ID notöğri.");
  }
}

export function normalizePositiveMinutes(value: string) {
  const normalized = value.replace(",", ".");

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    throw new Error("Vaqtni 0 dan katta son körinişida kiriting.");
  }

  if (/^0*(?:\.0*)?$/.test(normalized)) {
    throw new Error("Test vaqti 0 dan katta bölişi kerak.");
  }

  return normalized;
}

export async function uploadImage(
  supabase: SupabaseServerClient,
  testId: number,
  folder: string,
  image: File | null,
) {
  if (!image) {
    return null;
  }

  const extension = IMAGE_EXTENSION_BY_TYPE.get(image.type);

  if (!extension) {
    throw new Error("Rasm faqat PNG, JPG yoki WEBP formatida bölişi kerak.");
  }

  if (image.size > MAX_IMAGE_SIZE) {
    throw new Error("Rasm hajmi 5 MB dan oşmasligi kerak.");
  }

  const imagePath = `${testId}/${folder}/${randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(imagePath, image, {
      cacheControl: "3600",
      contentType: image.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Rasm yuklanmadi: ${error.message}`);
  }

  return imagePath;
}

export async function removeImage(
  supabase: SupabaseServerClient,
  imagePath: string | null,
) {
  if (!imagePath) {
    return;
  }

  const { error } = await supabase.storage
    .from(QUESTION_IMAGE_BUCKET)
    .remove([imagePath]);

  if (error) {
    console.error("Storage içidagi rasm öçirilmadi:", error);
  }
}

export async function getNextDisplayNumber(
  supabase: SupabaseServerClient,
  testId: number,
) {
  const [
    { data: standaloneQuestions, error: questionsError },
    { data: blocks, error: blocksError },
  ] = await Promise.all([
    supabase
      .from("questions")
      .select("order_number")
      .eq("test_id", testId)
      .is("block_id", null),
    supabase
      .from("question_blocks")
      .select("order_number, block_type")
      .eq("test_id", testId),
  ]);

  if (questionsError) {
    throw new Error(`Savollar tartibi aniqlanmadi: ${questionsError.message}`);
  }

  if (blocksError) {
    throw new Error(
      `Savol bloklari tartibi aniqlanmadi: ${blocksError.message}`,
    );
  }

  let maximumNumber = 0;

  for (const question of standaloneQuestions ?? []) {
    maximumNumber = Math.max(maximumNumber, question.order_number);
  }

  for (const block of blocks ?? []) {
    const blockEnd =
      block.block_type === "shared_options"
        ? block.order_number + 2
        : block.order_number;

    maximumNumber = Math.max(maximumNumber, blockEnd);
  }

  return maximumNumber + 1;
}

export async function renumberTestQuestions(
  supabase: SupabaseServerClient,
  testId: number,
) {
  const [
    { data: standaloneQuestions, error: questionsError },
    { data: blocks, error: blocksError },
  ] = await Promise.all([
    supabase
      .from("questions")
      .select("id, order_number")
      .eq("test_id", testId)
      .is("block_id", null)
      .order("order_number", { ascending: true }),
    supabase
      .from("question_blocks")
      .select("id, order_number, block_type")
      .eq("test_id", testId)
      .order("order_number", { ascending: true }),
  ]);

  if (questionsError) {
    throw new Error(
      `Oddiy savollar qayta raqamlanmadi: ${questionsError.message}`,
    );
  }

  if (blocksError) {
    throw new Error(
      `Savol bloklari qayta raqamlanmadi: ${blocksError.message}`,
    );
  }

  const items = [
    ...(standaloneQuestions ?? []).map((question) => ({
      kind: "question" as const,
      id: question.id,
      orderNumber: question.order_number,
      blockType: null,
    })),
    ...(blocks ?? []).map((block) => ({
      kind: "block" as const,
      id: block.id,
      orderNumber: block.order_number,
      blockType: block.block_type as
        | "written_parts"
        | "shared_options",
    })),
  ].sort((first, second) =>
    first.orderNumber === second.orderNumber
      ? first.kind.localeCompare(second.kind)
      : first.orderNumber - second.orderNumber,
  );

  let nextNumber = 1;

  for (const item of items) {
    if (item.kind === "question") {
      if (item.orderNumber !== nextNumber) {
        const { error } = await supabase
          .from("questions")
          .update({ order_number: nextNumber })
          .eq("id", item.id)
          .eq("test_id", testId)
          .is("block_id", null);

        if (error) {
          throw new Error(
            `Savol raqami yangilanmadi: ${error.message}`,
          );
        }
      }

      nextNumber += 1;
      continue;
    }

    if (item.orderNumber !== nextNumber) {
      const { error } = await supabase
        .from("question_blocks")
        .update({ order_number: nextNumber })
        .eq("id", item.id)
        .eq("test_id", testId);

      if (error) {
        throw new Error(
          `Savol bloki raqami yangilanmadi: ${error.message}`,
        );
      }
    }

    if (item.blockType === "shared_options") {
      const { data: blockQuestions, error: blockQuestionsError } =
        await supabase
          .from("questions")
          .select("id, order_number")
          .eq("test_id", testId)
          .eq("block_id", item.id)
          .order("order_number", { ascending: true });

      if (blockQuestionsError) {
        throw new Error(
          `Uçtalik savollar raqami aniqlanmadi: ${blockQuestionsError.message}`,
        );
      }

      for (const [index, question] of (blockQuestions ?? []).entries()) {
        const { error } = await supabase
          .from("questions")
          .update({ part_label: String(nextNumber + index) })
          .eq("id", question.id)
          .eq("test_id", testId)
          .eq("block_id", item.id);

        if (error) {
          throw new Error(
            `Uçtalik savol raqami yangilanmadi: ${error.message}`,
          );
        }
      }

      nextNumber += 3;
      continue;
    }

    nextNumber += 1;
  }
}
export async function createSignedUrlMap(
  supabase: SupabaseServerClient,
  rows: Array<{
    id: number;
    image_path: string | null;
  }>,
) {
  const result = new Map<number, string>();

  await Promise.all(
    rows.map(async (row) => {
      if (!row.image_path) {
        return;
      }

      const { data, error } = await supabase.storage
        .from(QUESTION_IMAGE_BUCKET)
        .createSignedUrl(row.image_path, 60 * 60);

      if (error) {
        console.error(`Rasm oçilmadi (${row.id}):`, error);
        return;
      }

      result.set(row.id, data.signedUrl);
    }),
  );

  return result;
}
