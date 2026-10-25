/*
 * Saytdagi rasmlar qancha og'irlikda -- O'LCHOV.
 *
 * NEGA KERAK.
 * Savol rasmlari, kitob muqovalari va dars rasmlari `<img>` orqali
 * ASL HOLIDA yuklanadi: Next.js ularni kichraytirmaydi ham,
 * WebP ga o'girmaydi ham. Telefondan olingan surat 3 MB bo'lishi
 * mumkin, 20 savolli testda esa bu 60 MB degani.
 *
 * Lekin bu faqat EHTIMOL. Shuning uchun avval o'lchaymiz:
 * haqiqatan og'irmi yoki yo'q.
 *
 * Skript hech narsani o'zgartirmaydi -- faqat o'qiydi.
 *
 * ISHLATISH:
 *   node scripts/rasm-olchov.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SECRET_KEY || "";

if (!BASE || !KEY) {
  console.error("XATO: .env.local da Supabase manzili yoki kaliti yo'q.");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const kb = (n) => (n / 1024).toFixed(0).padStart(6) + " KB";

/** Bitta papkadagi (va ichidagi) fayllarni yig'ish */
async function walk(bucket, prefix = "", depth = 0) {
  if (depth > 4) return [];

  const res = await fetch(`${BASE}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: "name", order: "asc" } }),
  });

  if (!res.ok) return [];

  const rows = await res.json();
  const out = [];

  for (const row of rows) {
    const path = prefix ? `${prefix}/${row.name}` : row.name;

    /* Papkaning o'zida metadata bo'lmaydi */
    if (!row.id && !row.metadata) {
      out.push(...(await walk(bucket, path, depth + 1)));
      continue;
    }

    out.push({
      path,
      size: row.metadata?.size ?? 0,
      type: row.metadata?.mimetype ?? "",
    });
  }

  return out;
}

const buckets = await fetch(`${BASE}/storage/v1/bucket`, { headers }).then((r) =>
  r.ok ? r.json() : [],
);

if (buckets.length === 0) {
  console.log("Saqlash bo'limi (storage) bo'sh yoki ochilmadi.");
  process.exit(0);
}

let jami = 0;
let soni = 0;
const hammasi = [];

for (const bucket of buckets) {
  const files = await walk(bucket.name);
  const rasm = files.filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.path));
  const hajm = rasm.reduce((s, f) => s + f.size, 0);

  jami += hajm;
  soni += rasm.length;
  hammasi.push(...rasm.map((f) => ({ ...f, bucket: bucket.name })));

  console.log(`${bucket.name.padEnd(22)} ${String(rasm.length).padStart(4)} ta rasm, ${kb(hajm)}`);
}

if (soni === 0) {
  console.log("\nRasm topilmadi.");
  process.exit(0);
}

console.log(`\nJAMI: ${soni} ta rasm, ${(jami / 1024 / 1024).toFixed(1)} MB`);
console.log(`O'rtacha: ${kb(jami / soni)}`);

const katta = hammasi.sort((a, b) => b.size - a.size).slice(0, 10);

console.log(`\nEng og'ir 10 tasi:`);
for (const f of katta) {
  console.log(`  ${kb(f.size)}  ${f.bucket}/${f.path.slice(0, 60)}`);
}

const ogir = hammasi.filter((f) => f.size > 300 * 1024);

console.log(
  ogir.length === 0
    ? `\nXulosa: hamma rasm 300 KB dan kichik -- muammo yo'q.`
    : `\nXulosa: ${ogir.length} ta rasm 300 KB dan og'ir ` +
        `(jami ${(ogir.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB). ` +
        `Ularni kichraytirish ma'noga ega.`,
);
