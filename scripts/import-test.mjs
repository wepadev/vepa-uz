/**
 * JSON fayldan saytga test yaratadi.
 *
 * Ishlatish:
 *   node scripts/import-test.mjs tests-data/attestatsiya-1.json --dry-run
 *   node scripts/import-test.mjs tests-data/attestatsiya-1.json
 *
 * Bayroqlar:
 *   --dry-run   bazaga yozmaydi, faqat tekshiradi va nima bo'lishini ko'rsatadi
 *   --publish   testni darrov nashr qiladi (default: yopiq)
 *
 * Test yopiq holda yaratiladi — admin panelda ko'rib chiqib,
 * o'zingiz nashr qilasiz.
 */
import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";

import { createAdminClient } from "./lib/supabase.mjs";

const QUESTION_IMAGE_BUCKET = "question-images";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const publish = args.includes("--publish");
const jsonPath = args.find((a) => !a.startsWith("--"));

if (!jsonPath) {
  console.error("Fayl ko'rsatilmadi.\n");
  console.error("  node scripts/import-test.mjs <fayl.json> [--dry-run] [--publish]");
  process.exit(1);
}

const jsonFullPath = resolve(process.cwd(), jsonPath);
const jsonDir = dirname(jsonFullPath);

let data;

try {
  data = JSON.parse(readFileSync(jsonFullPath, "utf8"));
} catch (error) {
  console.error(`JSON o'qilmadi: ${error.message}`);
  process.exit(1);
}

/* ---------- Validatsiya ---------- */

const errors = [];
const warnings = [];

function req(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") {
    errors.push(`${label} to'ldirilmagan`);
    return false;
  }
  return true;
}

req(data.title, "title");

/*
 * Bo'limni ikki xil ko'rsatish mumkin:
 *   1) "sectionId": 12                        — mavjud bo'limga
 *   2) "examCode" + "sectionTitle"            — bo'lim topiladi, yo'q bo'lsa yaratiladi
 */
const useLookup = Boolean(data.examCode || data.sectionTitle);

if (!useLookup && data.sectionId === undefined) {
  errors.push(
    "sectionId yoki (examCode + sectionTitle) ko'rsatilishi kerak",
  );
}

if (useLookup) {
  req(data.examCode, "examCode");
  req(data.sectionTitle, "sectionTitle");
}

if (data.sectionId !== undefined && !Number.isInteger(data.sectionId)) {
  errors.push("sectionId butun son bo'lishi kerak");
}

const timeLimit = Number(data.timeLimitMinutes ?? 60);

if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
  errors.push("timeLimitMinutes musbat son bo'lishi kerak");
}

if (!Array.isArray(data.questions) || data.questions.length === 0) {
  errors.push("questions ro'yxati bo'sh");
}

const imagesToUpload = [];

(data.questions ?? []).forEach((q, i) => {
  const n = i + 1;
  const type = q.type ?? "choice";

  if (!["choice", "written"].includes(type)) {
    errors.push(`${n}-savol: type "choice" yoki "written" bo'lishi kerak`);
    return;
  }

  if (type === "choice") {
    req(q.text, `${n}-savol matni`);

    for (const letter of ["a", "b", "c", "d"]) {
      req(q.options?.[letter], `${n}-savol: ${letter.toUpperCase()} varianti`);
    }

    const correct = String(q.correct ?? "").toUpperCase();

    if (!["A", "B", "C", "D"].includes(correct)) {
      errors.push(`${n}-savol: correct A, B, C yoki D bo'lishi kerak (hozir: "${q.correct}")`);
    }
  }

  if (type === "written") {
    if (!Array.isArray(q.parts) || q.parts.length === 0) {
      errors.push(`${n}-savol: yozma savolda parts ro'yxati bo'lishi kerak`);
    } else {
      q.parts.forEach((part, pi) => {
        req(part.label, `${n}-savol, ${pi + 1}-qism: label`);
        req(part.text, `${n}-savol, ${pi + 1}-qism: matn`);
        req(part.answer, `${n}-savol, ${pi + 1}-qism: answer`);
      });
    }
  }

  if (q.image) {
    const imgPath = resolve(jsonDir, q.image);

    if (!existsSync(imgPath)) {
      errors.push(`${n}-savol: rasm topilmadi — ${q.image}`);
    } else {
      imagesToUpload.push({ index: i, path: imgPath });
    }
  }

  if (!q.solution) {
    warnings.push(`${n}-savol: yechim matni yo'q`);
  }
});

