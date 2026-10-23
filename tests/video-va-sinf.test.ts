import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeVideoUrl } from "../lib/video-url.ts";
import { GRADES, MAX_GRADE, MIN_GRADE, isValidGrade } from "../lib/grades.ts";
import { getYouTubeVideoId } from "../lib/youtube.ts";

test("videoyechim havolasi: to‘g‘ri variantlar", () => {
  for (const url of [
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=abc",
    "https://www.youtube-nocookie.com/embed/abc",
  ]) {
    const result = normalizeVideoUrl(url);
    assert.equal(result.error, null, `${url} qabul qilinishi kerak edi`);
    assert.ok(result.value);
  }
});

test("videoyechim havolasi: bo‘sh qoldirish mumkin", () => {
  for (const value of ["", "   ", null, undefined]) {
    const result = normalizeVideoUrl(value);
    assert.equal(result.value, null);
    assert.equal(result.error, null, "video ixtiyoriy bo'lishi kerak");
  }
});

test("videoyechim havolasi: noto‘g‘ri variantlar rad etiladi", () => {
  for (const url of [
    "youtu.be/abc",
    "youtube.com/watch?v=abc",
    "salom",
    "ftp://youtu.be/abc",
  ]) {
    assert.ok(
      normalizeVideoUrl(url).error,
      `${url} rad etilishi kerak edi`,
    );
  }
});

test("videoyechim havolasi: YouTube bo‘lmagan manzil rad etiladi", () => {
  const result = normalizeVideoUrl("https://vimeo.com/123");
  assert.ok(result.error?.includes("YouTube"));
});

test("YouTube video raqami ajratib olinadi", () => {
  assert.equal(getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(
    getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(getYouTubeVideoId("salom"), null);
  assert.equal(getYouTubeVideoId(null), null);
});

test("darslik sinflari 5 dan 11 gacha", () => {
  assert.deepEqual(GRADES, [5, 6, 7, 8, 9, 10, 11]);
  assert.equal(MIN_GRADE, 5);
  assert.equal(MAX_GRADE, 11);
});

test("sinf tekshiruvi chegaralarni hurmat qiladi", () => {
  for (const grade of [5, 8, 11]) {
    assert.ok(isValidGrade(grade), `${grade}-sinf qabul qilinishi kerak`);
  }

  for (const grade of [4, 12, 0, -1, 5.5]) {
    assert.ok(!isValidGrade(grade), `${grade} rad etilishi kerak`);
  }

  assert.ok(!isValidGrade("7"));
  assert.ok(!isValidGrade(null));
  assert.ok(!isValidGrade(undefined));
});
