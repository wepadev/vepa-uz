import { readdirSync } from "node:fs";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";
import * as tikzjax from "node-tikzjax";

/*
 * Bu fayl `server-only` ni import qilmaydi: uni Next'dan tashqarida
 * (scripts/import-tex-mavzular.ts) ham ishlatamiz. Next ichida
 * `lib/tex-chizma.ts` orqali chaqiring.
 *
 * TikZ chizmani PNG rasmga aylantirish — SERVERDA, LaTeX'siz.
 *
 * `node-tikzjax` — WebAssembly'ga tuzilgan TeX: tikz, pgf,
 * amsmath bilan birga keladi, kompyuterda yoki Vercel'da LaTeX
 * o'rnatish shart emas. U SVG beradi, `resvg` esa SVG'ni PNG ga
 * aylantiradi (savol rasmlari bucket'i faqat PNG/JPG/WEBP oladi).
 *
 * SVG ichidagi harflar `cmr10`, `cmmi10` kabi Computer Modern
 * shriftlarida yozilgan — ular `node-tikzjax` paketida bor,
 * resvg'ga o'shalar beriladi. Shuning uchun rasmdagi yozuv
 * kitobdagi bilan bir xil ko'rinadi.
 */

/*
 * Paket CommonJS: Next'da `default` — funksiyaning o'zi, toza
 * Node ESM'da esa `module.exports` (funksiya uning `.default` ida).
 */
type Tex2Svg = typeof tikzjax.default;
const tex2svg: Tex2Svg =
  (tikzjax.default as unknown as { default?: Tex2Svg }).default ??
  tikzjax.default;

/** Rasm piksel zichligi: 1 pt = 2.5 px — telefonda ham tiniq, hajmi ham kichik */
const ZOOM = 2.5;

let fontFiles: string[] | null = null;

function fonts(): string[] {
  if (fontFiles) return fontFiles;

  /*
   * `require.resolve` ishlatilmaydi: Next yig'ganda u yo'l emas,
   * modul raqamini qaytaradi. Vercel'da ham fayllar loyiha
   * ildiziga nisbatan o'sha joyda turadi (next.config.ts dagi
   * `outputFileTracingIncludes`).
   */
  const folder = join(
    process.cwd(),
    "node_modules",
    "node-tikzjax",
    "css",
    "bakoma",
    "ttf",
  );

  fontFiles = readdirSync(folder)
    .filter((name) => name.endsWith(".ttf"))
    .map((name) => join(folder, name));

  return fontFiles;
}

/*
 * TeX dvigateli bitta: ikki chizma bir vaqtda chizilsa bir-birini
 * buzadi. Shuning uchun ular navbat bilan chiziladi.
 */
let queue: Promise<unknown> = Promise.resolve();

function inTurn<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

/**
 * `figureDocument` bergan hujjatni PNG ga aylantirish.
 *
 * Xato bo'lsa (TeX tushunmagan buyruq) — istisno otiladi;
 * chaqiruvchi savolni rasmsiz qoldirib, eslatma yozadi.
 */
export async function renderFigure(document: string): Promise<Buffer> {
  const svg = await inTurn(() =>
    tex2svg(document, {
      texPackages: { amsmath: "", amssymb: "" },
    }),
  );

  if (!/<svg[\s>]/.test(svg) || !/<(path|text|rect|circle)\b/.test(svg)) {
    throw new Error("çizma böş çiqdi");
  }

  const image = new Resvg(svg, {
    fitTo: { mode: "zoom", value: ZOOM },
    background: "white",
    font: { fontFiles: fonts(), loadSystemFonts: false },
  });

  return Buffer.from(image.render().asPng());
}
