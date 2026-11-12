/**
 * Öz ikonkalarimizni (components/ui/icons.tsx va glyph.tsx) alohida
 * SVG / PNG / WebP fayllarga çiqaradi — Telegram custom emoji uçun.
 *
 *   node scripts/export-icons.mjs <çiqiş-papka>
 *
 * Natija:
 *   svg/          — manba (24×24 yoki 48×48, ranglar qattiq yozilgan)
 *   rangli/       — 100×100 PNG va WebP, şaffof fon, brend ranglari
 *   moslashuvchan/ — 100×100, faqat oq: Telegram'da "adaptive" (matn
 *                    rangiga moslaşadigan) emoji töplami uçun
 *   royxat.csv    — fayl nomi, nomi, tavsiya qilingan emoji
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const out = resolve(process.argv[2] ?? join(root, "icon-export"));

/* ---- 1. TSX -> vaqtinçalik JS ---------------------------------- */
// node_modules içida — react/jsx-runtime topilişi uçun
const tmp = join(root, "node_modules/.cache/vepa-icons");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
writeFileSync(
  join(tmp, "utils.mjs"),
  "export const cn = (...a) => a.filter(Boolean).join(' ');\n",
);
for (const name of ["icons", "glyph"]) {
  const src = readFileSync(join(root, "components/ui", `${name}.tsx`), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText.replace(/["']@\/lib\/utils["']/g, '"./utils.mjs"');
  writeFileSync(join(tmp, `${name}.mjs`), js);
}
const icons = await import(pathToFileURL(join(tmp, "icons.mjs")).href);
const glyph = await import(pathToFileURL(join(tmp, "glyph.mjs")).href);

/* ---- 2. Ranglar ------------------------------------------------ */
const palette = JSON.parse(
  readFileSync(join(root, "design-system/palette.json"), "utf8"),
);
const ACCENT = palette.amber["400"]; // --vp-accent
const THEMES = {
  // Kök çiziq oçiq va qorongi suhbatda ham körinadigan pogonada
  rangli: {
    ink: palette.blue["500"],
    accent: ACCENT,
    glyphInk: palette.blue["500"],
    tint: palette.blue["100"],
    paper: "#ffffff",
  },
  // Hammasi oq — Telegram uni matn rangiga böyaydi
  moslashuvchan: {
    ink: "#ffffff",
    accent: "#ffffff",
    glyphInk: "#ffffff",
    tint: "none",
    paper: "none",
  },
};

function paint(svg, t) {
  return svg
    .replace(/var\(--vi-accent, var\(--vp-accent\)\)/g, t.accent)
    .replace(/var\(--vp-accent\)/g, t.accent)
    .replace(/var\(--vp-brand-strong\)/g, t.glyphInk)
    .replace(/var\(--vp-tint\)/g, t.tint)
    .replace(/var\(--vp-surface\)/g, t.paper)
    .replace(/currentColor/g, t.ink)
    .replace(/ class="[^"]*"/g, "")
    .replace(/ (aria-hidden|focusable)="[^"]*"/g, "");
}

/** Emoji uçun: ikonkani 100×100 ga, kiçik çetlik bilan joylaştirish */
function fit(svg, box) {
  return svg
    .replace(/viewBox="[^"]*"/, `viewBox="${box}"`)
    .replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"');
}

/* ---- 3. Röyxat ------------------------------------------------- */
// Telegram har emoji uçun bitta oddiy emoji söraydi — tavsiyalar
const EMOJI = {
  ChevronRight: "▶️", ChevronLeft: "◀️", ChevronDown: "🔽", ArrowRight: "➡️",
  RotateCcw: "🔄", Download: "⬇️", Send: "📨", Check: "✔️", X: "✖️",
  Plus: "➕", Circle: "⭕", Loader2: "⏳", Search: "🔍", Menu: "📋",
  CheckCircle2: "✅", XCircle: "❌", Info: "ℹ️", AlertTriangle: "⚠️",
  AlertOctagon: "🛑", Lock: "🔒", KeyRound: "🔑", Play: "▶️", Star: "⭐",
  Crown: "👑", Sparkles: "✨", Coins: "🪙", ShoppingBag: "🛍", Save: "💾",
  Compass: "🧭", Sun: "☀️", Moon: "🌙", Clock: "🕒", Timer: "⏱",
  CalendarDays: "📅", CalendarCheck: "📆", CalendarClock: "🗓",
  ClipboardCheck: "📝", ListChecks: "📊", ClipboardList: "📒",
  MonitorPlay: "🎬", BookOpen: "📖", House: "🏠", Users: "👥",
  Minus: "➖", MoreHorizontal: "💬", MinusCircle: "⛔", CircleSlash: "🚫",
  Undo2: "↩️", Redo2: "↪️", History: "🕘", Trash2: "🗑", Pencil: "✏️",
  Settings2: "⚙️", EyeOff: "🙈", Link2: "🔗", Merge: "🔀",
  Maximize2: "⛶", Minimize2: "🔳", FileUp: "📤", FilePlus: "📄",
  ScrollText: "📜", Printer: "🖨", Database: "🗄", BarChart3: "📊",
  TrendingUp: "📈", TrendingDown: "📉", UserPlus: "🙋", Trophy: "🏆",
  Medal: "🏅", Award: "🎖", GraduationCap: "🎓", Gift: "🎁",
  Youtube: "📺", Pause: "⏸", Volume2: "🔊", VolumeX: "🔇", Pen: "🖊",
  PenTool: "✒️", Brush: "🖌", PenLine: "✍️", Highlighter: "🖍",
  Eraser: "🧽", Type: "🔤", Hand: "✋", Grid3x3: "🔢", Ruler: "📏",
  Calculator: "🧮", Backpack: "🎒", Candy: "🍬", Cake: "🎂",
  IceCream: "🍦", Pizza: "🍕", Apple: "🍎", Ticket: "🎟", Gamepad: "🎮",
  Headphones: "🎧", Ball: "⚽", Puzzle: "🧩", Shirt: "👕",
  Smartphone: "📱", Watch: "⌚", Rocket: "🚀",
  // Bölim belgilari
  "belgi-tests": "📝", "belgi-lessons": "🎬", "belgi-solutions": "📖",
  "belgi-homework": "📒", "belgi-group": "👥", "belgi-ranking": "🏆",
  "belgi-shop": "🛍", "belgi-review": "🔁", "belgi-results": "📊",
  "belgi-premium": "👑", "belgi-profile": "👤", "belgi-attestation": "🎖",
  "belgi-certificate": "📜", "belgi-sat": "🎓", "belgi-school": "🏫",
  "belgi-top": "🥇", "belgi-locked": "🔒", "belgi-empty": "🗂",
};

const kebab = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z])([A-Z][a-z])/g, "$1-$2").toLowerCase();

