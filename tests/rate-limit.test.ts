import assert from "node:assert/strict";
import { test } from "node:test";

import { clientIp, createRateLimiter } from "../lib/rate-limit.ts";

test("limitgacha ruxsat beradi, keyin to'xtatadi", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });

  assert.equal(limiter.take("a", 0), true);
  assert.equal(limiter.take("a", 10), true);
  assert.equal(limiter.take("a", 20), true);
  assert.equal(limiter.take("a", 30), false);
  // boshqa manzilga ta'sir qilmaydi
  assert.equal(limiter.take("b", 30), true);
});

test("oyna o'tgach yana ruxsat beradi", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

  assert.equal(limiter.take("a", 0), true);
  assert.equal(limiter.take("a", 500), false);
  assert.equal(limiter.take("a", 1001), true);
});

test("xotira chegarasidan oshmaydi", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 5 });

  for (let i = 0; i < 50; i++) {
    assert.equal(limiter.take(`ip-${i}`, i), true);
  }
  // oxirgi kalit hali ham hisobda
  assert.equal(limiter.take("ip-49", 60), false);
});

test("clientIp birinchi manzilni oladi", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
  assert.equal(clientIp(new Headers({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
  assert.equal(clientIp(new Headers()), "nomalum");
});
