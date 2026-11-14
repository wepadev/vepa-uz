/**
 * Milliy sertifikat original variantlarini "Mock testlar" ga yuklaş.
 *
 * Manba: content/milliy-sertifikat/{savollar,yechimlar} (yangi alifboda).
 * Joyi (db/43): yönaliş `mock-milliy-sertifikat` → bölim
 * "Original savollar" → yil (mavzu) → variant (test).
 *
 * Har variant: 1–32 test, 33–35 moslaştiriş bloki (A–F),
 * 36–45 a/b yozma bloklar. Çizmalar PNG bölib `question-images`
 * bucket'iga tuşadi, yeçimdagi çizmalar ham (`[[rasm:<yöl>]]`).
 *
 * Ishlatish (loyiha ildizidan):
 *
 *   node --experimental-strip-types --conditions=react-server \
 *     scripts/import-milliy-sertifikat.ts --dry-run
 *
 *   ... scripts/import-milliy-sertifikat.ts            # qoralama
 *   ... scripts/import-milliy-sertifikat.ts --nashr    # darrov naşr
 *   ... --faqat 2025-12-27                              # bitta variant
 *
 * Qayta işga tuşiriş xavfsiz: töliq yozilgan variant taşlab
 * ketiladi, çala qolgani öçirilib qaytadan yoziladi.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createAdminClient } from "./lib/supabase.mjs";
import { renderFigure } from "../lib/tex-chizma-core.ts";
import { figureDocument } from "../lib/tex-savollar.ts";
import {
  MS_FIGURE_SETUP,
  parseVariant,
  type MsSolution,
  type MsVariant,
} from "../lib/milliy-sertifikat-tex.ts";

const ROOT = "content/milliy-sertifikat";
const EXAM_CODE = "mock-milliy-sertifikat";
const SECTION_TITLE = "Original savollar";
const BUCKET = "question-images";
const TIME_LIMIT_MINUTES = 150;
/** 1–32: 32, 33–35: 3, 36–45: 10×2 — jami savol qatorlari */
const QUESTION_ROWS = 32 + 3 + 20;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const publish = args.includes("--nashr");
const onlyIndex = args.indexOf("--faqat");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = dryRun ? null : createAdminClient();

function readVariants(): MsVariant[] {
  const files = readdirSync(join(ROOT, "savollar"))
    .filter((name) => /^q_.+\.tex$/.test(name))
    .sort();

  return files
    .map((name) => name.slice(2, -4))
    .filter((key) => !only || key === only)
    .map((key) => {
      const solutionPath = join(ROOT, "yechimlar", `s_${key}.tex`);
      let solution: string | null = null;
      try {
        solution = readFileSync(solutionPath, "utf8");
      } catch {
        solution = null;
      }
      return parseVariant(key, readFileSync(join(ROOT, "savollar", `q_${key}.tex`), "utf8"), solution);
    });
}

async function png(figures: string[]): Promise<Buffer> {
  return renderFigure(figureDocument(figures, { macros: {}, setup: MS_FIGURE_SETUP }));
}

/* ------------------------------------------------------------------ */