if (errors.length > 0) {
  console.error(`\n\x1b[31m${errors.length} ta xato topildi:\x1b[0m\n`);
  errors.forEach((e) => console.error(`  • ${e}`));
  console.error("\nTuzatib qayta urinib ko'ring.\n");
  process.exit(1);
}

/* ---------- Xulosa ---------- */

const choiceCount = (data.questions ?? []).filter(
  (q) => (q.type ?? "choice") === "choice",
).length;

const writtenCount = (data.questions ?? []).filter(
  (q) => q.type === "written",
).length;

console.log("");
console.log(`  Test:        ${data.title}`);
console.log(
  `  Bo'lim:      ${
    useLookup
      ? `${data.sectionTitle}  (${data.examCode})`
      : `ID ${data.sectionId}`
  }`,
);
console.log(`  Vaqt:        ${timeLimit} daqiqa`);
console.log(`  Savollar:    ${data.questions.length} ta (${choiceCount} variantli, ${writtenCount} yozma)`);
console.log(`  Rasmlar:     ${imagesToUpload.length} ta`);
console.log(`  Holati:      ${publish ? "nashr qilinadi" : "yopiq (keyin o'zingiz nashr qilasiz)"}`);

if (warnings.length > 0) {
  console.log(`\n  \x1b[33mOgohlantirish (${warnings.length}):\x1b[0m`);
  warnings.slice(0, 8).forEach((w) => console.log(`    • ${w}`));
  if (warnings.length > 8) {
    console.log(`    … va yana ${warnings.length - 8} ta`);
  }
}

if (dryRun) {
  console.log("\n\x1b[32mTekshiruv muvaffaqiyatli. Bazaga hech narsa yozilmadi (--dry-run).\x1b[0m\n");
  process.exit(0);
}

/* ---------- Bazaga yozish ---------- */

const supabase = createAdminClient();

/** Bo'limni topadi, yo'q bo'lsa yaratadi */
async function resolveSection() {
  if (!useLookup) {
    const { data: found, error } = await supabase
      .from("test_sections")
      .select("id, title")
      .eq("id", data.sectionId)
      .maybeSingle();

    if (error) {
      console.error(`Bo'lim tekshirilmadi: ${error.message}`);
      process.exit(1);
    }

    if (!found) {
      console.error(
        `\nsectionId ${data.sectionId} topilmadi.\n` +
          `Mavjud bo'limlarni ko'rish: node scripts/list-sections.mjs\n`,
      );
      process.exit(1);
    }

    return found;
  }

  const { data: exam, error: examError } = await supabase
    .from("test_exam_types")
    .select("id, title")
    .eq("code", data.examCode)
    .maybeSingle();

  if (examError || !exam) {
    console.error(
      `\n"${data.examCode}" yo'nalishi topilmadi.\n` +
        `Mavjudlari: node scripts/list-sections.mjs\n`,
    );
    process.exit(1);
  }

  const { data: existing, error: findError } = await supabase
    .from("test_sections")
    .select("id, title")
    .eq("exam_type_id", exam.id)
    .eq("title", data.sectionTitle)
    .maybeSingle();

  if (findError) {
    console.error(`Bo'lim qidirilmadi: ${findError.message}`);
    process.exit(1);
  }

  if (existing) {
    console.log(`  Bo'lim mavjud ekan (id: ${existing.id}), o'shanga qo'shiladi.`);
    return existing;
  }

  const { data: lastSection } = await supabase
    .from("test_sections")
    .select("order_number")
    .eq("exam_type_id", exam.id)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error: createError } = await supabase
    .from("test_sections")
    .insert({
      exam_type_id: exam.id,
      title: data.sectionTitle,
      description: data.sectionDescription || null,
      order_number: (lastSection?.order_number ?? 0) + 1,
      is_published: true,
    })
    .select("id, title")
    .single();

  if (createError || !created) {
    console.error(`Bo'lim yaratilmadi: ${createError?.message}`);
    process.exit(1);
  }

  console.log(`  Yangi bo'lim yaratildi (id: ${created.id}) — ${exam.title}`);

  return created;
}

const section = await resolveSection();

// Tartib raqami
const { data: lastTest } = await supabase
  .from("tests")
  .select("order_number")
  .eq("section_id", section.id)
  .order("order_number", { ascending: false })
  .limit(1)
  .maybeSingle();

const orderNumber = (lastTest?.order_number ?? 0) + 1;

const { data: test, error: testError } = await supabase
  .from("tests")
  .insert({
    section_id: section.id,
    title: data.title,
    description: data.description || null,
    time_limit_minutes: timeLimit,
    order_number: orderNumber,
    is_published: publish,
    is_free: Boolean(data.isFree),
  })
  .select("id")
  .single();

