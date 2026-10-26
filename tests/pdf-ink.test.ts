import test from "node:test";
import assert from "node:assert/strict";

import { PDFDocument, degrees } from "pdf-lib";

import {
  applyMatrix,
  blankPageMatrix,
  exportFileName,
  exportInkPdf,
  invertMatrix,
  looksLikePdf,
  simplifyPoints,
  strokeHit,
  strokePath,
  type InkPage,
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
      strokes: [pen([10, 10, 50, 60, 90, 20])],
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
