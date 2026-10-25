import { test } from "node:test";
import assert from "node:assert/strict";

import { buildLessonGates } from "../lib/lesson-progress.ts";

/*
 * Qoida: dars ochiq bo'lishi uchun ikkala to'siqdan o'tishi kerak —
 * tarif (Premium yoki bepul) va navbat (oldingilari bajarilgan yoki
 * dars bepul).
 */

const L = (isFree: boolean, isCompleted: boolean) => ({
  isFree,
  isCompleted,
});

test("obunasiz o'quvchi faqat bepul darsni ko'radi", () => {
  const gates = buildLessonGates(
    [L(true, false), L(false, false)],
    false,
  );

  assert.equal(gates[0].isOpen, true);
  assert.equal(gates[1].hasContentAccess, false);
  assert.equal(gates[1].isOpen, false);
});

test("bepul dars navbatdan tashqarida ochiladi", () => {
  /* 1 va 2 pullik va bajarilmagan, 3 bepul */
  const gates = buildLessonGates(
    [L(false, false), L(false, false), L(true, false)],
    false,
  );

  assert.equal(gates[2].isSequenceUnlocked, true);
  assert.equal(gates[2].isOpen, true);
});

test("bepul darsni ochish keyingi pullik darsni ochmaydi", () => {
  /* Premium obunachi 1-darsni tashlab, bepul 2-darsni bajardi */
  const gates = buildLessonGates(
    [L(false, false), L(true, true), L(false, false)],
    true,
  );

  assert.equal(gates[1].isOpen, true);
  assert.equal(gates[2].hasContentAccess, true);
  assert.equal(gates[2].isSequenceUnlocked, false);
  assert.equal(gates[2].isOpen, false);
});

test("navbat bajarilgan darslardan keyin suriladi", () => {
  const gates = buildLessonGates(
    [L(false, true), L(false, true), L(false, false), L(false, false)],
    true,
  );

  assert.equal(gates[0].isOpen, true);
  assert.equal(gates[1].isOpen, true);
  assert.equal(gates[2].isOpen, true);
  assert.equal(gates[3].isOpen, false);
});

test("obunasiz o'quvchi bepul darsni bajarsa ham pullikka o'tmaydi", () => {
  const gates = buildLessonGates(
    [L(true, true), L(false, true)],
    false,
  );

  assert.equal(gates[0].isOpen, true);
  assert.equal(gates[1].isSequenceUnlocked, true);
  assert.equal(gates[1].hasContentAccess, false);
  assert.equal(gates[1].isOpen, false);
});

test("bo'sh ro'yxat xato bermaydi", () => {
  assert.deepEqual(buildLessonGates([], true), []);
});
