import test from "node:test";
import assert from "node:assert/strict";

import {
  duplicateNumbers,
  findRunningHeaders,
  matchAnswerKey,
  parseAnswerKey,
  parseTests,
  splitOptions,
  type PdfLine,
} from "../lib/pdf-offline.ts";

const line = (page: number, y: number, text: string): PdfLine => ({
  page,
  y,
  text,
});

test("bitta qatordagi to'rtta variant ajratiladi", () => {
  const options = splitOptions("A) 8   B) 5   C) 7   D) 6");

  assert.deepEqual(options, { A: "8", B: "5", C: "7", D: "6" });
});

test("variantlar orasida bo'shliq bo'lsa ham ishlaydi", () => {
  const options = splitOptions("A ) y^{15}  B ) y^{13}");

  assert.equal(options.A, "y^{15}");
  assert.equal(options.B, "y^{13}");
});

test("kolontitul faqat bet yuqorisida va takrorlansa aniqlanadi", () => {
  const lines = [
    line(1, 800, "Algebraik kasrlar 1-TEST"),
    line(1, 500, "A) 7 B) 6 C) 5 D) 8"),
    line(2, 800, "Algebraik kasrlar 1-TEST"),
    line(2, 500, "A) 7 B) 6 C) 5 D) 8"),
  ];

  const headers = findRunningHeaders(lines);

  assert.ok(headers.has("Algebraik kasrlar 1-TEST"));
  // Tasodifan bir xil bo'lgan variant qatori kolontitul emas
  assert.ok(!headers.has("A) 7 B) 6 C) 5 D) 8"));
});

test("uchta test va ularning savollari ajratiladi", () => {
  const lines = [
    line(1, 800, "1-test"),
    line(1, 780, "1. Birinchi savol?"),
    line(1, 760, "A) 1 B) 2 C) 3 D) 4"),
    line(1, 740, "2. Ikkinchi savol?"),
    line(1, 720, "A) 5 B) 6 C) 7 D) 8"),
    line(2, 800, "2-test"),
    line(2, 780, "1. Uchinchi savol?"),
    line(2, 760, "A) 9 B) 10 C) 11 D) 12"),
  ];

  const result = parseTests(lines);

  assert.equal(result.tests.length, 2);
  assert.equal(result.total, 3);
  assert.equal(result.clean, 3);
  assert.equal(result.tests[0].questions[1].text, "Ikkinchi savol?");
});

test("savol matni bir necha qatorga bo'linsa birlashtiriladi", () => {
  const lines = [
    line(1, 800, "1-test"),
    line(1, 780, "1. Juda uzun savol boshlandi"),
    line(1, 765, "va shu yerda tugadi?"),
    line(1, 750, "A) 1 B) 2 C) 3 D) 4"),
  ];

  const result = parseTests(lines);

  assert.equal(
    result.tests[0].questions[0].text,
    "Juda uzun savol boshlandi va shu yerda tugadi?",
  );
});

test("variantlar ikki qatorga bo'lingani birlashtiriladi", () => {
  const lines = [
    line(1, 800, "1-test"),
    line(1, 780, "1. Savol?"),
    line(1, 765, "A) {(4; 0)} B) {(8; 0)}"),
    line(1, 750, "C) {(6; 0)} D) {(7; 0)}"),
  ];

  const result = parseTests(lines);

  assert.equal(result.clean, 1);
  assert.equal(result.tests[0].questions[0].options.D, "{(7; 0)}");
});

