import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  matchQuestions,
  normalizeTitle,
  parseSolutionFile,
  testNumberFromTitle,
  type DbQuestion,
  type MatchedQuestion,
  type SolutionFile,
} from "@/lib/yechimlar";

/**
 * Yozma yeçimlar repodagi `content/yechimlar/NN.md` fayllarida
 * turadi. Admin ularni körib çiqib, mavzu böyiça bazaga yozadi
 * (`answer_keys.solution_text`). Öquvçi yeçimni test natijasi
 * sahifasida köradi.
 */
const SOLUTIONS_DIR = path.join(process.cwd(), "content", "yechimlar");

export async function loadSolutionFiles(): Promise<SolutionFile[]> {
  let names: string[] = [];

  try {
    names = await readdir(SOLUTIONS_DIR);
  } catch {
    return [];
  }

  const files = await Promise.all(
    names
      .filter((name) => /^\d+\.md$/.test(name))
      .map(async (name) =>
        parseSolutionFile(await readFile(path.join(SOLUTIONS_DIR, name), "utf8")),
      ),
  );

  return files.filter((file) => file.topic > 0).sort((a, b) => a.topic - b.topic);
}

export async function loadSolutionFile(topic: number) {
  const files = await loadSolutionFiles();

  return files.find((file) => file.topic === topic) ?? null;
}

type SectionRow = { id: number; title: string; order_number: number };
type TopicRow = {
  id: number;
  section_id: number;
  title: string;
  order_number: number;
};

export type TopicMatch = {
  id: number;
  title: string;
  sectionTitle: string;
  /** Sarlavha böyiça topildimi yoki tartib raqami böyiça */
  by: "title" | "order";
};

/**
 * Fayldagi mavzu raqamini bazadagi mavzuga bog'laydi.
 *
 * Avval sarlavha böyiça (alifbo va tinish belgilari farq qilmaydi).
 * Topilmasa — "Algebra" bölimlaridagi mavzular ketma-ketligidagi
 * örni böyiça (1-qism = 1-37, 2-qism = 38-65, 3-qism = 66-89).
 */
export async function matchTopics(
  supabase: SupabaseClient,
  files: SolutionFile[],
): Promise<Map<number, TopicMatch>> {
  const [{ data: sectionsData }, { data: topicsData }] = await Promise.all([
    supabase.from("test_sections").select("id, title, order_number"),
    supabase.from("test_topics").select("id, section_id, title, order_number"),
  ]);

  const sections = (sectionsData ?? []) as SectionRow[];
  const topics = (topicsData ?? []) as TopicRow[];
  const sectionById = new Map(sections.map((section) => [section.id, section]));

  const byTitle = new Map<string, TopicRow[]>();

  for (const topic of topics) {
    const key = normalizeTitle(topic.title.replace(/^\s*\d+\s*[.)-]\s*/, ""));
    byTitle.set(key, [...(byTitle.get(key) ?? []), topic]);
  }

  const algebraOrder = sections
    .filter((section) => /algebra/i.test(section.title))
    .sort((a, b) => a.order_number - b.order_number || a.id - b.id)
    .flatMap((section) =>
      topics
        .filter((topic) => topic.section_id === section.id)
        .sort((a, b) => a.order_number - b.order_number || a.id - b.id),
    );

  const result = new Map<number, TopicMatch>();

  for (const file of files) {
    const candidates = byTitle.get(normalizeTitle(file.title)) ?? [];
    const byOrder = algebraOrder[file.topic - 1];
    let topic: TopicRow | undefined;
    let by: TopicMatch["by"] = "title";

    if (candidates.length === 1) {
      topic = candidates[0];
    } else if (candidates.length > 1) {
      /* Bir xil nomli mavzular (masalan, "Matnli masalalar") — tartib hal qiladi */
      topic = candidates.find((candidate) => candidate.id === byOrder?.id) ?? candidates[0];
    } else if (byOrder) {
      topic = byOrder;
      by = "order";
    }

    if (!topic) continue;

    result.set(file.topic, {
      id: topic.id,
      title: topic.title,
      sectionTitle: sectionById.get(topic.section_id)?.title ?? "",
      by,
    });
  }

  return result;
}

