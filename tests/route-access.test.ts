import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";

import {
  PROTECTED_SECTIONS,
  PUBLIC_SECTIONS,
  requiresLogin,
} from "../lib/route-access.ts";

test("yopiq bo'limlar kirishni talab qiladi", () => {
  assert.equal(requiresLogin("/tests"), true);
  assert.equal(requiresLogin("/tests/list"), true);
  assert.equal(requiresLogin("/admin/crm"), true);
  assert.equal(requiresLogin("/api/admin/import-pdf"), true);
});

test("ochiq va yo'q sahifalar o'tkaziladi (404 ko'rinadi)", () => {
  assert.equal(requiresLogin("/"), false);
  assert.equal(requiresLogin("/pricing"), false);
  assert.equal(requiresLogin("/katalog"), false);
  assert.equal(requiresLogin("/auth/login"), false);
  assert.equal(requiresLogin("/api/report-error"), false);
  assert.equal(requiresLogin("/yoq-sahifa"), false);
  assert.equal(requiresLogin("/testsx"), false);
});

test("app/ dagi har bir bo'lim ro'yxatlardan birida", () => {
  const known = new Set<string>([...PROTECTED_SECTIONS, ...PUBLIC_SECTIONS]);
  const dirs = readdirSync(new URL("../app/", import.meta.url), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    // server action fayllari, sahifa emas
    .filter((name) => name !== "actions");

  for (const dir of dirs) {
    assert.ok(known.has(dir), `app/${dir} — lib/route-access.ts ga yozing`);
  }
});