test("to'liqsiz variant va bo'sh kasr belgilanadi", () => {
  const lines = [
    line(1, 800, "1-test"),
    line(1, 780, "1. Kasrli savol?"),
    line(1, 765, "A) − B) C) 47 D)"),
  ];

  const result = parseTests(lines);
  const flags = result.tests[0].questions[0].flags.join(" | ");

  assert.equal(result.clean, 0);
  assert.match(flags, /kasr bo'lishi mumkin/);
});

test("javoblar kaliti variantlar bo'yicha ajratiladi", () => {
  const lines = [
    line(1, 800, "Javoblar kaliti"),
    line(1, 780, "2-variant (1-TEST)"),
    line(1, 765, "1. C      2. A       3. B     4. D"),
    line(1, 750, "5. A      6. C"),
    line(1, 730, "3-variant (2-TEST)"),
    line(1, 715, "1. B      2. D"),
  ];

  const variants = parseAnswerKey(lines);

  assert.equal(variants.length, 2);
  assert.equal(variants[0].answers.size, 6);
  assert.equal(variants[0].answers.get(4), "D");
  assert.equal(variants[1].answers.get(2), "D");
});

test("kalitdagi 60 dan katta raqam javob deb olinmaydi", () => {
  const lines = [
    line(1, 800, "1-variant"),
    line(1, 780, "1. A   2. B   2026. C"),
  ];

  const variants = parseAnswerKey(lines);

  assert.equal(variants[0].answers.size, 2);
});

test("javoblar kaliti test raqami bo'yicha ulanadi", () => {
  const tests = [
    { title: "1-test", questions: new Array(17).fill(null).map(() => ({ number: 1, text: "", options: {}, flags: [], source: [] })) },
    { title: "2-test", questions: new Array(17).fill(null).map(() => ({ number: 1, text: "", options: {}, flags: [], source: [] })) },
  ];

  const variants = [
    { label: "1-variant (nazariya + test)", answers: new Map([[1, "A" as const]]) },
    { label: "2-variant (1-TEST)", answers: new Map([[1, "C" as const]]) },
    { label: "3-variant (2-TEST)", answers: new Map([[1, "B" as const]]) },
  ];

  const matched = matchAnswerKey(tests, variants);

  // "nazariya" varianti chetda qoladi, raqam bo'yicha to'g'ri ulanadi
  assert.equal(matched.get(0)?.label, "2-variant (1-TEST)");
  assert.equal(matched.get(1)?.label, "3-variant (2-TEST)");
});

test("raqamlash qaytadan boshlansa yangi test ajraladi", () => {
  /*
   * "N-test" qatori yo'q fayl: uchta test ketma-ket, har birida
   * raqamlash 1 dan boshlanadi. Chegarani sezmasak uchtasi bitta
   * bo'lib qo'shilib ketadi va javoblar kaliti aralashadi.
   */
  const result = parseTests([
    line(1, 700, "1. Birinchi savol?"),
    line(1, 690, "A) 1 B) 2 C) 3 D) 4"),
    line(1, 680, "2. Ikkinchi savol?"),
    line(1, 670, "A) 1 B) 2 C) 3 D) 4"),
    line(1, 660, "1. Yangi testning birinchi savoli?"),
    line(1, 650, "A) 1 B) 2 C) 3 D) 4"),
  ]);

  assert.equal(result.tests.length, 2);
  assert.deepEqual(
    result.tests.map((test) => test.questions.length),
    [2, 1],
  );
});

test("kolontituldagi test raqami o'zgarsa yangi test ajraladi", () => {
  /*
   * Ba'zi fayllarda test raqami faqat betning yuqorisida turadi.
   * Kolontitul ikki betda takrorlangani uchun aniqlanadi.
   */
  const result = parseTests([
    line(1, 760, "Daraja (1-qism) 1-TEST"),
    line(1, 700, "1. Birinchi?"),
    line(1, 690, "A) 1 B) 2 C) 3 D) 4"),
    line(2, 760, "Daraja (1-qism) 1-TEST"),
    line(2, 700, "2. Ikkinchi?"),
    line(2, 690, "A) 1 B) 2 C) 3 D) 4"),
    line(3, 760, "Daraja (1-qism) 2-TEST"),
    line(3, 700, "1. Boshqa testning savoli?"),
    line(3, 690, "A) 1 B) 2 C) 3 D) 4"),
    line(4, 760, "Daraja (1-qism) 2-TEST"),
    line(4, 700, "2. Yana bittasi?"),
    line(4, 690, "A) 1 B) 2 C) 3 D) 4"),
  ]);

  assert.deepEqual(
    result.tests.map((test) => test.title),
    ["1-test", "2-test"],
  );
  assert.deepEqual(
    result.tests.map((test) => test.questions.length),
    [2, 2],
  );
});

test("takrorlangan savol raqami aniqlanadi", () => {
  const test1 = {
    title: "1-test",
    questions: [
      { number: 1, text: "a", options: {}, flags: [], source: [] },
      { number: 2, text: "b", options: {}, flags: [], source: [] },
      { number: 1, text: "c", options: {}, flags: [], source: [] },
    ],
  };

  assert.deepEqual(duplicateNumbers(test1), [1]);
  assert.deepEqual(
    duplicateNumbers({ title: "2-test", questions: [] }),
    [],
  );
});

test("eski fayl: savol \"1-test\" deb raqamlangan bo'lsa ham ajraladi", () => {
  /*
   * "2 tadan" fayllarda savol "N-test" deb yoziladi, test raqami
   * esa faqat kolontitulda turadi. "N." ko'rinishidagi savol
   * umuman yo'q — shundan farqini bilamiz.
   */
  const result = parseTests([
    line(1, 760, "Algebraik kasrlar 1-TEST"),
    line(1, 700, "1-test"),
    line(1, 690, "Soddalashtiring: $x^{2}$."),
    line(1, 680, "A) 1 B) 2 C) 3 D) 4"),
    line(2, 760, "Algebraik kasrlar 1-TEST"),
    line(2, 700, "2-test"),
    line(2, 690, "Yana soddalashtiring."),
    line(2, 680, "A) 1 B) 2 C) 3 D) 4"),
    line(3, 760, "Algebraik kasrlar 2-TEST"),
    line(3, 700, "1-test"),
    line(3, 690, "Boshqa testning savoli."),
    line(3, 680, "A) 1 B) 2 C) 3 D) 4"),
    line(4, 760, "Algebraik kasrlar 2-TEST"),
    line(4, 700, "2-test"),
    line(4, 690, "Yana bittasi."),
    line(4, 680, "A) 1 B) 2 C) 3 D) 4"),
  ]);

  assert.deepEqual(
    result.tests.map((test) => test.title),
    ["1-test", "2-test"],
  );
  assert.deepEqual(
    result.tests.map((test) => test.questions.length),
    [2, 2],
  );
  assert.equal(result.tests[0].questions[0].number, 1);
  assert.match(result.tests[0].questions[0].text, /Soddalashtiring/);
});

test("toq $ belgisi va tugallanmagan ifoda belgilanadi", () => {
  const result = parseTests([
    line(1, 700, "1. Hisoblang: $x^{2."),
    line(1, 690, "A) 1 B) 2 C) 3 D) 4"),
    line(1, 680, "2. Hisoblang: 5 +."),
    line(1, 670, "A) 1 B) 2 C) 3 D) 4"),
  ]);

  const [first, second] = result.tests[0].questions;

  assert.ok(first.flags.some((flag) => flag.includes("toq")));
  assert.ok(second.flags.some((flag) => flag.includes("amal belgisi")));
});
