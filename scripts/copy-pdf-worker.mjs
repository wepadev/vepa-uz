/**
 * pdf.js worker faylini `public/` ga ko'chirish.
 *
 * Admin paneldagi "PDF yozuv" bo'limi PDF sahifalarini brauzerda
 * chizadi. pdf.js og'ir ishni alohida worker'da qiladi va u oddiy
 * fayl sifatida yuklanishi kerak — Turbopack uni o'zi yig'a
 * olmaydi. Shuning uchun `npm run dev` va `npm run build` dan
 * oldin fayl `node_modules` dan `public/pdfjs/` ga nusxalanadi.
 *
 * Fayl repoga qo'shilmaydi (.gitignore): u paket bilan bir xil
 * versiyada bo'lishi shart, aks holda pdf.js xato beradi.
 */
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const source = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const targetDir = join(root, "public", "pdfjs");

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, "pdf.worker.min.mjs"));

/*
 * MathLive shriftlari (mock testdagi matematik klaviatura).
 *
 * MathLive formulani öz KaTeX shriftlari bilan çizadi va ularni
 * `MathfieldElement.fontsDirectory` dan yuklaydi. Bundler bu
 * fayllarni özi topa olmaydi, şuning uçun ular ham `public/` ga
 * nusxalanadi (components/math-answer-field.tsx: /mathlive/fonts).
 */
const mathliveFonts = join(root, "node_modules", "mathlive", "fonts");
const mathliveTarget = join(root, "public", "mathlive", "fonts");

mkdirSync(mathliveTarget, { recursive: true });
for (const name of readdirSync(mathliveFonts)) {
  copyFileSync(join(mathliveFonts, name), join(mathliveTarget, name));
}
