import { test } from "node:test";
import assert from "node:assert/strict";

import { gradeAnswers, parseGivenAnswers } from "../lib/answer-check.ts";

test("javoblar: oddiy ketma-ketlik o'qiladi", () => {
  assert.deepEqual(parseGivenAnswers("ABCD"), ["A", "B", "C", "D"]);
});

test("javoblar: bo'sh joy, raqam va tinish belgilari tashlanadi", () => {
  assert.deepEqual(parseGivenAnswers("1. A  2. B\n3) c, 4) d"), ["A", "B", "C", "D"]);
});

test("javoblar: kichik harf ham qabul qilinadi", () => {
  assert.deepEqual(parseGivenAnswers("abcd"), ["A", "B", "C", "D"]);
});

test("javoblar: ? o'tkazib yuborilgan savol sifatida qoladi", () => {
  assert.deepEqual(parseGivenAnswers("A?C"), ["A", "?", "C"]);
});

test("javoblar: bo'sh matn bo'sh ro'yxat beradi", () => {
  for (const v of ["", "   ", null, undefined]) {
    assert.deepEqual(parseGivenAnswers(v), []);
  }
});

test("tekshirish: hammasi to'g'ri", () => {
  const r = gradeAnswers("ABCD", "ABCD");
  assert.equal(r.correct, 4);
  assert.equal(r.wrong, 0);
  assert.equal(r.total, 4);
  assert.equal(r.percent, 100);
});

test("tekshirish: xatolar qayd etiladi", () => {
  const r = gradeAnswers("ABCD", "ABCA");
  assert.equal(r.correct, 3);
  assert.equal(r.wrong, 1);
  assert.equal(r.percent, 75);
  const last = r.rows[3];
  assert.equal(last.mark, "wrong");
  assert.equal(last.given, "D");
  assert.equal(last.key, "A");
});

test("tekshirish: yetmagan javoblar bo'sh deb belgilanadi", () => {
  const r = gradeAnswers("AB", "ABCD");
  assert.equal(r.correct, 2);
  assert.equal(r.blank, 2);
  assert.equal(r.rows[2].mark, "blank");
  assert.equal(r.rows[2].given, null);
  assert.equal(r.percent, 50);
});

test("tekshirish: kaliti yo'q savol baholanmaydi", () => {
  const r = gradeAnswers("ABCD", "AB?D");
  assert.equal(r.noKey, 1);
  assert.equal(r.total, 3, "kaliti yo'q savol umumiy songa kirmaydi");
  assert.equal(r.correct, 3);
  assert.equal(r.percent, 100);
  assert.equal(r.rows[2].mark, "nokey");
  assert.equal(r.rows[2].key, null);
});

test("tekshirish: ortiqcha javob sanaladi", () => {
  const r = gradeAnswers("ABCDAB", "ABCD");
  assert.equal(r.expectedCount, 4);
  assert.equal(r.givenCount, 6);
  assert.equal(r.extraCount, 2);
  assert.equal(r.rows.length, 4, "faqat kalitdagi savollar qatori bo'ladi");
});

test("tekshirish: butunlay bo'sh javob", () => {
  const r = gradeAnswers("", "ABCD");
  assert.equal(r.blank, 4);
  assert.equal(r.correct, 0);
  assert.equal(r.percent, 0);
});

test("tekshirish: ? bilan o'tkazilgan savol bo'sh hisoblanadi", () => {
  const r = gradeAnswers("A?CD", "ABCD");
  assert.equal(r.blank, 1);
  assert.equal(r.correct, 3);
  assert.equal(r.rows[1].mark, "blank");
});
