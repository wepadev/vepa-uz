import assert from "node:assert/strict";
import { test } from "node:test";

import katex from "katex";

import { fixKatexLetters } from "../lib/katex-harflar.ts";

const render = (formula: string) =>
  fixKatexLetters(
    katex.renderToString(formula, {
      output: "htmlAndMathml",
      strict: false,
      throwOnError: false,
    }),
  );

const harflar = (html: string) =>
  [...html.matchAll(/class="mord vp-harf( mathnormal)?(?: mtight)?">([^<]+)</g)].map(
    (m) => (m[1] ? `${m[2]}/i` : m[2]),
  );

test("matn içidagi ö ğ ş ç bitta harf böladi", () => {
  const html = render(String.raw`\text{ğişt Öç Ş Ğ}`);
  assert.deepEqual(harflar(html), ["ğ", "ş", "Ö", "ç", "Ş", "Ğ"]);
  assert.ok(!html.includes("katex-accent"));
});

test("matematik rejimda ham (kursiv), \\c yozuvi qolmaydi", () => {
  const html = render("ş + Ç = Ğ + Ö");
  assert.deepEqual(harflar(html), ["ş/i", "Ç/i", "Ğ/i", "Ö/i"]);
  assert.ok(!html.includes(">\\c<"));
});

test("matematik ustki belgilarga tegilmaydi", () => {
  const html = render(String.raw`\hat{x} + \ddot{x} + \breve{a} + \vec{AB}`);
  assert.deepEqual(harflar(html), []);
  assert.equal(html.match(/class="mord katex-accent"/g)?.length, 4);
});

test("kasr içida ham işlaydi", () => {
  const html = render(String.raw`\frac{\text{söm}}{2}`);
  assert.deepEqual(harflar(html), ["ö"]);
  assert.ok(html.includes("<mtext>ö</mtext>"));
});
