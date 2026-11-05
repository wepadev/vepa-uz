/*
 * Baza kod bilan mos keladimi -- TEKSHIRUV.
 *
 * NEGA KERAK.
 * `db/NN-*.sql` migratsiyalari Supabase'da QO'LDA ishga
 * tushiriladi. Kod deploy bo'ladi, migratsiya esa esdan chiqadi --
 * natijada kod bir narsani kutadi, baza boshqacha. Buning oqibati
 * darhol ko'rinmaydi: sahifa ochiladi, lekin bo'lim bo'sh chiqadi
 * yoki tugma ishlamaydi.
 *
 * Bu skript hech narsani o'zgartirmaydi -- faqat o'qiydi va
 * nimasi yetishmayotganini aytadi.
 *
 * ISHLATISH:
 *   node scripts/baza-holati.mjs
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
  console.error("XATO: .env.local da NEXT_PUBLIC_SUPABASE_URL yoki SUPABASE_SECRET_KEY yo'q.");
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** Jadval bormi */
async function jadval(name) {
  const res = await fetch(`${BASE}/rest/v1/${name}?select=*&limit=1`, { headers });
  return { ok: res.ok, status: res.status };
}

/** Jadvalda shu ustun bormi */
async function ustun(table, column) {
  const res = await fetch(`${BASE}/rest/v1/${table}?select=${column}&limit=1`, { headers });

  if (res.ok) return { ok: true };

  const text = await res.text();
  /* 42703 = "column does not exist" */
  return { ok: false, yoq: text.includes("42703") || text.includes("does not exist") };
}

const tekshiruvlar = [
  {
    nom: "test_topics jadvali",
    migratsiya: "db/34-test-mavzulari.sql",
    nega: "mavzu qatlami -- busiz testlar katalogi ishlamaydi",
    ish: () => jadval("test_topics"),
  },
  {
    nom: "tests.topic_id ustuni",
    migratsiya: "db/34-test-mavzulari.sql",
    nega: "test qaysi mavzuga tegishli ekani",
    ish: () => ustun("tests", "topic_id"),
  },
  {
    nom: "test_topics.is_free ustuni",
    migratsiya: "db/35-mavzu-bepul.sql",
    nega: "mavzuni qo'lda bepul qilish",
    ish: () => ustun("test_topics", "is_free"),
  },
  {
    nom: "lessons.is_free ustuni",
    migratsiya: "db/36-videodars-bepul.sql",
    nega: "videodarsni qo'lda bepul qilish",
    ish: () => ustun("lessons", "is_free"),
  },
  {
    nom: "question_blocks.solution_video_url ustuni",
    migratsiya: "db/37-mustaqil-ish.sql",
    nega: "ballsiz \"Mustaqil ishlang\" savollari va ularning videoyechimi",
    ish: () => ustun("question_blocks", "solution_video_url"),
  },
  {
    nom: "topic_examples jadvali",
    migratsiya: "db/33-misol-videolari.sql",
    nega: "TOP kitoblardagi misollar va ularning videolari",
    ish: () => jadval("topic_examples"),
  },
];

console.log(`Baza: ${BASE}\n`);

let yetishmaydi = 0;

for (const t of tekshiruvlar) {
  const natija = await t.ish();

  if (natija.ok) {
    console.log(`  BOR     ${t.nom}`);
    continue;
  }

  yetishmaydi += 1;
  console.log(`  YO'Q    ${t.nom}`);
  console.log(`          ${t.nega}`);
  console.log(`          ishga tushiring: ${t.migratsiya}`);
}

/*
 * FUNKSIYANI BU YERDAN TEKSHIRIB BO'LMAYDI.
 *
 * Avval shunday qilingan edi: mavjud bo'lmagan funksiyaga
 * murojaat 404 qaytaradi, demak 404 = funksiya yo'q. BU XATO
 * XULOSA ekan. PostgREST funksiyani NOMI VA ARGUMENTLARI bo'yicha
 * qidiradi: funksiya bor bo'lsa ham, argumentlari boshqacha bo'lsa
 * baribir 404 qaytaradi. Natijada 2026-10-23 da bu tekshiruv
 * aslida joyida turgan funksiyani "yo'q" deb ko'rsatdi.
 *
 * Shuning uchun olib tashlandi. db/35 ishga tushganini
 * `test_topics.is_free` ustuni bo'yicha bilamiz — o'sha
 * migratsiya ikkalasini birga qo'shadi.
 */

console.log(
  yetishmaydi === 0
    ? "\nHammasi joyida: baza kod bilan mos."
    : `\n${yetishmaydi} ta narsa yetishmaydi. Yuqoridagi SQL fayllarni Supabase -> SQL Editor da ishga tushiring.`,
);

process.exit(yetishmaydi === 0 ? 0 : 1);
