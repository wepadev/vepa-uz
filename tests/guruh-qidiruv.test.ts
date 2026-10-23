import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeSearchText } from "../lib/search-text.ts";

/*
 * Qidiruv matni bazaga PostgREST `or(...)` shartining ichida
 * ketadi. U yerda vergul, qavs va yulduzcha maxsus ma'noga ega —
 * tozalanmasa so'rov buziladi yoki boshqa natija qaytaradi.
 */

test("oddiy matn o'zgarmaydi", () => {
  assert.equal(sanitizeSearchText("7-A sinf"), "7-A sinf");
});

test("o'zbek harflari saqlanadi", () => {
  assert.equal(sanitizeSearchText("Toq kunlar guruhi"), "Toq kunlar guruhi");

  // "oʻ" va "gʻ" dagi tutuq belgisi (U+02BB) — harf, olib tashlanmasin
  assert.equal(sanitizeSearchText("Oʻquvchilar"), "Oʻquvchilar");
  assert.equal(sanitizeSearchText("Toʻgʻri guruh"), "Toʻgʻri guruh");
});

test("PostgREST uchun xavfli belgilar olib tashlanadi", () => {
  for (const symbol of [",", "(", ")", "*", "%", "\\", ".", "\"", "'"]) {
    const result = sanitizeSearchText(`7${symbol}A`);

    assert.ok(
      !result.includes(symbol),
      `"${symbol}" qolib ketdi: ${result}`,
    );
  }
});

test("chetdagi bo'sh joylar kesiladi", () => {
  assert.equal(sanitizeSearchText("   7-A   "), "7-A");
});

test("juda uzun matn qisqartiriladi", () => {
  assert.equal(sanitizeSearchText("a".repeat(200)).length, 60);
});

test("faqat belgidan iborat matn bo'sh qoladi", () => {
  assert.equal(sanitizeSearchText(",,,***"), "");
});

test("qo'shilish kodi buzilmaydi", () => {
  assert.equal(sanitizeSearchText("XK7M2Q"), "XK7M2Q");
});
