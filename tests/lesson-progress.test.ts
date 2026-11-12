import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildLastScoreMap,
  buildLessonTestMap,
  isLessonPassed,
  lessonAverageScore,
} from "../lib/lesson-progress.ts";

/*
 * Dars bir nechta testdan iborat bo'lishi mumkin. Keyingi dars
 * ularning o'rtachasi 90% ga yetganda ochiladi.
 */

test("uchta testning o'rtachasi hisoblanadi", () => {
  const best = new Map([
    [1, 100],
    [2, 90],
    [3, 80],
  ]);

  assert.equal(lessonAverageScore([1, 2, 3], best), 90);
  assert.equal(isLessonPassed([1, 2, 3], best), true);
});

test("ishlanmagan test nolga tenglashadi", () => {
  const best = new Map([
    [1, 100],
    [2, 100],
  ]);

  /* Uchinchi test umuman ishlanmagan: (100+100+0)/3 = 66.7 */
  assert.equal(isLessonPassed([1, 2, 3], best), false);
});

test("eng yaxşisi emas, oxirgi uriniş olinadi", () => {
  /* Tartib aralaş kelsa ham vaqt böyiça eng keyingisi tanlanadi */
  const last = buildLastScoreMap([
    { test_id: 1, percentage: 40, completed_at: "2026-11-01T10:00:00Z" },
    { test_id: 1, percentage: "70", completed_at: "2026-11-03T10:00:00Z" },
    { test_id: 1, percentage: 95, completed_at: "2026-11-02T10:00:00Z" },
    { test_id: 2, percentage: 100, completed_at: null },
  ]);

  assert.equal(last.get(1), 70);
  /* Tugallanmagan uriniş hisobga kirmaydi */
  assert.equal(last.has(2), false);
});

test("mavzu örtaçasi uç testning oxirgi urinişlaridan", () => {
  const last = buildLastScoreMap([
    { test_id: 1, percentage: 100, completed_at: "2026-11-01T10:00:00Z" },
    { test_id: 1, percentage: 60, completed_at: "2026-11-05T10:00:00Z" },
    { test_id: 2, percentage: 90, completed_at: "2026-11-01T10:00:00Z" },
    { test_id: 3, percentage: 90, completed_at: "2026-11-01T10:00:00Z" },
  ]);

  /* (60 + 90 + 90) / 3 = 80 — eng yaxşisi (100) olinsa 93.3 bölardi */
  assert.equal(lessonAverageScore([1, 2, 3], last), 80);
  assert.equal(isLessonPassed([1, 2, 3], last), false);
});

test("testsiz dars keyingisini to'smaydi", () => {
  assert.equal(lessonAverageScore([], new Map()), null);
  assert.equal(isLessonPassed([], new Map()), true);
});

test("dars va testlar xaritasi tuziladi", () => {
  const map = buildLessonTestMap([
    { lesson_id: 5, test_id: 1 },
    { lesson_id: 5, test_id: 2 },
    { lesson_id: 6, test_id: 3 },
  ]);

  assert.deepEqual(map.get(5), [1, 2]);
  assert.deepEqual(map.get(6), [3]);
});

test("testsiz dars navbatni to'smaydi, lekin 'Tugallangan' emas", async () => {
  const { isLessonCompletedByTests } = await import(
    "../lib/lesson-progress.ts"
  );

  const best = new Map([[1, 95]]);

  assert.equal(isLessonPassed([], best), true);
  assert.equal(isLessonCompletedByTests([], best), false);
  assert.equal(isLessonCompletedByTests([1], best), true);
});
