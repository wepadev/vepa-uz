/**
 * Ko'p mavzuning `.tex` testlarini bir yo'la bazaga yozish.
 *
 * Admin paneldagi "PDF'dan test yaratish" sahifasi bilan AYNAN bir
 * xil ishlaydi: o'sha `parseTex` / `parseTexAnswers` / `buildTests`,
 * chizmalar o'sha `renderFigure` bilan PNG ga aylanadi, saqlash
 * o'sha `saveParsedTest` bilan. Farqi — 66 ta mavzuni bittalab
 * yuklab o'tirish shart emas.
 *
 * Ishlatish (loyiha ildizidan):
 *
 *   node --experimental-strip-types --conditions=react-server \
 *     scripts/import-tex-mavzular.ts 25 89 --dry-run
 *
 * `--dry-run` — bazaga hech narsa yozilmaydi, chizmalar
 * `--rasmlar <papka>` ga PNG bo'lib tushadi (ko'rib chiqish uchun).
 *
 * Testlar har doim QORALAMA bo'lib tushadi. To'liq yozilgan test
 * tashlab ketiladi, chala qolgani qaytadan yoziladi — qayta ishga
 * tushirish xavfsiz. Bir mavzuni ikki jarayon bir vaqtda yozmasin.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createAdminClient } from "./lib/supabase.mjs";
import { renderFigure } from "../lib/tex-chizma-core.ts";
import { saveParsedTest } from "../lib/save-parsed-test.ts";
import {
  buildTests,
  parseTex,
  parseTexAnswers,
} from "../lib/tex-savollar.ts";
import type { ParsedQuestion } from "../lib/pdf-import.ts";

const QUESTIONS_DIR = "Matematika-savollar-tex-1-89";
const ANSWERS_DIR = "Matematika-javoblar-1-89";

/*
 * 27 va 28-mavzuning javob fayllari nomi almashib qolgan:
 * "27-...-javoblar" ichida 28-mavzu (tengsizliklar, 24 savol)
 * kaliti, "28-..." ichida esa 27-mavzu (matnli masalalar,
 * 21 savol) kaliti turibdi. Savol fayllari va bazadagi mavzular
 * to'g'ri tartibda.
 */
const ANSWER_FILE_OVERRIDE: Record<number, number> = { 27: 28, 28: 27 };

/* Vaqt: har bir savolga 3 daqiqa (20 savol -> 60 daqiqa) */
const MINUTES_PER_QUESTION = 3;

/**
 * Global mavzu raqami -> bo'lim va bo'lim ichidagi tartib.
 * Bazadagi tuzilish: 1-37 "Algebra 1-qism", 38-65 "Algebra 2-qism",
 * 66-89 "Algebra 3-qism".
 */
const SECTIONS = [
  { title: "Algebra 1-qism", from: 1, to: 37 },
  { title: "Algebra 2-qism", from: 38, to: 65 },
  { title: "Algebra 3-qism", from: 66, to: 89 },
];

const args = process.argv.slice(2);
const from = Number(args[0]);
const to = Number(args[1]);
const dryRun = args.includes("--dry-run");
const imagesIndex = args.indexOf("--rasmlar");
const imagesDir = imagesIndex >= 0 ? args[imagesIndex + 1] : null;

if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) {
  console.error("Ishlatish: ... import-tex-mavzular.ts <dan> <gacha> [--dry-run] [--rasmlar papka]");
  process.exit(1);
}

function findFile(dir: string, number: number): string {
  const prefix = `${String(number).padStart(2, "0")}-`;
  const name = readdirSync(dir).find((file) => file.startsWith(prefix));
  if (!name) throw new Error(`${dir} da ${prefix}* fayl topilmadi`);
  return join(dir, name);
}

const supabase = createAdminClient();

const { data: sections, error: sectionsError } = await supabase
  .from("test_sections")
  .select("id, title");

const { data: topics, error: topicsError } = await supabase
  .from("test_topics")
  .select("id, section_id, title, order_number");

if (sectionsError || topicsError || !sections || !topics) {
  console.error("Bo'lim/mavzular o'qilmadi:", sectionsError?.message ?? topicsError?.message);
  process.exit(1);
}

function topicFor(number: number) {
  const range = SECTIONS.find((item) => number >= item.from && number <= item.to);
  if (!range) throw new Error(`${number}-mavzu uchun bo'lim yo'q`);

  const section = sections!.find((item) => item.title === range.title);
  if (!section) throw new Error(`"${range.title}" bo'limi bazada yo'q`);

  const order = number - range.from + 1;
  const matches = topics!.filter(
    (item) => item.section_id === section.id && item.order_number === order,
  );

  if (matches.length !== 1) {
    throw new Error(`${number}-mavzu: "${range.title}" da ${order}-tartibli mavzu ${matches.length} ta`);
  }

  return { topic: matches[0], sectionId: section.id as number };
}

/**
 * Mavzudagi shu nomli testlarni tekshirish: savollari to'liq bo'lsa
 * "full", aks holda chala nusxalar (rasmlari bilan) o'chiriladi.
 */
