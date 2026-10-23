/**
 * Ma'lumotlar bazasini zaxiralash.
 *
 * Nima uchun kerak: o'quvchilar natijalari, testlar, savollar va
 * javob kalitlari bitta joyda — Supabase'da. Tasodifiy o'chirish,
 * noto'g'ri SQL yoki akkaunt muammosi bo'lsa, ularni qaytarib
 * bo'lmaydi. Bu skript hammasini kompyuteringizga JSON qilib yozadi.
 *
 * Ishlatish (loyiha papkasidan):
 *   node scripts/backup-db.mjs
 *
 * Natija:
 *   backups/db/2026-08-18/
 *     profiles.json
 *     tests.json
 *     ...
 *     _hisobot.json     — nechta qator saqlangani
 *
 * Diqqat: fayllarda o'quvchilarning ismlari va natijalari bo'ladi.
 * Ularni ochiq joyga (masalan GitHub'ga) yuklamang.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createAdminClient } from "./lib/supabase.mjs";

/*
 * Zaxiralanadigan jadvallar.
 *
 * Tartib muhim emas — bu nusxa, tiklash uchun emas. Tiklash kerak
 * bo'lsa, bog'liqlik tartibida qo'lda yuklanadi: avval profiles,
 * keyin tests → questions → answer_keys, so'ng attempts.
 */
const TABLES = [
  "profiles",
  "test_exam_types",
  "test_sections",
  "tests",
  "question_blocks",
  "questions",
  "answer_keys",
  "attempts",
  "user_answers",
  "test_sessions",
  "study_groups",
  "study_group_members",
  "assignments",
  "textbooks",
  "topics",
  "exercises",
  "lesson_categories",
  "lessons",
];

const PAGE = 1000;

const supabase = createAdminClient();

const day = new Date().toISOString().slice(0, 10);
const dir = join(process.cwd(), "backups", "db", day);

mkdirSync(dir, { recursive: true });

console.log(`\n  Zaxira: ${dir}\n`);

const report = {
  yaratilgan: new Date().toISOString(),
  jadvallar: {},
  xatolar: {},
};

for (const table of TABLES) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);

    if (error) {
      // Jadval yo'q bo'lsa ham to'xtamaymiz — qolganini saqlaymiz
      report.xatolar[table] = error.message;
      console.log(`  \x1b[33m—\x1b[0m ${table.padEnd(22)} ${error.message}`);
      break;
    }

    rows.push(...data);

    if (data.length < PAGE) {
      break;
    }

    from += PAGE;
  }

  if (report.xatolar[table]) {
    continue;
  }

  writeFileSync(
    join(dir, `${table}.json`),
    JSON.stringify(rows, null, 2),
  );

  report.jadvallar[table] = rows.length;
  console.log(`  \x1b[32m✓\x1b[0m ${table.padEnd(22)} ${rows.length} qator`);
}

writeFileSync(
  join(dir, "_hisobot.json"),
  JSON.stringify(report, null, 2),
);

const jami = Object.values(report.jadvallar).reduce((a, b) => a + b, 0);
const xatoSoni = Object.keys(report.xatolar).length;

console.log(`\n  Jami ${jami} qator saqlandi.`);

if (xatoSoni > 0) {
  console.log(
    `  ${xatoSoni} ta jadval o'tkazib yuborildi (yuqorida sariq bilan).`,
  );
}

console.log("");
