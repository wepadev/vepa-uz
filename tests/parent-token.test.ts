import { test } from "node:test";
import assert from "node:assert/strict";

import { createParentToken, readParentToken } from "../lib/parent-token.ts";

const secret = "sinov-kaliti";

test("o'z kodi o'qiladi", () => {
  const token = createParentToken(42, secret);
  assert.equal(readParentToken(token, secret), 42);
});

test("id almashtirilsa kod ishlamaydi", () => {
  const token = createParentToken(42, secret);
  const forged = token.replace(/^42-/, "43-");
  assert.equal(readParentToken(forged, secret), null);
});

test("boshqa kalit bilan ishlamaydi", () => {
  const token = createParentToken(42, secret);
  assert.equal(readParentToken(token, "boshqa"), null);
});

test("noto'g'ri shakl", () => {
  assert.equal(readParentToken("", secret), null);
  assert.equal(readParentToken("abc", secret), null);
  assert.equal(readParentToken("42-", secret), null);
  assert.equal(readParentToken("0-xyz", secret), null);
});
