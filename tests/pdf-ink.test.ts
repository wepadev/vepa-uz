import test from "node:test";
import assert from "node:assert/strict";

import { PDFDocument, degrees } from "pdf-lib";

import {
  applyMatrix,
  blankPageMatrix,
  exportFileName,
  exportInkPdf,
  formatPageRange,
  parsePageRange,
  invertMatrix,
  looksLikePdf,
  InkTrace,
  StrokeInput,
  inkSamples,
  simplifyPoints,
  simplifyStroke,
  strokeHit,
  strokePath,
  textHit,
  textNoteBox,
  type InkPage,
  type TextNote,
  type Matrix,
  type Stroke,
} from "../lib/pdf-ink.ts";

const pen = (points: number[], width = 2): Stroke => ({
  tool: "pen",
  color: "#1B72F2",
  width,
  points,
});

test("teskari matritsa nuqtani joyiga qaytaradi", () => {
  const m: Matrix = [0, 1, 1, 0, -20, 30];
  const inverse = invertMatrix(m);
  const [x, y] = applyMatrix(m, 12, 34);
  const [bx, by] = applyMatrix(inverse, x, y);
  assert.ok(Math.abs(bx - 12) < 1e-9 && Math.abs(by - 34) < 1e-9);
});

test("bo'sh sahifada yuqori chap burchak PDF'da yuqori chapga tushadi", () => {
  assert.deepEqual(applyMatrix(blankPageMatrix(800), 0, 0), [0, 800]);
  assert.deepEqual(applyMatrix(blankPageMatrix(800), 10, 800), [10, 0]);
});

test("o'chirg'ich faqat yaqin chizgiga tegadi", () => {
  const line = pen([0, 0, 100, 0]);
  assert.equal(strokeHit(line, 50, 3, 2), true);
  assert.equal(strokeHit(line, 50, 10, 2), false);
  assert.equal(strokeHit(pen([5, 5]), 6, 6, 1), true);
});

test("silliq yo'l oxirgi nuqtada tugaydi", () => {
  const path = strokePath([0, 0, 10, 10, 20, 0, 30, 10]);
  assert.equal(path[0].kind, "move");
  const last = path[path.length - 1];
  assert.equal(last.kind, "line");
  assert.deepEqual([last.x, last.y], [30, 10]);
  assert.deepEqual(strokePath([]), []);
  assert.equal(strokePath([1, 1]).length, 2);
});

test("yaqin nuqtalar tashlanadi, chetlari qoladi", () => {
  const result = simplifyPoints([0, 0, 0.1, 0, 0.2, 0, 5, 0, 5.1, 0]);
  assert.deepEqual(result, [0, 0, 5, 0, 5.1, 0]);
});

test("bosim nuqtalari bilan birga soddalashtiriladi", () => {
  const result = simplifyStroke([0, 0, 0.1, 0, 5, 0, 9, 0], [0.2, 0.3, 0.6, 0.9]);
  assert.deepEqual(result.points, [0, 0, 5, 0, 9, 0]);
  assert.deepEqual(result.pressures, [0.2, 0.6, 0.9]);
  assert.equal(simplifyStroke([1, 2, 3, 4], undefined).pressures, undefined);
});

test("qalam izi: pero bosimga sezgir, flomaster bir xil", () => {
  const points: number[] = [];
  for (let i = 0; i <= 40; i += 1) points.push(i * 2, 0);

  /* Chizgi o'rtasidagi qalinlik */
  const width = (pressures: number[], kind: "felt" | "fountain") => {
    const samples = inkSamples({ ...pen(points, 4), pen: kind, pressures })!;
    const middle = Math.floor(samples.length / 6) * 3;
    return samples[middle + 2] * 2;
  };

  const light = points.map(() => 0.15);
  const hard = points.map(() => 0.95);

  assert.ok(width(hard, "fountain") > width(light, "fountain") * 1.3);
  assert.equal(width(hard, "felt"), 4);
  assert.equal(width(light, "felt"), 4);

  /* Marker va eski chizgilar oddiy chiziq bo'lib qoladi */
  assert.equal(inkSamples(pen(points)), null);
  assert.equal(inkSamples({ ...pen(points), tool: "marker", pen: "felt" }), null);
});

