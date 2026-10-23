/*
 * Tayyor qoralama testlarni bazaga yuklash.
 *
 * NEGA SHU SKRIPT BOR.
 * Testni PDF'dan ajratish ishini Claude o'z muhitida bajaradi va
 * natijani `qoralama/` papkasiga JSON qilib qo'yadi. Lekin uning
 * muhiti Supabase'ga ulana olmaydi (tarmoq cheklovi), shuning
 * uchun bazaga yozishni shu skript qiladi. Sizga qoladigan ish —
 * bitta buyruq.
 *
 * ISHLATISH:
 *   node scripts/qoralama-yuklash.mjs --mavzular   mavzular ro'yxati
 *   node scripts/qoralama-yuklash.mjs --quruq      sinab ko'rish (yozmaydi)
 *   node scripts/qoralama-yuklash.mjs              yuklash
 *
 * Testlar HAR DOIM qoralama (nashr qilinmagan) holida yoziladi.
 * Xato chiqsa, yarim yozilgan test o'chiriladi.
 */
import { readFileSync, readdirSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const QORALAMA = join(ROOT, "qoralama");

/* ---------- .env.local ---------- */

function readEnv() {
  const text = readFileSync(join(ROOT, ".env.local"), "utf8").replace(/^﻿/, "");
  const out = {};

  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf("=");
    if (at < 1 || line.trimStart().startsWith("#")) continue;
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^"|"$/g, "");
  }

  return out;
}

const env = readEnv();
const URL_BASE = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SECRET_KEY || "";

if (!URL_BASE || !KEY) {
  console.error("XATO: .env.local da NEXT_PUBLIC_SUPABASE_URL yoki SUPABASE_SECRET_KEY yo'q.");
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: init.prefer ?? "return=representation",
      ...(init.headers || {}),
    },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${res.status} ${path}\n${text.slice(0, 400)}`);
  }

  return text ? JSON.parse(text) : null;
}

/* ---------- mavzular ro'yxati ---------- */

/**
 * Ustun nomini taxmin qilmaymiz.
 *
 * Jadvalda sarlavha ustuni `title` ham, `name` ham bo'lishi
 * mumkin. Shuning uchun `select=*` bilan hamma ustunni olamiz va
 * mavjudlaridan mosini tanlaymiz.
 */
function labelOf(row) {
  for (const key of ["title", "name", "label", "nomi"]) {
    if (typeof row[key] === "string" && row[key].trim()) return row[key];
  }

  return `(nomsiz, id ${row.id})`;
}

async function listTopics() {
  const types = await api("test_exam_types?select=*&order=id");
  const sections = await api("test_sections?select=*");
  const topics = await api("test_topics?select=*");

  const lines = [];

  lines.push(`Ustunlar: test_exam_types [${Object.keys(types[0] ?? {}).join(", ")}]`);
  lines.push(`          test_sections   [${Object.keys(sections[0] ?? {}).join(", ")}]`);
  lines.push(`          test_topics     [${Object.keys(topics[0] ?? {}).join(", ")}]`);

  const byOrder = (a, b) => (a.order_number ?? 0) - (b.order_number ?? 0);

  for (const type of types) {
    lines.push(`\n=== yo'nalish ${type.id}: ${labelOf(type)}`);

    for (const section of sections.filter((s) => s.exam_type_id === type.id).sort(byOrder)) {
      const draft = section.is_published === false ? " (qoralama)" : "";
      lines.push(`  -- bo'lim ${section.id}: ${labelOf(section)}${draft}`);

      for (const topic of topics.filter((t) => t.section_id === section.id).sort(byOrder)) {
        const mark = topic.is_published === false ? " (qoralama)" : "";
        lines.push(`     MAVZU ${topic.id}: ${labelOf(topic)}${mark}`);
      }
    }
  }

  const known = new Set(sections.map((s) => s.id));
  const orphan = topics.filter((t) => !known.has(t.section_id));

  if (orphan.length > 0) {
    lines.push("\n=== bo'limi topilmagan mavzular");
    for (const topic of orphan) lines.push(`     MAVZU ${topic.id}: ${labelOf(topic)}`);
  }

  const text = lines.join("\n").trim() + "\n";
  console.log(text);

  mkdirSync(QORALAMA, { recursive: true });
  writeFileSync(join(QORALAMA, "mavzular.txt"), text, "utf8");
  console.log(`\nRo'yxat shu faylga ham yozildi: qoralama/mavzular.txt`);
}


/* ---------- bitta faylni yuklash ---------- */

