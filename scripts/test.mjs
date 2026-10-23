/**
 * Testlarni ishga tushiradi.
 *
 *   npm test
 *
 * Nega alohida skript: Windows'da `node --test tests/*.mts` ishlamaydi,
 * chunki cmd yulduzchani ochib bermaydi. Bu skript fayllarni o'zi topib,
 * Node'ning ichki test yurituvchisiga uzatadi — Windows'da ham,
 * Linux'da ham bir xil ishlaydi.
 *
 * Qo'shimcha paket kerak emas: Node 22.6 dan boshlab TypeScript
 * fayllarni o'zi tushunadi.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const TESTS_DIR = "tests";

const files = readdirSync(TESTS_DIR)
  .filter((name) => name.endsWith(".test.mts"))
  .map((name) => join(TESTS_DIR, name))
  .sort();

if (files.length === 0) {
  console.error("tests/ papkasida test fayli topilmadi.");
  process.exit(1);
}

console.log(`${files.length} ta test fayli ishga tushirilmoqda…\n`);

const result = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=spec", ...files],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