test("qalam izi: yozish paytidagi shakl tugagandagi bilan bir xil", () => {
  /* Egri-bugri chizgi, bosimi o'zgarib turadi */
  const points: number[] = [];
  const pressures: number[] = [];
  for (let i = 0; i <= 60; i += 1) {
    points.push(i * 3, Math.sin(i / 3) * 20 + (i % 2));
    pressures.push(0.3 + 0.5 * Math.abs(Math.sin(i / 7)));
  }

  for (const kind of ["felt", "fountain", "brush"] as const) {
    const trace = new InkTrace(kind, 2);
    /* Yozish: har nuqtadan keyin `done` faqat o'sadi, oldingisi o'zgarmaydi */
    let before: number[] = [];
    for (let i = 0; i < points.length / 2; i += 1) {
      trace.add(points[i * 2], points[i * 2 + 1], pressures[i]);
      assert.deepEqual(trace.done.slice(0, before.length), before, kind);
      before = trace.done.slice();
    }
    const live = trace.done.concat(trace.tip(true).slice(3));
    assert.deepEqual(live, inkSamples({ ...pen(points, 2), pen: kind, pressures }), kind);
  }
});

test("qalam izi: siyrak nuqtalar orasi silliq to'ldiriladi", () => {
  /* Tez yozilgan yoy: nuqtalar orasi 15 punktdan */
  const points: number[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const angle = (i / 8) * Math.PI;
    points.push(50 - 40 * Math.cos(angle), 50 - 40 * Math.sin(angle));
  }
  const samples = inkSamples({ ...pen(points, 2), pen: "felt" })!;

  let longest = 0;
  let farthest = 0;
  for (let i = 3; i < samples.length; i += 3) {
    longest = Math.max(longest, Math.hypot(samples[i] - samples[i - 3], samples[i + 1] - samples[i - 2]));
    /* Yoy radiusi 40 — egri undan deyarli chetlamaydi (siniq chiziq 0.77 gacha chetlardi) */
    farthest = Math.max(farthest, Math.abs(Math.hypot(samples[i] - 50, samples[i + 1] - 50) - 40));
  }
  assert.ok(longest <= 1.05, `qadam ${longest}`);
  assert.ok(farthest < 0.5, `chetlash ${farthest}`);
});

test("nuqta qabul qilish: yaqinlari tashlanadi, bosim tezlikdan olinadi", () => {
  const input = new StrokeInput(1, false);
  input.add(0, 0, 0, 0);
  assert.equal(input.add(0.1, 0, 0, 1), null);
  /* Oxirgi nuqta yaqin bo'lsa ham olinadi */
  assert.notEqual(input.add(0.2, 0, 0, 2, true), null);
  assert.equal(input.points.length, 4);

  const slow = new StrokeInput(1, false);
  slow.add(0, 0, 0, 0);
  const fast = new StrokeInput(1, false);
  fast.add(0, 0, 0, 0);
  assert.ok(slow.add(2, 0, 0, 16)! > fast.add(30, 0, 0, 16)!);

  /* Stilus: o'z bosimi; ko'tarilishdagi 0 oldingisini saqlaydi */
  const stylus = new StrokeInput(1, true);
  assert.equal(stylus.add(0, 0, 0.42, 0), 0.42);
  assert.equal(stylus.add(5, 0, 0.8, 8), 0.8);
  assert.equal(stylus.add(9, 0, 0, 16), 0.8);
});

test("fayl nomi va PDF belgisi", () => {
  assert.equal(exportFileName("Dars 5.PDF"), "Dars 5-yozuv.pdf");
  assert.equal(exportFileName(".pdf"), "hujjat-yozuv.pdf");
  assert.equal(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n...")), true);
  assert.equal(looksLikePdf(new TextEncoder().encode("PK\u0003\u0004")), false);
});

test("eksport: sahifalar tartibi, bo'sh sahifa va burilgan sahifa saqlanadi", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  const rotated = doc.addPage([842, 595]);
  rotated.setRotation(degrees(90));
  const original = await doc.save();

  const pages: InkPage[] = [
    {
      id: "a",
      source: 0,
      width: 595,
      height: 842,
      toPdf: blankPageMatrix(842),
      background: "blank",
      strokes: [
        pen([10, 10, 50, 60, 90, 20]),
        { ...pen([10, 100, 60, 120, 120, 90], 2), pen: "fountain", pressures: [0.3, 0.8, 0.5] },
      ],
    },
    {
      id: "b",
      source: null,
      width: 595,
      height: 842,
      toPdf: blankPageMatrix(842),
      background: "grid",
      strokes: [{ ...pen([10, 10, 200, 10], 12), tool: "marker", color: "#FACC15" }],
    },
    {
      id: "c",
      source: 1,
      width: 595,
      height: 842,
      toPdf: [0, 1, 1, 0, 0, 0],
      background: "blank",
      strokes: [],
    },
  ];

  const bytes = await exportInkPdf(original, pages);
  assert.equal(looksLikePdf(bytes), true);

  const result = await PDFDocument.load(bytes);
  assert.equal(result.getPageCount(), 3);
  assert.equal(result.getPage(1).getWidth(), 595);
  assert.equal(result.getPage(2).getRotation().angle, 90);
});