export type TestPreview = {
  testId: number;
  title: string;
  fileTest: number;
  questions: MatchedQuestion[];
  /** Faylda bu test uçun yeçim yöq */
  noFile: boolean;
};

/** Mavzu testlarini bazadan öqib, fayldagi yeçimlar bilan juftlaydi */
export async function previewTopic(
  supabase: SupabaseClient,
  topicId: number,
  file: SolutionFile,
): Promise<TestPreview[]> {
  const { data: testsData, error: testsError } = await supabase
    .from("tests")
    .select("id, title, order_number")
    .eq("topic_id", topicId)
    .order("order_number", { ascending: true })
    .order("id", { ascending: true });

  if (testsError) throw new Error("Mavzu testlari yuklanmadi.");

  const tests = (testsData ?? []) as Array<{
    id: number;
    title: string;
    order_number: number;
  }>;

  if (tests.length === 0) return [];

  const { data: questionsData, error: questionsError } = await supabase
    .from("questions")
    .select("id, test_id, order_number, question_type")
    .in(
      "test_id",
      tests.map((test) => test.id),
    )
    .eq("question_type", "multiple_choice");

  if (questionsError) throw new Error("Savollar yuklanmadi.");

  const questions = (questionsData ?? []) as Array<{
    id: number;
    test_id: number;
    order_number: number;
  }>;

  const keys = new Map<number, { correct_answer: string | null; solution_text: string | null }>();

  /* 1000 qatorlik çegaradan oşmaslik uçun böläklab */
  for (let index = 0; index < questions.length; index += 300) {
    const ids = questions.slice(index, index + 300).map((question) => question.id);
    const { data, error } = await supabase
      .from("answer_keys")
      .select("question_id, correct_answer, solution_text")
      .in("question_id", ids);

    if (error) throw new Error("Töğri javoblar yuklanmadi.");

    for (const row of (data ?? []) as Array<{
      question_id: number;
      correct_answer: string | null;
      solution_text: string | null;
    }>) {
      keys.set(row.question_id, row);
    }
  }

  return tests.map((test, index) => {
    const fileTest = testNumberFromTitle(test.title) ?? index + 1;
    const items = file.tests.get(fileTest);
    const dbQuestions: DbQuestion[] = questions
      .filter((question) => question.test_id === test.id)
      .map((question) => ({
        id: question.id,
        order_number: question.order_number,
        correct_answer: keys.get(question.id)?.correct_answer ?? null,
        solution_text: keys.get(question.id)?.solution_text ?? null,
      }));

    return {
      testId: test.id,
      title: test.title,
      fileTest,
      questions: matchQuestions(dbQuestions, items ?? []),
      noFile: !items,
    };
  });
}

/**
 * Yangi va özgargan yeçimlarni bazaga yozadi. Kalit harfi mos
 * kelmagan savolga tegilmaydi. Qaytaradi: nechta yozildi.
 */
export async function publishTopic(
  supabase: SupabaseClient,
  previews: TestPreview[],
): Promise<number> {
  const rows = previews.flatMap((test) =>
    test.questions
      .filter((question) => question.status === "new" || question.status === "changed")
      .map((question) => ({
        question_id: question.questionId,
        correct_answer: question.dbAnswer!,
        solution_text: question.text,
      })),
  );

  for (let index = 0; index < rows.length; index += 200) {
    const { error } = await supabase
      .from("answer_keys")
      .upsert(rows.slice(index, index + 200), { onConflict: "question_id" });

    if (error) throw new Error(`Yeçimlar yozilmadi: ${error.message}`);
  }

  return rows.length;
}

/** Mavzudagi hamma variantli savol yeçimini öçiradi */
export async function unpublishTopic(
  supabase: SupabaseClient,
  previews: TestPreview[],
): Promise<number> {
  const ids = previews.flatMap((test) =>
    test.questions.map((question) => question.questionId),
  );

  for (let index = 0; index < ids.length; index += 300) {
    const { error } = await supabase
      .from("answer_keys")
      .update({ solution_text: null })
      .in("question_id", ids.slice(index, index + 300));

    if (error) throw new Error(`Yeçimlar öçirilmadi: ${error.message}`);
  }

  return ids.length;
}
