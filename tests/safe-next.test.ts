import { test } from "node:test";
import assert from "node:assert/strict";

import { getSafeNext } from "../lib/safe-next.ts";

test("ichki yo'l o'zgarishsiz qaytadi", () => {
  assert.equal(getSafeNext("/homework"), "/homework");
  assert.equal(
    getSafeNext("/tests/take?testId=5&assignmentId=9"),
    "/tests/take?testId=5&assignmentId=9",
  );
});

test("bo'sh qiymatda bosh sahifa", () => {
  assert.equal(getSafeNext(null), "/");
  assert.equal(getSafeNext(undefined), "/");
  assert.equal(getSafeNext(""), "/");
});

test("tashqi manzilga yo'naltirib bo'lmaydi", () => {
  assert.equal(getSafeNext("https://evil.com"), "/");
  assert.equal(getSafeNext("//evil.com"), "/");
  assert.equal(getSafeNext("/\\evil.com"), "/");
  assert.equal(getSafeNext("javascript:alert(1)"), "/");
});
