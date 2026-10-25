import { test } from "node:test";
import assert from "node:assert/strict";

import { remainingLabel } from "../lib/due-label.ts";

const now = Date.parse("2026-10-25T10:00:00Z");
const after = (ms: number) => new Date(now + ms).toISOString();

test("o'tgan muddat", () => {
  assert.equal(remainingLabel(after(-1000), now), "Muddat tugadi");
});

test("kun, soat va daqiqa", () => {
  assert.equal(remainingLabel(after(3 * 86_400_000), now), "3 kun qoldi");
  assert.equal(remainingLabel(after(5 * 3_600_000), now), "5 soat qoldi");
  assert.equal(remainingLabel(after(20 * 60_000), now), "20 daqiqa qoldi");
  assert.equal(remainingLabel(after(10_000), now), "1 daqiqa qoldi");
});