async function ensureTopics(sectionId: number, years: number[]) {
  const { data: existing, error } = await supabase
    .from("test_topics")
    .select("id, title")
    .eq("section_id", sectionId);
  if (error) throw new Error(`Yillar öqilmadi: ${error.message}`);

  const byTitle = new Map<string, number>(
    (existing ?? []).map((row: { id: number; title: string }) => [row.title, row.id]),
  );

  for (const year of years) {
    const title = `${year}-yil`;
    if (byTitle.has(title)) continue;
    const { data, error: insertError } = await supabase
      .from("test_topics")
      .insert({
        section_id: sectionId,
        title,
        description: `${year}-yilda bölib ötgan Milliy sertifikat imtihonlari`,
        order_number: year - 2000,
        is_published: true,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(`${title} yaratilmadi: ${insertError.message}`);
    byTitle.set(title, data.id);
  }

  return byTitle;
}

async function upload(testId: number, kind: string, image: Buffer, uploaded: string[]) {
  const path = `${testId}/${kind}/${randomUUID()}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, image, {
    cacheControl: "3600",
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw new Error(`rasm yuklanmadi: ${error.message}`);
  uploaded.push(path);
  return path;
}

async function solutionText(
  testId: number,
  solution: MsSolution | null,
  uploaded: string[],
  notes: string[],
  where: string,
): Promise<string | null> {
  if (!solution) return null;
  let text = solution.text;
  for (const [index, figure] of solution.figures.entries()) {
    let replacement = "";
    try {
      const path = await upload(testId, "yechim", await png([figure]), uploaded);
      replacement = `[[rasm:${path}]]`;
    } catch (error) {
      notes.push(`${where} yeçim çizmasi: ${String(error).slice(0, 120)}`);
    }
    text = text.replace(`[[rasm:${index}]]`, replacement);
  }
  return text.replace(/\n{2,}/g, "\n").trim() || null;
}

async function questionImage(
  testId: number,
  figures: string[],
  uploaded: string[],
  notes: string[],
  where: string,
): Promise<string | null> {
  if (figures.length === 0) return null;
  try {
    return await upload(testId, "questions", await png(figures), uploaded);
  } catch (error) {
    notes.push(`${where} çizmasi: ${String(error).slice(0, 120)}`);
    return null;
  }
}

async function insertKey(
  questionId: number,
  correct: string,
  solution: string | null,
) {
  const { error } = await supabase.from("answer_keys").insert({
    question_id: questionId,
    correct_answer: correct,
    accepted_answers: [],
    solution_text: solution,
    solution_video_url: null,
  });
  if (error) throw new Error(`kalit saqlanmadi: ${error.message}`);
}

async function writeVariant(
  variant: MsVariant,
  sectionId: number,
  topicId: number,
  orderNumber: number,
  notes: string[],
) {
  const { data: test, error: testError } = await supabase
    .from("tests")
    .insert({
      section_id: sectionId,
      topic_id: topicId,
      title: variant.title,
      description:
        "Milliy sertifikat: 45 topşiriq — 1–32 test, 33–35 moslaştiriş, 36–45 a) va b) javobli savollar.",
      time_limit_minutes: TIME_LIMIT_MINUTES,
      order_number: orderNumber,
      is_published: false,
      is_free: false,
    })
    .select("id")
    .single();
  if (testError) throw new Error(`test yaratilmadi: ${testError.message}`);

  const testId = test.id as number;
  const uploaded: string[] = [];

  try {
    for (const item of variant.items) {
      const where = `${variant.title}, ${item.number}`;
      const image = await questionImage(testId, item.figures, uploaded, notes, where);
      const solution = await solutionText(testId, item.solution, uploaded, notes, where);

      if (item.kind === "choice") {
        const { data: row, error } = await supabase
          .from("questions")
          .insert({
            test_id: testId,
            question_text: item.text,
            image_path: image,
            option_a: item.options.a,
            option_b: item.options.b,
            option_c: item.options.c,
            option_d: item.options.d,
            order_number: item.number,
            question_type: "multiple_choice",
            block_id: null,
            part_label: null,
          })
          .select("id")
          .single();
        if (error) throw new Error(`${item.number}-savol: ${error.message}`);
        await insertKey(row.id, item.correct, solution);
        continue;
      }

      const blockType = item.kind === "match" ? "shared_options" : "written_parts";
      const options = item.kind === "match" ? item.options : [];
      const { data: block, error: blockError } = await supabase
        .from("question_blocks")
        .insert({
          test_id: testId,
          block_type: blockType,
          stimulus_text: item.text,
          image_path: image,
          option_a: options[0] ?? null,
          option_b: options[1] ?? null,
          option_c: options[2] ?? null,
          option_d: options[3] ?? null,
          option_e: options[4] ?? null,
          option_f: options[5] ?? null,
          order_number: item.number,
        })
        .select("id")
        .single();
      if (blockError) throw new Error(`${item.number}-blok: ${blockError.message}`);

      const parts =
        item.kind === "match"
          ? item.parts.map((part, index) => ({
              text: part.text,
              label: null,
              type: "multiple_choice",
              correct: part.correct,
              order: index + 1,
            }))
          : item.parts.map((part, index) => ({
              text: part.text,
              label: part.label,
              type: "written",
              correct: part.answer,
              order: index + 1,
            }));

      for (const [index, part] of parts.entries()) {
        const { data: row, error } = await supabase
          .from("questions")
          .insert({
            test_id: testId,
            question_text: part.text,
            image_path: null,
            option_a: null,
            option_b: null,
            option_c: null,
            option_d: null,
            order_number: part.order,
            question_type: part.type,
            block_id: block.id,
            part_label: part.label,
          })
          .select("id")
          .single();
        if (error) throw new Error(`${item.number}-blok qismi: ${error.message}`);
        // Yeçim bloknin birinçi qismida — u hamma qismni tuşuntiradi
        await insertKey(row.id, part.correct, index === 0 ? solution : null);
      }
    }
  } catch (error) {
    await supabase.from("tests").delete().eq("id", testId);
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    throw error;
  }

  if (publish) {
    await supabase.from("tests").update({ is_published: true }).eq("id", testId);
  }

  return testId;
}

/* ------------------------------------------------------------------ */

async function main() {
  const variants = readVariants();
  const broken = variants.filter((variant) => variant.errors.length > 0);
  for (const variant of broken) console.log(`! ${variant.title}: ${variant.errors.join("; ")}`);
  if (broken.length) {
    console.log("Öqişda xato bor — hech narsa yozilmadi.");
    process.exit(1);
  }

  console.log(`${variants.length} ta variant öqildi.`);

  if (dryRun) {
    const out = "tmp/ms-dry-run";
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "variantlar.json"), JSON.stringify(variants, null, 1));
    console.log(`Tuzilma: ${out}/variantlar.json (bazaga heç narsa yozilmadi)`);
    return;
  }

  const { data: exam, error: examError } = await supabase
    .from("test_exam_types")
    .select("id")
    .eq("code", EXAM_CODE)
    .maybeSingle();
  if (examError || !exam) {
    throw new Error(`"${EXAM_CODE}" yönalişi yöq — avval db/43-mock-testlar.sql ni işga tuşiring.`);
  }

  const { data: section, error: sectionError } = await supabase
    .from("test_sections")
    .select("id")
    .eq("exam_type_id", exam.id)
    .eq("title", SECTION_TITLE)
    .maybeSingle();
  if (sectionError || !section) throw new Error(`"${SECTION_TITLE}" bölimi yöq (db/43).`);

  const years = [...new Set(variants.map((variant) => variant.year))].sort();
  const topics = await ensureTopics(section.id, years);

  /* Yil içida sana va smena tartibida */
  const ordered = [...variants].sort((a, b) => a.key.localeCompare(b.key));
  const notes: string[] = [];

  for (const [index, variant] of ordered.entries()) {
    const topicId = topics.get(`${variant.year}-yil`) as number;

    const { data: existing } = await supabase
      .from("tests")
      .select("id, is_published, questions(count)")
      .eq("topic_id", topicId)
      .eq("title", variant.title);

    const complete = (existing ?? []).find(
      (row: { questions: Array<{ count: number }> }) =>
        (row.questions?.[0]?.count ?? 0) === QUESTION_ROWS,
    );

    if (complete) {
      if (publish && !complete.is_published) {
        await supabase.from("tests").update({ is_published: true }).eq("id", complete.id);
        console.log(`= ${variant.title}: bor, naşr qilindi`);
      } else {
        console.log(`= ${variant.title}: bor, taşlab ketildi`);
      }
      continue;
    }

    for (const row of existing ?? []) {
      await supabase.from("tests").delete().eq("id", row.id);
    }

    const started = Date.now();
    const testId = await writeVariant(variant, section.id, topicId, index + 1, notes);
    console.log(
      `+ ${variant.title}: test ${testId} (${Math.round((Date.now() - started) / 1000)} s)`,
    );
  }

  if (notes.length) {
    console.log(`\nEslatmalar (${notes.length}):`);
    for (const note of notes) console.log(`  - ${note}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
