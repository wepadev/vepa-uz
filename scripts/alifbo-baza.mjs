/**
 * Bazadagi matnlarni yangi alifboga o'tkazish: O‘→Ö, G‘→Ğ, Sh→Ş, Ch→Ç.
 *
 * Ishlatish (loyiha papkasidan):
 *   node scripts/alifbo-baza.mjs          — faqat hisobot, bazaga TEGMAYDI
 *   node scripts/alifbo-baza.mjs --yoz    — avval eski qiymatlarni saqlaydi,
 *                                           keyin bazani yangilaydi
 *
 * Natija:
 *   backups/alifbo/<sana>/hisobot.md     — qaysi jadval/ustunda nechta
 *                                          qator o'zgarishi va namunalar
 *   backups/alifbo/<sana>/oldingi.json   — (--yoz) o'zgargan qatorlarning
 *                                          eski qiymatlari, qaytarish uchun
 *
 * Nimalar o'zgarmaydi:
 *   - shaxsiy ma'lumotlar (profiles, ismlar, guruh nomlari, to'lovlar)
 *   - id, code, slug, havola, rasm/video yo'li kabi ustunlar
 *   - LaTeX buyruqlari (\chi, \cosh, \begin{...}), URL'lar
 *   - inglizcha matnlar (SAT savollari) va inglizcha so'zlar
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createAdminClient } from "./lib/supabase.mjs";

const WRITE = process.argv.includes("--yoz");
const PAGE = 1000;

/* Faqat kontent jadvallari. Shaxsiy ma'lumot jadvallari ataylab yo'q. */
const TABLES = [
  "test_exam_types",
  "test_sections",
  "test_topics",
  "tests",
  "question_blocks",
  "questions",
  "topics",
  "exercises",
  "lesson_categories",
  "lessons",
  "textbooks",
  "topic_examples",
  "crm_rewards",
];

const SKIP_COLUMN =
  /^(id|code|slug|key|icon|status|email|answer|correct.*|.*_id|.*_url|.*_path|url|.*image.*|.*video.*|.*_type|type|created_at|updated_at)$/;

const APO = "['‘’ʻʼ`]";
const WORD = new RegExp(`\\\\?[A-Za-z]+(?:${APO}[A-Za-z]+)*`, "g");
const ENGLISH = new Set(
  "brush cache change check checked choice children each school search shadow share shared sheet should shrink switch touch watch which much such each match each teacher chart March".split(
    /\s+/,
  ),
);

function convertWord(w) {
  return w
    .replace(new RegExp(`O${APO}`, "g"), "Ö")
    .replace(new RegExp(`o${APO}`, "g"), "ö")
    .replace(new RegExp(`G${APO}`, "g"), "Ğ")
    .replace(new RegExp(`g${APO}`, "g"), "ğ")
    .replace(/SH|Sh/g, "Ş")
    .replace(/sh/g, "ş")
    .replace(/CH|Ch/g, "Ç")
    .replace(/ch/g, "ç");
}

/** Matn inglizchami? (SAT savollari va h.k.) */
function looksEnglish(text) {
  const hits = text.match(/\b(the|which|what|of|is|are|and|following|value)\b/gi);
  return (hits?.length ?? 0) >= 2;
}

export function convertText(text) {
  if (looksEnglish(text)) return text;

  /*
   * URL, \begin{..} / \end{..} argumentlari va formulalar ($...$,
   * $$...$$, \(...\), \[...\]) vaqtincha yashiriladi. Formulada
   * "CH" — kesma nomi ($CH=2$), uni Ç ga aylantirish formulani buzadi.
   */
  const kept = [];
  const masked = text.replace(
    /\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|https?:\/\/\S+|\\(?:begin|end|label|ref|includegraphics)(?:\[[^\]]*\])?\{[^}]*\}/g,
    (m) => {
      kept.push(m);
      return `\u0000${kept.length - 1}\u0000`;
    },
  );

  const converted = masked.replace(WORD, (w) => {
    if (w.startsWith("\\")) return w; // LaTeX buyrug'i
    if (ENGLISH.has(w.toLowerCase())) return w;
    if (/[a-z][A-Z]/.test(w)) return w; // camelCase
    return convertWord(w);
  });

  return converted.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
}

function convertValue(value) {
  if (typeof value === "string") return convertText(value);
  if (Array.isArray(value)) return value.map(convertValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, convertValue(v)]),
    );
  }
  return value;
}

async function fetchAll(supabase, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

const supabase = createAdminClient();
const day = new Date().toISOString().slice(0, 10);
const dir = join(process.cwd(), "backups", "alifbo", day);
mkdirSync(dir, { recursive: true });

const report = [`# Alifbo hisoboti (${day})`, "", WRITE ? "Rejim: **YOZISH**" : "Rejim: faqat hisobot", ""];
const backup = {};
let totalRows = 0;

for (const table of TABLES) {
  let rows;
  try {
    rows = await fetchAll(supabase, table);
  } catch (error) {
    report.push(`## ${table}`, "", `O'qib bo'lmadi: ${error.message}`, "");
    continue;
  }

  const updates = [];
  const perColumn = {};

  for (const row of rows) {
    const patch = {};
    for (const [column, value] of Object.entries(row)) {
      if (SKIP_COLUMN.test(column) || value == null) continue;
      if (typeof value !== "string" && typeof value !== "object") continue;
      const next = convertValue(value);
      if (JSON.stringify(next) !== JSON.stringify(value)) {
        patch[column] = next;
        perColumn[column] ??= { count: 0, samples: [] };
        perColumn[column].count += 1;
        if (perColumn[column].samples.length < 5) {
          const before = JSON.stringify(value).slice(0, 160);
          const after = JSON.stringify(next).slice(0, 160);
          perColumn[column].samples.push(`- \`${before}\`\n  → \`${after}\``);
        }
      }
    }
    if (Object.keys(patch).length) {
      updates.push({ id: row.id, patch, old: Object.fromEntries(Object.keys(patch).map((c) => [c, row[c]])) });
    }
  }

  report.push(`## ${table}`, "", `Jami ${rows.length} qator, o'zgaradigan: ${updates.length}`, "");
  for (const [column, info] of Object.entries(perColumn)) {
    report.push(`### ${column} — ${info.count} ta`, "", ...info.samples, "");
  }
  totalRows += updates.length;

  if (WRITE && updates.length) {
    backup[table] = updates.map(({ id, old }) => ({ id, ...old }));
    writeFileSync(join(dir, "oldingi.json"), JSON.stringify(backup, null, 2));
    for (const { id, patch } of updates) {
      const { error } = await supabase.from(table).update(patch).eq("id", id);
      if (error) {
        console.error(`${table} #${id}: ${error.message}`);
      }
    }
  }

  console.log(`${table}: ${updates.length} / ${rows.length}`);
}

report.push(`---`, ``, `Jami o'zgaradigan qatorlar: ${totalRows}`);
writeFileSync(join(dir, "hisobot.md"), report.join("\n"));
console.log(`\nHisobot: ${join(dir, "hisobot.md")}`);
if (WRITE) console.log(`Eski qiymatlar: ${join(dir, "oldingi.json")}`);
