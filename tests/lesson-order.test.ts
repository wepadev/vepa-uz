import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseOrderNumber,
  placeLesson,
  planLessonReorder,
  type LessonOrderRow,
} from "../lib/lesson-order.ts";

/*
 * Videodars tartibi: admin raqam beradi, band joydagilar suriladi.
 */

const lessons: LessonOrderRow[] = [
  { id: 10, order_number: 1 },
  { id: 11, order_number: 2 },
  { id: 12, order_number: 3 },
  { id: 13, order_number: 4 },
];

function apply(
  rows: LessonOrderRow[],
  updates: { id: number; order_number: number }[],
) {
  const map = new Map(rows.map((row) => [row.id, row.order_number]));

  for (const update of updates) {
    const taken = [...map.entries()].some(
      ([id, number]) =>
        id !== update.id && number === update.order_number,
    );

    assert.equal(taken, false, `${update.order_number} band edi`);
    map.set(update.id, update.order_number);
  }

  return map;
}

test("bo'sh raqam — oxiriga, noto'g'ri raqam — xato", () => {
  assert.equal(parseOrderNumber(""), null);
  assert.equal(parseOrderNumber(null), null);
  assert.equal(parseOrderNumber("3"), 3);
  assert.equal(parseOrderNumber("0"), undefined);
  assert.equal(parseOrderNumber("2.5"), undefined);
  assert.equal(parseOrderNumber("abc"), undefined);
});

test("dars aynan admin bergan raqamni oladi", () => {
  const two = [
    { id: 1, order_number: 1 },
    { id: 2, order_number: 2 },
  ];

  const result = apply(two, planLessonReorder(two, 1, 11));

  assert.equal(result.get(1), 11);
  assert.equal(result.get(2), 2);

  const next = apply(
    [...result].map(([id, order_number]) => ({ id, order_number })),
    planLessonReorder(
      [...result].map(([id, order_number]) => ({ id, order_number })),
      2,
      13,
    ),
  );

  assert.equal(next.get(1), 11);
  assert.equal(next.get(2), 13);
});

test("band raqamga qo'yilsa, faqat zich turganlar suriladi", () => {
  const rows = [
    { id: 1, order_number: 11 },
    { id: 2, order_number: 12 },
    { id: 3, order_number: 15 },
    { id: 9, order_number: 30 },
  ];

  assert.deepEqual(placeLesson(rows, 9, 11), [
    { id: 9, order_number: 11 },
    { id: 1, order_number: 12 },
    { id: 2, order_number: 13 },
    { id: 3, order_number: 15 },
  ]);
});

test("0 yoki manfiy raqam 1 ga tushadi", () => {
  assert.equal(
    placeLesson(lessons, 13, -5).find((row) => row.id === 13)
      ?.order_number,
    1,
  );
});

test("o'zgarishlar hech qachon ikki darsni bir raqamga qo'ymaydi", () => {
  for (const id of [10, 11, 12, 13]) {
    for (let position = 1; position <= 7; position += 1) {
      const result = apply(
        lessons,
        planLessonReorder(lessons, id, position),
      );

      assert.equal(result.get(id), position);
      assert.equal(new Set(result.values()).size, 4);
    }
  }
});

test("joyi o'zgarmasa hech narsa yozilmaydi", () => {
  assert.deepEqual(planLessonReorder(lessons, 12, 3), []);
});

test("bo'sh joylar saqlanadi", () => {
  const gappy = [
    { id: 1, order_number: 2 },
    { id: 2, order_number: 5 },
    { id: 3, order_number: 9 },
  ];

  const result = apply(gappy, planLessonReorder(gappy, 3, 1));

  assert.deepEqual(
    [...result.entries()].sort((a, b) => a[1] - b[1]),
    [
      [3, 1],
      [1, 2],
      [2, 5],
    ],
  );
});
