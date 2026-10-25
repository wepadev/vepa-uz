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

test("yangi dars 2-o'ringa qo'yilsa, qolganlari suriladi", () => {
  const withNew = [...lessons, { id: 20, order_number: 5 }];

  assert.deepEqual(
    placeLesson(withNew, 20, 2).map((row) => row.id),
    [10, 20, 11, 12, 13],
  );
});

test("katta raqam oxiriga, kichik raqam boshiga tushadi", () => {
  assert.deepEqual(
    placeLesson(lessons, 11, 99).map((row) => row.id),
    [10, 12, 13, 11],
  );

  assert.deepEqual(
    placeLesson(lessons, 13, -5).map((row) => row.id),
    [13, 10, 11, 12],
  );
});

test("o'zgarishlar hech qachon ikki darsni bir raqamga qo'ymaydi", () => {
  for (const id of [10, 11, 12, 13]) {
    for (let position = 1; position <= 4; position += 1) {
      const result = apply(
        lessons,
        planLessonReorder(lessons, id, position),
      );

      assert.equal(result.get(id), position);
      assert.deepEqual(
        [...result.values()].sort((a, b) => a - b),
        [1, 2, 3, 4],
      );
    }
  }
});

test("joyi o'zgarmasa hech narsa yozilmaydi", () => {
  assert.deepEqual(planLessonReorder(lessons, 12, 3), []);
});

test("teshikli raqamlar 1, 2, 3 ... ga keltiriladi", () => {
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
      [2, 3],
    ],
  );
});