async function existingTest(
  topicId: number,
  title: string,
  expected: number,
): Promise<"full" | "none"> {
  const { data: rows, error } = await supabase
    .from("tests")
    .select("id")
    .eq("topic_id", topicId)
    .eq("title", title);

  if (error) throw new Error(`${title}: tekshirilmadi: ${error.message}`);

  let full = false;

  for (const row of rows ?? []) {
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("test_id", row.id);

    if (count === expected && !full) {
      full = true;
      continue;
    }

    /* Chala (yoki ortiqcha) nusxa — rasmlari bilan o'chiriladi */
    const folder = `${row.id}/questions`;
    const { data: files } = await supabase.storage.from("question-images").list(folder);
    if (files && files.length > 0) {
      await supabase.storage
        .from("question-images")
        .remove(files.map((file: { name: string }) => `${folder}/${file.name}`));
    }

    await supabase.from("tests").delete().eq("id", row.id).eq("is_published", false);
    console.log(`  ${title}: chala nusxa (${count}/${expected} savol) o'chirildi`);
  }

  return full ? "full" : "none";
}

let createdTests = 0;
let createdQuestions = 0;
let createdImages = 0;
const problems: string[] = [];

for (let number = from; number <= to; number += 1) {
  const { topic, sectionId } = topicFor(number);

  const questionFile = findFile(QUESTIONS_DIR, number);
  const answerFile = findFile(ANSWERS_DIR, ANSWER_FILE_OVERRIDE[number] ?? number);

  const ready = buildTests(
    parseTex(readFileSync(questionFile, "utf8")),
    parseTexAnswers(readFileSync(answerFile, "utf8")),
  );

  const label = `${number}-mavzu -> [${topic.id}] ${topic.title}`;

  if (ready.ready < ready.total || ready.errors.length > 0) {
    problems.push(`${label}: ${ready.ready}/${ready.total} tayyor; ${ready.errors.join("; ")}`);
    console.log(`✗ ${label}: ${ready.ready}/${ready.total} tayyor — tashlab ketildi`);
    continue;
  }

  for (const test of ready.tests) {
    const title = `${number}-mavzu, ${test.number}-test`;

    /*
     * Shu nomli test bazada bormi? Savollari to'liq bo'lsa — tegilmaydi.
     * Chala qolgan bo'lsa (tarmoq uzilib, orqaga qaytarish ham
     * bajarilmay qolgan) — o'chirib, qaytadan yoziladi.
     */
    if (!dryRun) {
      const state = await existingTest(topic.id as number, title, test.questions.length);
      if (state === "full") continue;
    }

    const questions: ParsedQuestion[] = [];

    for (const question of test.questions) {
      let image: string | null = null;

      if (question.figure) {
        try {
          const png = await renderFigure(question.figure);
          image = `data:image/png;base64,${png.toString("base64")}`;
          createdImages += 1;

          if (imagesDir) {
            mkdirSync(imagesDir, { recursive: true });
            writeFileSync(
              join(imagesDir, `${number}-mavzu-${test.number}-test-${question.number}-savol.png`),
              png,
            );
          }
        } catch (error) {
          problems.push(
            `${number}-mavzu ${test.number}-test ${question.number}-savol: çizma çizilmadi (${
              error instanceof Error ? error.message : String(error)
            })`,
          );
        }
      }

      questions.push({
        type: "choice",
        text: question.text,
        options: question.options,
        correct: question.correct,
        solution: null,
        solutionVideo: null,
        image,
      });
    }

    if (dryRun) {
      createdTests += 1;
      createdQuestions += questions.length;
      continue;
    }

    /* Tarmoq uzilsa saveParsedTest o'zi orqaga qaytaradi — 3 marta urinamiz */
    let testId: number | null = null;
    let error: string | null = null;

    for (let attempt = 1; attempt <= 3 && !testId; attempt += 1) {
      if (attempt > 1) await existingTest(topic.id as number, title, questions.length);

      ({ testId, error } = await saveParsedTest(supabase, {
        topicId: topic.id as number,
        sectionId,
        title,
        description: null,
        timeLimitMinutes: questions.length * MINUTES_PER_QUESTION,
        questions,
      }));
    }

    /* Tartib raqami test raqamiga teng bo'lsin (1, 2, 3) */
    if (testId) {
      await supabase.from("tests").update({ order_number: test.number }).eq("id", testId);
    }

    if (error || !testId) {
      problems.push(`${title}: ${error}`);
      console.log(`✗ ${title}: ${error}`);
      continue;
    }

    createdTests += 1;
    createdQuestions += questions.length;
  }

  console.log(`✓ ${label}: ${ready.tests.length} test, ${ready.total} savol`);
}

console.log("");
console.log(
  `${dryRun ? "[SINOV] " : ""}Testlar: ${createdTests}, savollar: ${createdQuestions}, çizmalar: ${createdImages}`,
);

if (problems.length > 0) {
  console.log("\nMuammolar:");
  for (const problem of problems) console.log(" -", problem);
  process.exitCode = 1;
}