async function loadOne(file, dry) {
  const data = JSON.parse(readFileSync(join(QORALAMA, file), "utf8"));
  const label = data.manba || file;

  let topicId = data.topicId ?? null;

  if (!topicId && data.topicTitle) {
    /*
     * Aniq nom bo'yicha topilmasa, ichida shu so'zlar bor mavzuni
     * qidiramiz — papka nomi bilan bazadagi nom har doim ham bir
     * xil bo'lavermaydi.
     */
    const all = await api("test_topics?select=*");
    const want = data.topicTitle.toLowerCase().replace(/\s+/g, " ").trim();

    const exact = all.filter((row) => labelOf(row).toLowerCase().trim() === want);
    const loose = all.filter((row) => {
      const have = labelOf(row).toLowerCase().trim();
      return have.length > 3 && (have.includes(want) || want.includes(have));
    });

    const found = exact.length > 0 ? exact : loose;

    if (found.length === 1) {
      topicId = found[0].id;
      console.log(`  (mavzu nomi bo'yicha topildi: ${found[0].id} \u2014 ${labelOf(found[0])})`);
    } else if (found.length > 1) {
      throw new Error(
        `"${data.topicTitle}" ga bir nechta mavzu mos keldi: ` +
          found.map((row) => `${row.id} (${labelOf(row)})`).join(", "),
      );
    } else {
      throw new Error(
        `"${data.topicTitle}" nomli mavzu topilmadi \u2014 ` +
          `"node scripts/qoralama-yuklash.mjs --mavzular" ni ishga tushiring`,
      );
    }
  }

  if (!topicId) throw new Error("topicId ham, topicTitle ham yo'q");

  const topic = await api(`test_topics?select=*&id=eq.${topicId}`);
  if (topic.length === 0) throw new Error(`mavzu ${topicId} topilmadi`);

  const sectionId = topic[0].section_id;

  const existing = await api(`tests?select=id,title&topic_id=eq.${topicId}`);
  const last = await api(`tests?select=order_number&topic_id=eq.${topicId}&order=order_number.desc&limit=1`);
  let order = (last[0]?.order_number ?? 0);

  console.log(`\n${label}`);
  console.log(`  mavzu ${topicId}: ${labelOf(topic[0])} (bo'lim ${sectionId})`);

  for (const test of data.tests) {
    if (existing.some((row) => row.title === test.title)) {
      console.log(`  - ${test.title}: SHUNDAY NOMLI TEST BOR, o'tkazib yuborildi`);
      continue;
    }

    const flagged = (test.notes || []).length;
    console.log(`  - ${test.title}: ${test.questions.length} ta savol${flagged ? `, ${flagged} ta eslatma` : ""}${dry ? " (sinov)" : ""}`);

    for (const note of test.notes || []) console.log(`      ! ${note}`);

    if (dry) continue;

    order += 1;

    const created = await api("tests", {
      method: "POST",
      body: JSON.stringify({
        section_id: sectionId,
        topic_id: topicId,
        title: test.title,
        description: test.description ?? null,
        time_limit_minutes: data.minutes ?? 30,
        order_number: order,
        is_published: false,
        is_free: false,
      }),
    });

    const testId = created[0].id;

    try {
      let number = 0;

      for (const question of test.questions) {
        number += 1;

        const rows = await api("questions", {
          method: "POST",
          body: JSON.stringify({
            test_id: testId,
            question_text: question.text,
            option_a: question.options.a,
            option_b: question.options.b,
            option_c: question.options.c,
            option_d: question.options.d,
            order_number: number,
            question_type: "multiple_choice",
          }),
        });

        await api("answer_keys", {
          method: "POST",
          prefer: "return=minimal",
          body: JSON.stringify({
            question_id: rows[0].id,
            correct_answer: question.correct,
            accepted_answers: [],
            solution_text: question.solution ?? null,
            solution_video_url: question.solutionVideo ?? null,
          }),
        });
      }

      console.log(`      saqlandi (test id ${testId})`);
    } catch (error) {
      /* Yarim test qolmasin */
      await api(`tests?id=eq.${testId}`, { method: "DELETE", prefer: "return=minimal" });
      throw new Error(`${test.title} saqlanmadi, o'chirildi: ${error.message}`);
    }
  }
}

/* ---------- boshlanish ---------- */

const args = process.argv.slice(2);

if (args.includes("--mavzular")) {
  await listTopics();
  process.exit(0);
}

const dry = args.includes("--quruq");

if (!existsSync(QORALAMA)) {
  console.log("qoralama/ papkasi yo'q — yuklanadigan narsa topilmadi.");
  process.exit(0);
}

const files = readdirSync(QORALAMA).filter((f) => f.endsWith(".json"));

if (files.length === 0) {
  console.log("qoralama/ ichida .json fayl yo'q.");
  process.exit(0);
}

console.log(`${files.length} ta fayl topildi${dry ? " (sinov rejimi — bazaga yozilmaydi)" : ""}.`);

let ok = 0;
const failed = [];

for (const file of files) {
  try {
    await loadOne(file, dry);
    ok += 1;

    if (!dry) {
      mkdirSync(join(QORALAMA, "yuklangan"), { recursive: true });
      renameSync(join(QORALAMA, file), join(QORALAMA, "yuklangan", file));
    }
  } catch (error) {
    failed.push(`${file}: ${error.message}`);
    console.error(`  XATO ${file}: ${error.message}`);
  }
}

console.log(`\nTayyor: ${ok} ta fayl${failed.length ? `, ${failed.length} tasida xato` : ""}.`);
if (!dry && ok > 0) console.log("Yuklanganlari qoralama/yuklangan/ ga ko'chirildi.");