test("bet oralig'i o'qiladi va yoziladi", () => {
  assert.deepEqual(parsePageRange("1-3, 5", 10), [0, 1, 2, 4]);
  assert.deepEqual(parsePageRange("8-", 10), [7, 8, 9]);
  assert.deepEqual(parsePageRange("5-3 12 0 abc", 10), [2, 3, 4]);
  assert.deepEqual(parsePageRange("", 10), []);
  assert.equal(formatPageRange([4, 0, 1, 2, 9]), "1-3, 5, 10");
  assert.equal(formatPageRange([]), "");
});

test("yozish paytida chiziq uchi qalamdan orqada qolmaydi", () => {
  for (const kind of ["felt", "fountain", "brush"] as const) {
    const trace = new InkTrace(kind, 3);
    for (let i = 0; i <= 30; i += 1) {
      trace.add(i * 3, 0);
      /* Har nuqtadan keyin uchi aynan qalam turgan joyda */
      const tip = trace.tip();
      assert.equal(tip[tip.length - 3], i * 3, kind);
    }
  }
});

test("stabilizatsiya yo'q: chiziq qalam yurgan yerdan o'tadi", () => {
  /* Keskin zigzag: tepalari y = ±6 */
  const points: number[] = [];
  for (let i = 0; i <= 20; i += 1) points.push(i * 4, i % 2 === 0 ? 6 : -6);

  for (const kind of ["felt", "fountain", "brush"] as const) {
    const samples = inkSamples({ ...pen(points, 1), pen: kind })!;
    /* Har bir asl nuqta namunalar ichida aynan o'zi bo'lib turadi */
    for (let i = 0; i < points.length; i += 2) {
      let found = false;
      for (let k = 0; k < samples.length; k += 3) {
        if (samples[k] === points[i] && samples[k + 1] === points[i + 1]) found = true;
      }
      assert.ok(found, `${kind}: ${points[i]}, ${points[i + 1]}`);
    }
  }
});

test("matn: o'chirg'ich faqat matn ustida tegadi", () => {
  const note: TextNote = { id: "t1", x: 100, y: 200, text: "Javob: 12\nikkinçi qator", color: "#151A23", size: 16 };
  const box = textNoteBox(note);

  assert.equal(box.height, 2 * 16 * 1.25);
  assert.equal(textHit(note, 110, 210, 2), true);
  assert.equal(textHit(note, 50, 210, 2), false);
  assert.equal(textHit(note, 110, 400, 2), false);
});

test("eksport: matn rasm bo'lib sahifaga tushadi", async () => {
  const source = await PDFDocument.create();
  source.addPage([400, 600]);
  const original = await source.save();

  /* 1x1 shaffof PNG */
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

  const pages: InkPage[] = [
    {
      id: "a",
      source: 0,
      width: 400,
      height: 600,
      toPdf: blankPageMatrix(600),
      background: "blank",
      strokes: [],
      texts: [{ id: "t", x: 20, y: 30, text: "Öçirğiç şu", color: "#E11D48", size: 16 }],
    },
  ];

  let rendered = 0;
  const bytes = await exportInkPdf(original, pages, async () => {
    rendered += 1;
    return { png, width: 80, height: 20 };
  });

  assert.equal(rendered, 1);
  const out = await PDFDocument.load(bytes);
  assert.equal(out.getPageCount(), 1);
  /* Sahifa resurslarida rasm (XObject) bor */
  const resources = out.getPage(0).node.Resources();
  assert.ok(resources?.toString().includes("/XObject"));

  /* Bo'sh matn chizilmaydi, renderText berilmasa ham xato bermaydi */
  await exportInkPdf(original, [{ ...pages[0], texts: [{ ...pages[0].texts![0], text: "  " }] }]);
});
