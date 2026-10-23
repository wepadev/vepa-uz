import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeVideoUrl } from "../lib/video-url.ts";
import {
  MAX_EXAMPLES_PER_BATCH,
  parseExampleLines,
} from "../lib/topic-examples.ts";

test("misollar ro‘yxati: nomi va havolasi ajratiladi", () => {
  const result = parseExampleLines(
    [
      "1-misol | https://youtu.be/dQw4w9WgXcQ",
      "2-misol|https://www.youtube.com/watch?v=abc",
    ].join("\n"),
    normalizeVideoUrl,
  );

  assert.deepEqual(result.problems, []);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].label, "1-misol");
  assert.ok(result.rows[0].videoUrl?.includes("dQw4w9WgXcQ"));
  assert.equal(result.rows[1].label, "2-misol");
});

test("misollar ro‘yxati: havolasiz misol ham qabul qilinadi", () => {
  const result = parseExampleLines("7-misol", normalizeVideoUrl);

  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.rows, [{ label: "7-misol", videoUrl: null }]);
});

test("misollar ro‘yxati: bo‘sh qatorlar tashlab yuboriladi", () => {
  const result = parseExampleLines(
    "\n  \n1-misol\n\n2-misol\n   ",
    normalizeVideoUrl,
  );

  assert.deepEqual(result.problems, []);
  assert.equal(result.rows.length, 2);
});

test("misollar ro‘yxati: bo‘sh matn rad etiladi", () => {
  for (const value of ["", "   \n  ", null, undefined]) {
    const result = parseExampleLines(value, normalizeVideoUrl);
    assert.equal(result.rows.length, 0);
    assert.equal(result.problems.length, 1);
  }
});

test("misollar ro‘yxati: noto‘g‘ri havola qator raqami bilan ko‘rsatiladi", () => {
  const result = parseExampleLines(
    ["1-misol | https://youtu.be/abc", "2-misol | vimeo.com/123"].join("\n"),
    normalizeVideoUrl,
  );

  assert.equal(result.rows.length, 0, "xato bo'lsa hech narsa qo'shilmaydi");
  assert.equal(result.problems.length, 1);
  assert.ok(result.problems[0].startsWith("2-qator:"));
});

test("misollar ro‘yxati: nomi yo‘q qator rad etiladi", () => {
  const result = parseExampleLines(
    "| https://youtu.be/abc",
    normalizeVideoUrl,
  );

  assert.equal(result.problems.length, 1);
  assert.ok(result.problems[0].includes("misol nomini"));
});

test("misollar ro‘yxati: takrorlangan nom rad etiladi", () => {
  const result = parseExampleLines(
    ["1-misol", "1-MISOL"].join("\n"),
    normalizeVideoUrl,
  );

  assert.equal(result.rows.length, 0, "xato bo'lsa hech narsa qo'shilmaydi");
  assert.equal(result.problems.length, 1);
  assert.ok(result.problems[0].includes("takrorlan"));
});

test("misollar ro‘yxati: juda uzun ro‘yxat rad etiladi", () => {
  const lines = Array.from(
    { length: MAX_EXAMPLES_PER_BATCH + 1 },
    (_value, index) => `${index + 1}-misol`,
  ).join("\n");

  const result = parseExampleLines(lines, normalizeVideoUrl);

  assert.equal(result.rows.length, 0);
  assert.equal(result.problems.length, 1);
});

test("misollar ro‘yxati: havoladagi | belgisi nomni buzmaydi", () => {
  const result = parseExampleLines(
    "3-misol | https://youtu.be/abc",
    normalizeVideoUrl,
  );

  assert.equal(result.rows[0].label, "3-misol");
});
