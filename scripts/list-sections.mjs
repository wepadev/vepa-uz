/**
 * Mavjud yo'nalish va bo'limlarni ID bilan chiqaradi.
 *
 * Ishlatish:
 *   node scripts/list-sections.mjs
 *
 * Chiqqan sectionId ni test JSON faylida ishlatasiz.
 */
import { createAdminClient } from "./lib/supabase.mjs";

const supabase = createAdminClient();

const [examTypes, sections, tests] = await Promise.all([
  supabase
    .from("test_exam_types")
    .select("id, code, title, order_number")
    .order("order_number", { ascending: true }),

  supabase
    .from("test_sections")
    .select("id, exam_type_id, title, order_number, is_published")
    .order("order_number", { ascending: true }),

  supabase
    .from("tests")
    .select("id, section_id, title, is_published")
    .order("order_number", { ascending: true }),
]);

for (const result of [examTypes, sections, tests]) {
  if (result.error) {
    console.error("Xato:", result.error.message);
    process.exit(1);
  }
}

const sectionsByExam = new Map();

for (const section of sections.data ?? []) {
  const list = sectionsByExam.get(section.exam_type_id) ?? [];
  list.push(section);
  sectionsByExam.set(section.exam_type_id, list);
}

const testsBySection = new Map();

for (const test of tests.data ?? []) {
  const list = testsBySection.get(test.section_id) ?? [];
  list.push(test);
  testsBySection.set(test.section_id, list);
}

console.log("");

for (const exam of examTypes.data ?? []) {
  console.log(`\x1b[1m${exam.title}\x1b[0m  (code: ${exam.code})`);

  const examSections = sectionsByExam.get(exam.id) ?? [];

  if (examSections.length === 0) {
    console.log("   — bo'lim yo'q");
  }

  for (const section of examSections) {
    const flag = section.is_published ? "" : "  [nashr qilinmagan]";
    console.log(
      `   \x1b[36msectionId: ${section.id}\x1b[0m  ${section.title}${flag}`,
    );

    for (const test of testsBySection.get(section.id) ?? []) {
      const testFlag = test.is_published ? "" : " [yopiq]";
      console.log(`        testId ${test.id}: ${test.title}${testFlag}`);
    }
  }

  console.log("");
}
