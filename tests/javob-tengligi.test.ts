import { test } from "node:test";
import assert from "node:assert/strict";

import { answersEquivalent, evaluateAnswer } from "../lib/javob-tengligi.ts";

const yes = (given: string, key: string) =>
  assert.equal(answersEquivalent(given, key), true, `${given} = ${key}`);
const no = (given: string, key: string) =>
  assert.equal(answersEquivalent(given, key), false, `${given} != ${key}`);

test("kasr, önli kasr va aralaş son bir xil", () => {
  yes("-17/4", "$-\\dfrac{17}4$");
  yes("-4,25", "$-\\dfrac{17}4$");
  yes("\\frac{-17}{4}", "$-\\dfrac{17}4$");
  yes("-4\\frac{1}{4}", "$-\\dfrac{17}4$");
  yes("4{,}25", "$4\\dfrac14$");
  no("4", "$-\\dfrac{17}4$");
});

test("ildiz va pi", () => {
  yes("\\sqrt{12}", "$2\\sqrt3$");
  yes("2\\sqrt{3}", "$\\sqrt{12}$");
  yes("\\frac{\\pi}{8}", "$\\dfrac\\pi8$");
  yes("π/8", "$\\dfrac\\pi8$");
  yes("63\\sqrt{3}+27\\sqrt{15}", "$63\\sqrt3+27\\sqrt{15}$");
  yes("\\sqrt[3]{-8}", "-2");
  no("\\sqrt{3}", "$\\sqrt2$");
});

test("daraja, logarifm, trigonometriya", () => {
  yes("2^{10}", "1024");
  yes("\\log_{2}8", "3");
  yes("\\log_2 8", "3");
  yes("\\sin\\frac{\\pi}{6}", "0,5");
  yes("\\sin^2\\frac{\\pi}{4}", "1/2");
});

test("bir nechta javob tartibsiz", () => {
  yes("3; 2", "2; 3");
  no("2", "2; 3");
});

test("hisoblanmaydigan javob matn sifatida", () => {
  yes("(-2;2)", "$(-2;\\,2)$");
  yes("\\left(-2;2\\right)", "$(-2;2)$");
  no("(-2;3)", "$(-2;2)$");
  assert.equal(evaluateAnswer("x+1"), null);
});

test("ortiqça yozuvlar", () => {
  yes("a = 2", "2");
  yes("30^{\\circ}", "30");
  yes("20%", "20");
  yes("12", "$12$");
  no("", "12");
});
