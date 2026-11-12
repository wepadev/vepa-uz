/**
 * Bazadagi savol matnlarini tuzatiş (2026-11-12).
 *
 * Nima uçun: .tex import formula muhitlari (`cases`, `aligned`,
 * `gathered`, `array`) içidagi `\\` qator bölinişini öçirib yuborardi —
 * sistema va ikki tarmoqli funksiyalar bitta qatorga yopişib qolgan.
 * Yana: 6-mavzu 4-savol (3 test) va 64-mavzu 2-test 15-savol matni
 * aniq qilindi. Töğri matnlar `scripts/data/savol-matn-tuzatish.json`
 * da (eski -> yangi).
 *
 * Xavfsizlik: savol faqat bazadagi matni eski matnga AYNAN teng bölsa
 * yangilanadi. Qöl bilan özgartirilgan savolga tegilmaydi.
 *
 * Işlatiş (loyiha papkasidan):
 *   node scripts/savol-matn-tuzatish.mjs        — faqat hisobot
 *   node scripts/savol-matn-tuzatish.mjs --yoz  — eski qiymatlarni
 *       backups/savol-matn/<sana>.json ga saqlaydi, keyin yangilaydi
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createAdminClient } from "./lib/supabase.mjs";

const WRITE = process.argv.includes("--yoz");
const updates = JSON.parse(
  readFileSync(join(process.cwd(), "scripts/data/savol-matn-tuzatish.json"), "utf8"),
);

const supabase = createAdminClient();
const plan = [];
const missing = [];

for (const item of updates) {
  const label = `${item.topic}-mavzu ${item.test}-test ${item.number}-savol`;
  const text = item.fields.question_text?.[0];
  /* Savolni eski matni bö'yiça topamiz; matn özgarmagan bölsa — joriy matni bö'yiça */
  const lookup = text ?? null;
  let rows = [];

  if (lookup) {
    const { data, error } = await supabase
      .from("questions")
      .select("id, test_id, question_text, option_a, option_b, option_c, option_d")
      .eq("question_text", lookup);

    if (error) throw new Error(`${label}: ${error.message}`);
    rows = data ?? [];
  } else {
    const option = Object.entries(item.fields)[0];
    const { data, error } = await supabase
      .from("questions")
      .select("id, test_id, question_text, option_a, option_b, option_c, option_d")
      .eq(option[0], option[1][0]);

    if (error) throw new Error(`${label}: ${error.message}`);
    rows = data ?? [];
  }

  if (rows.length === 0) {
    missing.push(label);
    continue;
  }

  for (const row of rows) {
    const change = {};

    for (const [column, [oldValue, newValue]] of Object.entries(item.fields)) {
      if (row[column] === oldValue) change[column] = newValue;
    }

    if (Object.keys(change).length > 0) plan.push({ label, row, change });
  }
}

console.log(`Tuzatiladigan savollar: ${plan.length}`);
console.log(`Bazada eski körinişda topilmadi (allaqaçon tuzatilgan yoki qöl bilan özgargan): ${missing.length}`);
for (const label of missing) console.log(`  - ${label}`);

if (!WRITE) {
  console.log("\nBu faqat hisobot. Yoziş uçun: node scripts/savol-matn-tuzatish.mjs --yoz");
  process.exit(0);
}

const dir = join(process.cwd(), "backups", "savol-matn");
mkdirSync(dir, { recursive: true });
const backup = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(backup, JSON.stringify(plan.map(({ row }) => row), null, 1));
console.log(`Eski qiymatlar saqlandi: ${backup}`);

let done = 0;

for (const { label, row, change } of plan) {
  const { error } = await supabase.from("questions").update(change).eq("id", row.id);

  if (error) {
    console.error(`${label} (id ${row.id}): ${error.message}`);
    continue;
  }

  done += 1;
}

console.log(`Yangilandi: ${done} / ${plan.length}`);
