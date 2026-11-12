import { test } from "node:test";
import assert from "node:assert/strict";

import {
  matchQuestions,
  normalizeTitle,
  parseSolutionFile,
  testNumberFromTitle,
} from "../lib/yechimlar.ts";

const sample = `# 25. Çiziqli tenglamalar

## 1-test

### 1 [A]
Ikkala tomonni $8$ ga bölamiz.

Javob: $-4$.

### 2 [D]
$$x = 1$$
Javob: $1$.

## 2-test

### 1 [B]
Javob: $2$.
`;

test("yeçim fayli öqiladi", () => {
  const file = parseSolutionFile(sample);

  assert.equal(file.topic, 25);
  assert.equal(file.title, "Çiziqli tenglamalar");
  assert.deepEqual(file.errors, []);
  assert.equal(file.tests.get(1)?.length, 2);
  assert.equal(file.tests.get(1)?.[0].answer, "A");
  assert.equal(file.tests.get(1)?.[0].text, "Ikkala tomonni $8$ ga bölamiz.\n\nJavob: $-4$.");
  assert.equal(file.tests.get(2)?.[0].answer, "B");
});

test("tuşib qolgan raqam xato deb körsatiladi", () => {
  const file = parseSolutionFile("# 1. A\n\n## 1-test\n\n### 1 [A]\nx\n\n### 3 [B]\ny\n");

  assert.equal(file.errors.length, 1);
});

test("sarlavha alifbo va qavsdan qat'i nazar solişiriladi", () => {
  assert.equal(normalizeTitle("Oddiy kasrlar (1-qism)"), normalizeTitle("Oddiy kasrlar 1-qism"));
  assert.equal(normalizeTitle("Çiziqli tenglamalar"), normalizeTitle("Chiziqli tenglamalar"));
  assert.equal(normalizeTitle("Töğri burçak"), normalizeTitle("To‘g‘ri burchak"));
  assert.equal(testNumberFromTitle("2-test"), 2);
  assert.equal(testNumberFromTitle("Umumiy"), null);
});

test("savollar tartib böyiça juftlanadi, kalit mos kelmasa yozilmaydi", () => {
  const file = parseSolutionFile(sample);
  const matched = matchQuestions(
    [
      { id: 12, order_number: 2, correct_answer: "C", solution_text: null },
      { id: 11, order_number: 1, correct_answer: "A", solution_text: null },
      { id: 13, order_number: 3, correct_answer: "B", solution_text: null },
    ],
    file.tests.get(1)!,
  );

  assert.deepEqual(
    matched.map((item) => [item.questionId, item.status]),
    [
      [11, "new"],
      [12, "wrong-answer"],
      [13, "missing"],
    ],
  );
});

test("nashr qilingan yeçim özgarmasa qayta yozilmaydi", () => {
  const file = parseSolutionFile(sample);
  const items = file.tests.get(1)!;
  const [same, changed] = matchQuestions(
    [
      { id: 1, order_number: 1, correct_answer: "a", solution_text: items[0].text },
      { id: 2, order_number: 2, correct_answer: "D", solution_text: "eski" },
    ],
    items,
  );

  assert.equal(same.status, "same");
  assert.equal(changed.status, "changed");
});
