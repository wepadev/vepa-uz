"use server";

/**
 * Test boshqaruvidagi server action'lari.
 *
 * Savol qo'shish, tahrirlash, o'chirish, nashr holatini o'zgartirish
 * — hammasi shu yerda. Ilgari `page.tsx` ichida edi va faylni
 * o'qib bo'lmas darajada uzaytirib yuborgandi.
 *
 * Har bir action oxirida `revalidatePath` chaqiriladi: o'quvchi
 * ko'radigan sahifalar keshda eskirib qolmasin.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getAdminClient,
  getNextDisplayNumber,
  normalizePositiveMinutes,
  parseAcceptedAnswers,
  readImage,
  readText,
  removeImage,
  renumberTestQuestions,
  uploadImage,
  validateTestId,
} from "./shared";

export async function addMultipleChoiceQuestion(formData: FormData) {
  const supabase = await getAdminClient();

  const testId = Number(formData.get("testId"));
  const questionText = readText(formData, "questionText");
  const optionA = readText(formData, "optionA");
  const optionB = readText(formData, "optionB");
  const optionC = readText(formData, "optionC");
  const optionD = readText(formData, "optionD");
  const correctAnswer = readText(formData, "correctAnswer");
  const solutionText = readText(formData, "solutionText");
  const solutionVideoUrl = readText(formData, "solutionVideoUrl");
  const questionImage = readImage(formData, "questionImage");

  validateTestId(testId);

  if (!questionText || !optionA || !optionB || !optionC || !optionD) {
    throw new Error("Savol va barça A–D javob variantlarini kiriting.");
  }

  if (!["A", "B", "C", "D"].includes(correctAnswer)) {
    throw new Error("Töğri javobni tanlang.");
  }

  const imagePath = await uploadImage(
    supabase,
    testId,
    "questions",
    questionImage,
  );

  try {
    const nextOrderNumber = await getNextDisplayNumber(supabase, testId);

    const { data: question, error: questionError } = await supabase
      .from("questions")
      .insert({
        test_id: testId,
        question_text: questionText,
        image_path: imagePath,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        order_number: nextOrderNumber,
        question_type: "multiple_choice",
        block_id: null,
        part_label: null,
      })
      .select("id")
      .single();

    if (questionError || !question) {
      throw new Error(
        `Savol saqlanmadi: ${questionError?.message ?? "Noma’lum xato"}`,
      );
    }

    const { error: answerError } = await supabase.from("answer_keys").insert({
      question_id: question.id,
      correct_answer: correctAnswer,
      accepted_answers: [],
      solution_text: solutionText || null,
      solution_video_url: solutionVideoUrl || null,
    });

    if (answerError) {
      await supabase.from("questions").delete().eq("id", question.id);

      throw new Error(`Javob saqlanmadi: ${answerError.message}`);
    }
  } catch (error) {
    await removeImage(supabase, imagePath);
    throw error;
  }

  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/manage");
  redirect(`/admin/tests/manage?testId=${testId}`);
}

export async function addWrittenPartsBlock(formData: FormData) {
  const supabase = await getAdminClient();

  const testId = Number(formData.get("testId"));
  const stimulusText = readText(formData, "writtenStimulusText");
  const blockImage = readImage(formData, "writtenBlockImage");

  const partAText = readText(formData, "partAText");
  const partAAnswer = readText(formData, "partAAnswer");
  const partAAccepted = readText(formData, "partAAccepted");
  const partASolution = readText(formData, "partASolution");
  const partAVideo = readText(formData, "partAVideo");

  const partBText = readText(formData, "partBText");
  const partBAnswer = readText(formData, "partBAnswer");
  const partBAccepted = readText(formData, "partBAccepted");
  const partBSolution = readText(formData, "partBSolution");
  const partBVideo = readText(formData, "partBVideo");

  validateTestId(testId);

  if (!stimulusText && !blockImage) {
    throw new Error("Umumiy savol matni yoki çizmani kiriting.");
  }

  if (!partAText || !partAAnswer || !partBText || !partBAnswer) {
    throw new Error(
      "a) va b) qismlarining savoli hamda töğri javobini kiriting.",
    );
  }

  const imagePath = await uploadImage(
    supabase,
    testId,
    "written-blocks",
    blockImage,
  );

  let blockId: number | null = null;

  try {
    const nextDisplayNumber = await getNextDisplayNumber(supabase, testId);

    const { data: block, error: blockError } = await supabase
      .from("question_blocks")
      .insert({
        test_id: testId,
        block_type: "written_parts",
        stimulus_text: stimulusText || null,
        image_path: imagePath,
        option_a: null,
        option_b: null,
        option_c: null,
        option_d: null,
        option_e: null,
        option_f: null,
        order_number: nextDisplayNumber,
      })
      .select("id")
      .single();

    if (blockError || !block) {
      throw new Error(
        `Yozma savol bloki saqlanmadi: ${
          blockError?.message ?? "Noma’lum xato"
        }`,
      );
    }

    blockId = block.id;

    const { data: createdQuestions, error: questionsError } = await supabase
      .from("questions")
      .insert([
        {
          test_id: testId,
          question_text: partAText,
          image_path: null,
          option_a: null,
          option_b: null,
          option_c: null,
          option_d: null,
          order_number: 1,
          question_type: "written",
          block_id: block.id,
          part_label: "a",
        },
        {
          test_id: testId,
          question_text: partBText,
          image_path: null,
          option_a: null,
          option_b: null,
          option_c: null,
          option_d: null,
          order_number: 2,
          question_type: "written",
          block_id: block.id,
          part_label: "b",
        },
      ])
      .select("id, part_label");

    if (questionsError || !createdQuestions || createdQuestions.length !== 2) {
      throw new Error(
        `a) va b) savollari saqlanmadi: ${
          questionsError?.message ?? "Noma’lum xato"
        }`,
      );
    }

    const partAQuestion = createdQuestions.find(
      (question) => question.part_label === "a",
    );
    const partBQuestion = createdQuestions.find(
      (question) => question.part_label === "b",
    );

    if (!partAQuestion || !partBQuestion) {
      throw new Error("Yozma savol qismlari aniqlanmadi.");
    }

    const { error: answersError } = await supabase.from("answer_keys").insert([
      {
        question_id: partAQuestion.id,
        correct_answer: partAAnswer,
        accepted_answers: parseAcceptedAnswers(partAAccepted, partAAnswer),
        solution_text: partASolution || null,
        solution_video_url: partAVideo || null,
      },
      {
        question_id: partBQuestion.id,
        correct_answer: partBAnswer,
        accepted_answers: parseAcceptedAnswers(partBAccepted, partBAnswer),
        solution_text: partBSolution || null,
        solution_video_url: partBVideo || null,
      },
    ]);

    if (answersError) {
      throw new Error(`Yozma javoblar saqlanmadi: ${answersError.message}`);
    }
  } catch (error) {
    if (blockId) {
      await supabase
        .from("question_blocks")
        .delete()
        .eq("id", blockId)
        .eq("test_id", testId);
    }

    await removeImage(supabase, imagePath);
    throw error;
  }

  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/manage");
  redirect(`/admin/tests/manage?testId=${testId}&tur=yozma`);
}

export async function addSharedOptionsBlock(formData: FormData) {
  const supabase = await getAdminClient();

  const testId = Number(formData.get("testId"));
  const stimulusText = readText(formData, "sharedStimulusText");
  const blockImage = readImage(formData, "sharedBlockImage");

  const options = {
    A: readText(formData, "sharedOptionA"),
    B: readText(formData, "sharedOptionB"),
    C: readText(formData, "sharedOptionC"),
    D: readText(formData, "sharedOptionD"),
    E: readText(formData, "sharedOptionE"),
    F: readText(formData, "sharedOptionF"),
  };

  const questionTexts = [
    readText(formData, "sharedQuestion1Text"),
    readText(formData, "sharedQuestion2Text"),
    readText(formData, "sharedQuestion3Text"),
  ];

  const correctAnswers = [
    readText(formData, "sharedQuestion1Answer"),
    readText(formData, "sharedQuestion2Answer"),
    readText(formData, "sharedQuestion3Answer"),
  ];

  const solutions = [
    readText(formData, "sharedQuestion1Solution"),
    readText(formData, "sharedQuestion2Solution"),
    readText(formData, "sharedQuestion3Solution"),
  ];

  const videos = [
    readText(formData, "sharedQuestion1Video"),
    readText(formData, "sharedQuestion2Video"),
    readText(formData, "sharedQuestion3Video"),
  ];

  validateTestId(testId);

  if (!stimulusText && !blockImage) {
    throw new Error("Umumiy matn yoki çizmani kiriting.");
  }

  if (Object.values(options).some((option) => !option)) {
    throw new Error("A, B, C, D, E va F variantlarining barçasini kiriting.");
  }

  if (questionTexts.some((text) => !text)) {
    throw new Error("Uçta savol matnini kiriting.");
  }

  if (
    correctAnswers.some(
      (answer) => !["A", "B", "C", "D", "E", "F"].includes(answer),
    )
  ) {
    throw new Error(
      "Uçta savol uçun A–F oraliğidagi töğri javoblarni tanlang.",
    );
  }

  const imagePath = await uploadImage(
    supabase,
    testId,
    "shared-blocks",
    blockImage,
  );

  let blockId: number | null = null;

  try {
    const firstQuestionNumber = await getNextDisplayNumber(supabase, testId);

    const { data: block, error: blockError } = await supabase
      .from("question_blocks")
      .insert({
        test_id: testId,
        block_type: "shared_options",
        stimulus_text: stimulusText || null,
        image_path: imagePath,
        option_a: options.A,
        option_b: options.B,
        option_c: options.C,
        option_d: options.D,
        option_e: options.E,
        option_f: options.F,
        order_number: firstQuestionNumber,
      })
      .select("id")
      .single();

    if (blockError || !block) {
      throw new Error(
        `Umumiy variantli blok saqlanmadi: ${
          blockError?.message ?? "Noma’lum xato"
        }`,
      );
    }

    blockId = block.id;

    const questionRows = questionTexts.map((questionText, index) => ({
      test_id: testId,
      question_text: questionText,
      image_path: null,
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      order_number: index + 1,
      question_type: "multiple_choice",
      block_id: block.id,
      part_label: String(firstQuestionNumber + index),
    }));

    const { data: createdQuestions, error: questionsError } = await supabase
      .from("questions")
      .insert(questionRows)
      .select("id, order_number");

    if (questionsError || !createdQuestions || createdQuestions.length !== 3) {
      throw new Error(
        `Uçta savol saqlanmadi: ${questionsError?.message ?? "Noma’lum xato"}`,
      );
    }

    const sortedQuestions = [...createdQuestions].sort(
      (a, b) => a.order_number - b.order_number,
    );

    const answerRows = sortedQuestions.map((question, index) => ({
      question_id: question.id,
      correct_answer: correctAnswers[index],
      accepted_answers: [],
      solution_text: solutions[index] || null,
      solution_video_url: videos[index] || null,
    }));

    const { error: answersError } = await supabase
      .from("answer_keys")
      .insert(answerRows);

    if (answersError) {
      throw new Error(`Uçta savol javobi saqlanmadi: ${answersError.message}`);
    }
  } catch (error) {
    if (blockId) {
      await supabase
        .from("question_blocks")
        .delete()
        .eq("id", blockId)
        .eq("test_id", testId);
    }

    await removeImage(supabase, imagePath);
    throw error;
  }

  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/manage");
  redirect(`/admin/tests/manage?testId=${testId}&tur=umumiy`);
}

export async function updateTestDetails(formData: FormData) {
  const supabase = await getAdminClient();

  const testId = Number(formData.get("testId"));
  const title = readText(formData, "title");
  const description = readText(formData, "description");
  const timeLimitMinutes = normalizePositiveMinutes(
    readText(formData, "timeLimitMinutes"),
  );

  validateTestId(testId);

  if (!title) {
    throw new Error("Test nomini kiriting.");
  }

  const { error } = await supabase
    .from("tests")
    .update({
      title,
      description: description || null,
      time_limit_minutes: timeLimitMinutes,
    })
    .eq("id", testId);

  if (error) {
    throw new Error(`Test ma’lumotlari tahrirlanmadi: ${error.message}`);
  }

  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/manage");
  redirect(`/admin/tests/manage?testId=${testId}`);
}

export async function updateStandaloneQuestion(formData: FormData) {
  const supabase = await getAdminClient();

  const testId = Number(formData.get("testId"));
  const questionId = Number(formData.get("questionId"));
  const questionText = readText(formData, "editQuestionText");
  const optionA = readText(formData, "editOptionA");
  const optionB = readText(formData, "editOptionB");
  const optionC = readText(formData, "editOptionC");
  const optionD = readText(formData, "editOptionD");
  const correctAnswer = readText(formData, "editCorrectAnswer");
  const solutionText = readText(formData, "editSolutionText");
  const solutionVideoUrl = readText(formData, "editSolutionVideoUrl");
  const replacementImage = readImage(formData, "editQuestionImage");
  const removeCurrentImage = formData.get("removeCurrentImage") === "true";

  validateTestId(testId);

  if (!Number.isInteger(questionId) || questionId <= 0) {
    throw new Error("Savol ID notöğri.");
  }

  if (!questionText || !optionA || !optionB || !optionC || !optionD) {
    throw new Error("Savol va barça A–D variantlarini kiriting.");
  }

  if (!["A", "B", "C", "D"].includes(correctAnswer)) {
    throw new Error("Töğri javobni tanlang.");
  }

  const { data: currentQuestion, error: lookupError } = await supabase
    .from("questions")
    .select("image_path, block_id")
    .eq("id", questionId)
    .eq("test_id", testId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Savol aniqlanmadi: ${lookupError.message}`);
  }

  if (!currentQuestion) {
    throw new Error("Savol topilmadi.");
  }

  if (currentQuestion.block_id !== null) {
    throw new Error("Bu savol blok tarkibida.");
  }

  const newImagePath = await uploadImage(
    supabase,
    testId,
    "questions",
    replacementImage,
  );

  const finalImagePath = newImagePath
    ? newImagePath
    : removeCurrentImage
      ? null
      : currentQuestion.image_path;

  try {
    const { error: questionError } = await supabase
      .from("questions")
      .update({
        question_text: questionText,
        image_path: finalImagePath,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
      })
      .eq("id", questionId)
      .eq("test_id", testId)
      .is("block_id", null);

    if (questionError) {
      throw new Error(`Savol tahrirlanmadi: ${questionError.message}`);
    }

    const { error: answerError } = await supabase
      .from("answer_keys")
      .upsert(
        {
          question_id: questionId,
          correct_answer: correctAnswer,
          accepted_answers: [],
          solution_text: solutionText || null,
          solution_video_url: solutionVideoUrl || null,
        },
        { onConflict: "question_id" },
      );

    if (answerError) {
      throw new Error(`Javob tahrirlanmadi: ${answerError.message}`);
    }
  } catch (error) {
    await removeImage(supabase, newImagePath);
    throw error;
  }

  if (
    currentQuestion.image_path &&
    currentQuestion.image_path !== finalImagePath
  ) {
    await removeImage(supabase, currentQuestion.image_path);
  }

  revalidatePath("/admin/tests/manage");
  revalidatePath("/tests/take");
  redirect(`/admin/tests/manage?testId=${testId}`);
}

export async function updateQuestionBlock(formData: FormData) {
  const supabase = await getAdminClient();

  const testId = Number(formData.get("testId"));
  const blockId = Number(formData.get("blockId"));
  const blockType = readText(formData, "blockType");
  const stimulusText = readText(formData, "editStimulusText");
  const replacementImage = readImage(formData, "editBlockImage");
  const removeCurrentImage = formData.get("removeCurrentImage") === "true";

  validateTestId(testId);

  if (!Number.isInteger(blockId) || blockId <= 0) {
    throw new Error("Savol bloki ID notöğri.");
  }

  if (!["written_parts", "shared_options"].includes(blockType)) {
    throw new Error("Savol bloki turi notöğri.");
  }

  const { data: currentBlock, error: blockLookupError } = await supabase
    .from("question_blocks")
    .select("id, block_type, image_path")
    .eq("id", blockId)
    .eq("test_id", testId)
    .maybeSingle();

  if (blockLookupError) {
    throw new Error(`Savol bloki aniqlanmadi: ${blockLookupError.message}`);
  }

  if (!currentBlock || currentBlock.block_type !== blockType) {
    throw new Error("Savol bloki topilmadi.");
  }

  const { data: blockQuestions, error: questionsError } = await supabase
    .from("questions")
    .select("id, order_number, part_label")
    .eq("test_id", testId)
    .eq("block_id", blockId)
    .order("order_number", { ascending: true });

  if (questionsError) {
    throw new Error(`Içki savollar yuklanmadi: ${questionsError.message}`);
  }

  if (!blockQuestions) {
    throw new Error("Içki savollar topilmadi.");
  }

  const newImagePath = await uploadImage(
    supabase,
    testId,
    blockType === "written_parts" ? "written-blocks" : "shared-blocks",
    replacementImage,
  );

  const finalImagePath = newImagePath
    ? newImagePath
    : removeCurrentImage
      ? null
      : currentBlock.image_path;

  try {
    if (!stimulusText && !finalImagePath) {
      throw new Error("Umumiy matn yoki çizmani kiriting.");
    }

    if (blockType === "written_parts") {
      const partA = blockQuestions.find((question) => question.part_label === "a");
      const partB = blockQuestions.find((question) => question.part_label === "b");

      if (!partA || !partB) {
        throw new Error("a) yoki b) qismi topilmadi.");
      }

      const partAText = readText(formData, "editPartAText");
      const partAAnswer = readText(formData, "editPartAAnswer");
      const partAAccepted = readText(formData, "editPartAAccepted");
      const partASolution = readText(formData, "editPartASolution");
      const partAVideo = readText(formData, "editPartAVideo");

      const partBText = readText(formData, "editPartBText");
      const partBAnswer = readText(formData, "editPartBAnswer");
      const partBAccepted = readText(formData, "editPartBAccepted");
      const partBSolution = readText(formData, "editPartBSolution");
      const partBVideo = readText(formData, "editPartBVideo");

      if (!partAText || !partAAnswer || !partBText || !partBAnswer) {
        throw new Error(
          "a) va b) qismlarining savoli hamda javobini kiriting.",
        );
      }

      const { error: blockError } = await supabase
        .from("question_blocks")
        .update({
          stimulus_text: stimulusText || null,
          image_path: finalImagePath,
        })
        .eq("id", blockId)
        .eq("test_id", testId);

      if (blockError) {
        throw new Error(`Savol bloki tahrirlanmadi: ${blockError.message}`);
      }

      const writtenUpdates = [
        {
          question: partA,
          text: partAText,
          answer: partAAnswer,
          accepted: partAAccepted,
          solution: partASolution,
          video: partAVideo,
        },
        {
          question: partB,
          text: partBText,
          answer: partBAnswer,
          accepted: partBAccepted,
          solution: partBSolution,
          video: partBVideo,
        },
      ];

      for (const item of writtenUpdates) {
        const { error: questionError } = await supabase
          .from("questions")
          .update({ question_text: item.text })
          .eq("id", item.question.id)
          .eq("test_id", testId)
          .eq("block_id", blockId);

        if (questionError) {
          throw new Error(`Içki savol tahrirlanmadi: ${questionError.message}`);
        }

        const { error: answerError } = await supabase
          .from("answer_keys")
          .upsert(
            {
              question_id: item.question.id,
              correct_answer: item.answer,
              accepted_answers: parseAcceptedAnswers(
                item.accepted,
                item.answer,
              ),
              solution_text: item.solution || null,
              solution_video_url: item.video || null,
            },
            { onConflict: "question_id" },
          );

        if (answerError) {
          throw new Error(`Içki javob tahrirlanmadi: ${answerError.message}`);
        }
      }
    } else {
      if (blockQuestions.length !== 3) {
        throw new Error("A–F blokida aynan 3 ta savol bölişi kerak.");
      }

      const options = {
        option_a: readText(formData, "editSharedOptionA"),
        option_b: readText(formData, "editSharedOptionB"),
        option_c: readText(formData, "editSharedOptionC"),
        option_d: readText(formData, "editSharedOptionD"),
        option_e: readText(formData, "editSharedOptionE"),
        option_f: readText(formData, "editSharedOptionF"),
      };

      if (Object.values(options).some((option) => !option)) {
        throw new Error("A–F variantlarining barçasini kiriting.");
      }

      const sharedUpdates = blockQuestions.map((question, index) => ({
        question,
        text: readText(formData, `editSharedQuestion${index + 1}Text`),
        answer: readText(formData, `editSharedQuestion${index + 1}Answer`),
        solution: readText(formData, `editSharedQuestion${index + 1}Solution`),
        video: readText(formData, `editSharedQuestion${index + 1}Video`),
      }));

      if (sharedUpdates.some((item) => !item.text)) {
        throw new Error("Uçta savol matnini kiriting.");
      }

      if (
        sharedUpdates.some(
          (item) => !["A", "B", "C", "D", "E", "F"].includes(item.answer),
        )
      ) {
        throw new Error("Har bir savol uçun A–F javobini tanlang.");
      }

      const { error: blockError } = await supabase
        .from("question_blocks")
        .update({
          stimulus_text: stimulusText || null,
          image_path: finalImagePath,
          ...options,
        })
        .eq("id", blockId)
        .eq("test_id", testId);

      if (blockError) {
        throw new Error(`Savol bloki tahrirlanmadi: ${blockError.message}`);
      }

      for (const item of sharedUpdates) {
        const { error: questionError } = await supabase
          .from("questions")
          .update({ question_text: item.text })
          .eq("id", item.question.id)
          .eq("test_id", testId)
          .eq("block_id", blockId);

        if (questionError) {
          throw new Error(`Içki savol tahrirlanmadi: ${questionError.message}`);
        }

        const { error: answerError } = await supabase
          .from("answer_keys")
          .upsert(
            {
              question_id: item.question.id,
              correct_answer: item.answer,
              accepted_answers: [],
              solution_text: item.solution || null,
              solution_video_url: item.video || null,
            },
            { onConflict: "question_id" },
          );

        if (answerError) {
          throw new Error(`Içki javob tahrirlanmadi: ${answerError.message}`);
        }
      }
    }
  } catch (error) {
    await removeImage(supabase, newImagePath);
    throw error;
  }

  if (currentBlock.image_path && currentBlock.image_path !== finalImagePath) {
    await removeImage(supabase, currentBlock.image_path);
  }

  revalidatePath("/admin/tests/manage");
  revalidatePath("/tests/take");
  redirect(`/admin/tests/manage?testId=${testId}`);
}

export async function changePublishedState(formData: FormData) {
  const supabase = await getAdminClient();

  const testId = Number(formData.get("testId"));
  const nextState = formData.get("nextState") === "true";

  validateTestId(testId);

  if (nextState) {
    const { count, error } = await supabase
      .from("questions")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("test_id", testId);

    if (error) {
      throw new Error(error.message);
    }

    if (!count || count < 1) {
      throw new Error(
        "Testni faollaştirişdan oldin kamida bitta savol qöşing.",
      );
    }
  }

  const { error } = await supabase
    .from("tests")
    .update({ is_published: nextState })
    .eq("id", testId);

  if (error) {
    throw new Error(`Test holati özgarmadi: ${error.message}`);
  }

  revalidatePath("/admin/tests");
  revalidatePath("/admin/tests/manage");
  redirect(`/admin/tests/manage?testId=${testId}`);
}

export async function renumberQuestionNumbers(formData: FormData) {
  const supabase = await getAdminClient();
  const testId = Number(formData.get("testId"));

  validateTestId(testId);
  await renumberTestQuestions(supabase, testId);

  revalidatePath("/admin/tests/manage");
  revalidatePath("/tests");
  revalidatePath("/tests/take");
  redirect(`/admin/tests/manage?testId=${testId}`);
}

export async function deleteStandaloneQuestion(formData: FormData) {
  const supabase = await getAdminClient();

  const testId = Number(formData.get("testId"));
  const questionId = Number(formData.get("questionId"));

  validateTestId(testId);

  if (!Number.isInteger(questionId) || questionId <= 0) {
    throw new Error("Savol ID notöğri.");
  }

  const { data: question, error: lookupError } = await supabase
    .from("questions")
    .select("image_path, block_id")
    .eq("id", questionId)
    .eq("test_id", testId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Savol aniqlanmadi: ${lookupError.message}`);
  }

  if (!question) {
    throw new Error("Savol topilmadi.");
  }

  if (question.block_id !== null) {
    throw new Error("Bu savol blok tarkibida. Blokni töliq öçiring.");
  }

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId)
    .eq("test_id", testId);

  if (error) {
    throw new Error(`Savol öçirilmadi: ${error.message}`);
  }

  await renumberTestQuestions(supabase, testId);
  await removeImage(supabase, question.image_path);

  revalidatePath("/admin/tests/manage");
  revalidatePath("/tests");
  revalidatePath("/tests/take");
  redirect(`/admin/tests/manage?testId=${testId}`);
}

export async function deleteQuestionBlock(formData: FormData) {
  const supabase = await getAdminClient();

  const testId = Number(formData.get("testId"));
  const blockId = Number(formData.get("blockId"));

  validateTestId(testId);

  if (!Number.isInteger(blockId) || blockId <= 0) {
    throw new Error("Savol bloki ID notöğri.");
  }

  const { data: block, error: lookupError } = await supabase
    .from("question_blocks")
    .select("image_path")
    .eq("id", blockId)
    .eq("test_id", testId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Savol bloki aniqlanmadi: ${lookupError.message}`);
  }

  if (!block) {
    throw new Error("Savol bloki topilmadi.");
  }

  const { error } = await supabase
    .from("question_blocks")
    .delete()
    .eq("id", blockId)
    .eq("test_id", testId);

  if (error) {
    throw new Error(`Savol bloki öçirilmadi: ${error.message}`);
  }

  await renumberTestQuestions(supabase, testId);
  await removeImage(supabase, block.image_path);

  revalidatePath("/admin/tests/manage");
  revalidatePath("/tests");
  revalidatePath("/tests/take");
  redirect(`/admin/tests/manage?testId=${testId}`);
}