const items = [];
const seen = new Set();
for (const [name, value] of Object.entries(icons)) {
  if (typeof value !== "function" || seen.has(value)) continue;
  if (!/^[A-Z]/.test(name)) continue;
  seen.add(value); // taxallus (NotebookPen = ClipboardList) bir marta
  items.push({
    name,
    file: kebab(value.displayName ?? name),
    raw: renderToStaticMarkup(createElement(value)),
    box: "1.5 1.5 21 21",
  });
}
const glyphNames = [
  ...readFileSync(join(root, "components/ui/glyph.tsx"), "utf8")
    .match(/export type GlyphName =([^;]*);/)[1]
    .matchAll(/"([a-z-]+)"/g),
].map((m) => m[1]);
for (const g of glyphNames) {
  items.push({
    name: `belgi-${g}`,
    file: `belgi-${g}`,
    raw: renderToStaticMarkup(createElement(glyph.Glyph, { name: g })),
    box: "2 2 44 44",
  });
}

/* ---- 4. Fayllar ------------------------------------------------ */
for (const dir of ["svg", "rangli/png", "rangli/webp", "moslashuvchan/png", "moslashuvchan/webp"])
  mkdirSync(join(out, dir), { recursive: true });

const rows = ["raqam,fayl,nomi,emoji"];
let n = 0;
for (const item of items) {
  n += 1;
  const id = `${String(n).padStart(3, "0")}-${item.file}`;
  const source = paint(item.raw, THEMES.rangli).replace(
    "<svg",
    '<svg xmlns="http://www.w3.org/2000/svg"',
  );
  writeFileSync(join(out, "svg", `${id}.svg`), source + "\n");
  for (const [theme, t] of Object.entries(THEMES)) {
    const svg = fit(paint(item.raw, t), item.box);
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 100 } })
      .render()
      .asPng();
    writeFileSync(join(out, theme, "png", `${id}.png`), png);
    await sharp(png)
      .webp({ lossless: true })
      .toFile(join(out, theme, "webp", `${id}.webp`));
  }
  rows.push(`${n},${id},${item.name},${EMOJI[item.name] ?? ""}`);
}
writeFileSync(join(out, "royxat.csv"), rows.join("\n") + "\n");
console.log(`${items.length} ta ikonka -> ${out}`);