if (testError || !test) {
  console.error(`Test yaratilmadi: ${testError?.message}`);
  process.exit(1);
}

console.log(`\n  Test yaratildi (id: ${test.id}). Savollar qo'shilmoqda…`);

// Xato bo'lsa hammasini orqaga qaytarish uchun
async function rollback(reason) {
  console.error(`\n\x1b[31m${reason}\x1b[0m`);
  console.error("  Yaratilgan test o'chirilmoqda…");
  await supabase.from("tests").delete().eq("id", test.id);
  console.error("  Orqaga qaytarildi. Bazada o'zgarish qolmadi.\n");
  process.exit(1);
}

async function uploadImage(localPath, testId, index) {
  const ext = extname(localPath).toLowerCase() || ".png";
  const key = `${testId}/questions/${Date.now()}-${index}${ext}`;
  const file = readFileSync(localPath);

  const contentType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";

  const { error } = await supabase.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(key, file, { contentType, upsert: false });

  if (error) {
    throw new Error(`Rasm yuklanmadi (${basename(localPath)}): ${error.message}`);
  }

  return key;
}

let displayNumber = 0;

for (const [i, q] of data.questions.entries()) {
  const type = q.type ?? "choice";
  displayNumber += 1;

  let imagePath = null;

  if (q.image) {
    try {
      imagePath = await uploadImage(resolve(jsonDir, q.image), test.id, i);
    } catch (error) {
      await rollback(error.message);
    }
  }

  if (type === "choice") {
    const { data: question, error: qError } = await supabase
      .from("questions")
      .insert({
        test_id: test.id,
        question_text: q.text,
        image_path: imagePath,
        option_a: q.options.a,
        option_b: q.options.b,
        option_c: q.options.c,
        option_d: q.options.d,
        order_number: displayNumber,
        question_type: "multiple_choice",
        block_id: null,
        part_label: null,
      })
      .select("id")
      .single();

    if (qError || !question) {
      await rollback(`${i + 1}-savol saqlanmadi: ${qError?.message}`);
    }

    const { error: aError } = await supabase.from("answer_keys").insert({
      question_id: question.id,
      correct_answer: String(q.correct).toUpperCase(),
      accepted_answers: [],
      solution_text: q.solution || null,
      solution_video_url: q.solutionVideo || null,
    });

    if (aError) {
      await rollback(`${i + 1}-savol javobi saqlanmadi: ${aError.message}`);
    }
  } else {
    const { data: block, error: bError } = await supabase
      .from("question_blocks")
      .insert({
        test_id: test.id,
        block_type: "written_parts",
        stimulus_text: q.text || null,
        image_path: imagePath,
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

    if (bError || !block) {
      await rollback(`${i + 1}-savol bloki saqlanmadi: ${bError?.message}`);
    }

    const rows = q.parts.map((part, pi) => ({
      test_id: test.id,
      question_text: part.text,
      image_path: null,
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      order_number: pi + 1,
      question_type: "written",
      block_id: block.id,
      part_label: String(part.label),
    }));

    const { data: created, error: qError } = await supabase
      .from("questions")
      .insert(rows)
      .select("id, part_label");

    if (qError || !created) {
      await rollback(`${i + 1}-savol qismlari saqlanmadi: ${qError?.message}`);
    }

    const answerRows = q.parts.map((part) => {
      const match = created.find(
        (c) => c.part_label === String(part.label),
      );

      const accepted = Array.isArray(part.accepted)
        ? [...new Set([String(part.answer), ...part.accepted.map(String)])]
        : [String(part.answer)];

      return {
        question_id: match.id,
        correct_answer: String(part.answer),
        accepted_answers: accepted,
        solution_text: part.solution || null,
        solution_video_url: part.solutionVideo || null,
      };
    });

    const { error: aError } = await supabase
      .from("answer_keys")
      .insert(answerRows);

    if (aError) {
      await rollback(`${i + 1}-savol javoblari saqlanmadi: ${aError.message}`);
    }
  }

  process.stdout.write(`\r  ${displayNumber}/${data.questions.length} savol qo'shildi`);
}

console.log("\n");
console.log(`\x1b[32m  Tayyor.\x1b[0m Test "${data.title}" → "${section.title}" bo'limiga qo'shildi.`);
console.log(`  Test ID: ${test.id}`);

if (!publish) {
  console.log(`\n  Test hozircha \x1b[33myopiq\x1b[0m. Admin panelda ko'rib chiqib nashr qiling:`);
  console.log(`  /admin/tests/manage?testId=${test.id}\n`);
} else {
  console.log("");
}
