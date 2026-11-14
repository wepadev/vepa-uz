import assert from "node:assert/strict";
import test from "node:test";

import { formatClock } from "../lib/clock.ts";

test("formatClock: soatsiz va soatli", () => {
  assert.equal(formatClock(189), "3:09");
  assert.equal(formatClock(59), "0:59");
  assert.equal(formatClock(3789), "1:03:09");
  assert.equal(formatClock(-5), "0:00");
});
