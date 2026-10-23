import type { SupabaseClient } from "@supabase/supabase-js";

import type { ParsedQuestion } from "@/lib/pdf-import";

/*
 * Tuzilgan testni bazaga yozish.
 *
 * Mantiq scripts/import-test.mjs dagi bilan bir xil — xato chiqsa
 * yaratilgan test o'chiriladi, bazada yarim test qolmaydi.
 */

type SaveInput = {
  /* Test tushadigan mavzu; bo'lim shu mavzudan aniqlanadi */
  topicId: number;
  sectionId: number;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  questions: ParsedQuestion[];
};

type SaveResult = {
  testId: number | null;
  error: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;

export async function saveParsedTest(
  supabase: Client,
  input: SaveInput,
): Promise<SaveResult> {
  // Tartib raqami — mavzudagi oxirgisidan keyin
  const { data: lastTest } = await supabase
    .from("tests")
    .select("order_number")
    .eq("topic_id", input.topicId)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderNumber = ((lastTest?.order_number as number | undefined) ?? 0) + 1;

  const { data: test, error: testError } = await supabase
    .from("tests")
    .insert({
      section_id: input.sectionId,
      topic_id: input.topicId,
      title: input.title,
      description: input.description,
      time_limit_minutes: input.timeLimitMinutes,
      order_number: orderNumber,
      is_published: false, // har doim qoralama
      is_free: false,
    })
    .select("id")
    .single();

  if (testError || !test) {
    return {
      testId: null,
      error: `Test yaratilmadi: ${testError?.message ?? "noma'lum xato"}`,
    };
  }

  const testId = test.id as number;

  async function rollback(reason: string): Promise<SaveResult> {
    await supabase.from("tests").delete().eq("id", testId);
    return { testId: null, error: reason };
  }

  let displayNumber = 0;

  for (const [index, question] of input.questions.entries()) {
    displayNumber += 1;

    if (question.type === "choice") {
      const { data: created, error: questionError } = await supabase
        .from("questions")
        .insert({
          test_id: testId,
          question_text: question.text,
          image_path: null,
          option_a: question.options.a,
          option_b: question.options.b,
          option_c: question.options.c,
          option_d: question.options.d,
          order_number: displayNumber,
          question_type: "multiple_choice",
          block_id: null,
          part_label: null,
        })
        .select("id")
        .single();

      if (questionError || !created) {
        return rollback(
          `${index + 1}-savol saqlanmadi: ${questionError?.message}`,
        );
      }

      const { error: answerError } = await supabase
        .from("answer_keys")
        .insert({
          question_id: created.id,
          correct_answer: question.correct,
          accepted_answers: [],
          solution_text: question.solution,
          solution_video_url: question.solutionVideo,
        });

      if (answerError) {
        return rollback(
          `${index + 1}-savol javobi saqlanmadi: ${answerError.message}`,
        );
      }

      continue;
    }

    // Yozma savol: avval blok, keyin qismlar
    const { data: block, error: blockError } = await supabase
      .from("question_blocks")
      .insert({
        test_id: testId,
        block_type: "written_parts",
        stimulus_text: question.text,
        image_path: null,
        option_a: null,
        option_b: null,
        option_c: null,
        option_d: null,
        option_e: null,
        option_f: null,
        order_number: displayNumber,
      })
      .select("id")
      .single();

    if (blockError || !block) {
      return rollback(
        `${index + 1}-savol bloki saqlanmadi: ${blockError?.message}`,
      );
    }

    const { data: parts, error: partsError } = await supabase
      .from("questions")
      .insert(
        question.parts.map((part, partIndex) => ({
          test_id: testId,
          question_text: part.text,
          image_path: null,
          option_a: null,
          option_b: null,
          option_c: null,
          option_d: null,
          order_number: partIndex + 1,
          question_type: "written",
          block_id: block.id,
          part_label: part.label,
        })),
      )
      .select("id, part_label");

    if (partsError || !parts) {
      return rollback(
        `${index + 1}-savol qismlari saqlanmadi: ${partsError?.message}`,
      );
    }

    const answerRows = question.parts.map((part) => {
      const match = parts.find(
        (row: { part_label: string | null }) => row.part_label === part.label,
      );

      const accepted = [
        ...new Set([part.answer, ...(part.accepted ?? [])]),
      ];

      return {
        question_id: match?.id,
        correct_answer: part.answer,
        accepted_answers: accepted,
        solution_text: part.solution ?? null,
        solution_video_url: part.solutionVideo ?? null,
      };
    });

    if (answerRows.some((row) => !row.question_id)) {
      return rollback(
        `${index + 1}-savol: qism belgilari mos kelmadi`,
      );
    }

    const { error: answersError } = await supabase
      .from("answer_keys")
      .insert(answerRows);

    if (answersError) {
      return rollback(
        `${index + 1}-savol javoblari saqlanmadi: ${answersError.message}`,
      );
    }
  }

  return { testId, error: null };
}
