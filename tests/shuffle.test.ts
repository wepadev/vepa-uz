import { test } from "node:test";
import assert from "node:assert/strict";

import {
  hasFixedOption,
  shuffleOptions,
  stableShuffle,
} from "../lib/shuffle.ts";

/*
 * Variantlarni aralashtirish — test yaxlitligining asosi.
 * Bu yerda buzilish o'quvchining bahosiga to'g'ridan-to'g'ri ta'sir
 * qiladi, shuning uchun eng ko'p test shu qismga.
 */

const OPTIONS = [
  { letter: "A", text: "12" },
  { letter: "B", text: "24" },
  { letter: "C", text: "36" },
  { letter: "D", text: "48" },
];

test("bir xil urug' bir xil tartib beradi", () => {
  const first = shuffleOptions(OPTIONS, "user-1:test-5:savol-9");
  const second = shuffleOptions(OPTIONS, "user-1:test-5:savol-9");

  assert.deepEqual(
    first.map((o) => o.letter),
    second.map((o) => o.letter),
    "sahifa yangilanganda tartib o'zgarmasligi kerak",
  );
});

test("har xil o'quvchida tartib har xil bo'ladi", () => {
  const a = shuffleOptions(OPTIONS, "user-1:test-5:savol-9").map((o) => o.letter);
  const b = shuffleOptions(OPTIONS, "user-2:test-5:savol-9").map((o) => o.letter);

  // Tasodifan mos kelishi mumkin, shuning uchun bir nechta savolni sinaymiz
  const differs = [1, 2, 3, 4, 5].some((n) => {
    const x = shuffleOptions(OPTIONS, `user-1:test-5:savol-${n}`).map((o) => o.letter);
    const y = shuffleOptions(OPTIONS, `user-2:test-5:savol-${n}`).map((o) => o.letter);
    return x.join("") !== y.join("");
  });

  assert.ok(
    differs || a.join("") !== b.join(""),
    "turli o'quvchilarda tartib bir xil bo'lib qolmasligi kerak",
  );
});

test("hamma variant saqlanadi, hech biri yo'qolmaydi", () => {
  const result = shuffleOptions(OPTIONS, "urug");

  assert.equal(result.length, 4);

  assert.deepEqual(
    result.map((o) => o.letter).sort(),
    ["A", "B", "C", "D"],
    "asl harflar to'liq qolishi kerak",
  );

  assert.deepEqual(
    result.map((o) => o.displayLetter),
    ["A", "B", "C", "D"],
    "ko'rsatiladigan harflar tartib bilan berilishi kerak",
  );
});

test("asl harf va matn juftligi buzilmaydi", () => {
  const result = shuffleOptions(OPTIONS, "boshqa-urug");

  for (const option of result) {
    const original = OPTIONS.find((o) => o.letter === option.letter);
    assert.equal(
      option.text,
      original?.text,
      "harf boshqa matnga yopishib qolmasligi kerak",
    );
  }
});

test("“Barchasi to‘g‘ri” bo‘lsa aralashtirilmaydi", () => {
  const withFixed = [
    { letter: "A", text: "12" },
    { letter: "B", text: "24" },
    { letter: "C", text: "36" },
    { letter: "D", text: "Barchasi to‘g‘ri" },
  ];

  const result = shuffleOptions(withFixed, "istalgan-urug");

  assert.deepEqual(
    result.map((o) => o.letter),
    ["A", "B", "C", "D"],
    "bunday variant oxirida qolishi kerak",
  );
});

test("maxsus variantlar tanib olinadi", () => {
  assert.ok(hasFixedOption(["12", "To‘g‘ri javob yo‘q"]));
  assert.ok(hasFixedOption(["Hammasi to‘g‘ri", "5"]));
  assert.ok(hasFixedOption(["Hech biri", "5"]));
  assert.ok(!hasFixedOption(["12", "24", "36"]));
  assert.ok(!hasFixedOption([null, undefined, ""]));
});

test("bitta variant bo‘lsa tegilmaydi", () => {
  const single = [{ letter: "A", text: "12" }];
  assert.deepEqual(shuffleOptions(single, "u").map((o) => o.letter), ["A"]);
});

test("stableShuffle asl ro‘yxatni o‘zgartirmaydi", () => {
  const items = [1, 2, 3, 4, 5];
  stableShuffle(items, "urug");
  assert.deepEqual(items, [1, 2, 3, 4, 5]);
});
