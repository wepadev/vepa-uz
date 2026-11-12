/**
 * Tun rejimi uslublarini yasaydigan generator.
 *
 * MUAMMO: saytda 120 ta faylda ~2000 ta rang klassi bor va bironta ham
 * `dark:` varianti yo'q. Ularni qo'lda yozib chiqish real emas.
 *
 * YECHIM: manba fayllardan ishlatilayotgan rang klasslarini yig'amiz va
 * har biri uchun `.dark` ichida ustma-ust yozuv chiqaramiz. Yorug' rejim
 * mutlaqo tegilmaydi — hamma narsa `.dark` selektori ichida.
 *
 * NIMA UCHUN palitrani almashtirmadik: `bg-blue-600` (tugma foni) va
 * `text-blue-700` (matn) bitta palitradan oladi. Palitrani ag'darsak,
 * tugma foni ochiq ko'k bo'lib, ustidagi oq matn o'qilmay qoladi.
 * Shu sababli har bir xossa (fon / matn / chegara) alohida qaraladi.
 *
 * Ishga tushirish:  node scripts/build-dark-theme.mjs
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

import tailwindColors from "tailwindcss/colors.js";

/*
 * Ranglar Tailwind'ning standart palitrasidan emas, loyihaning öz
 * palitrasidan olinadi (design-system/palette.json — uni
 * scripts/build-palette.mjs yasaydi). Şunda tun rejimi ham yoruğ
 * rejim bilan bitta rang oilasida qoladi.
 */
const palette = JSON.parse(
  readFileSync(join(process.cwd(), "design-system", "palette.json"), "utf8"),
);
const night = palette.night;

const ROOT = process.cwd();
const OUT = join(ROOT, "app", "dark-theme.css");
const SCAN = ["app", "components"];

/* ------------------------------------------------------------------ */
/*  1. Tun rejimi qiymatlari                                           */
/* ------------------------------------------------------------------ */

/** Neytral sirtlar — kulrangning oddiy teskarisi emas, ko'zga yumshoq */
const SURFACE = {
  page: night.page, // sahifa foni
  card: night.card, // karta foni (sahifadan bir oz oçiqroq)
  raised: night.raised, // içki qutilar
  sunken: night.sunken, // ajratuvçi bloklar
  line: night.line, // çegara
  lineSoft: night.lineSoft, // yumşoq çegara
  lineStrong: night.lineStrong, // quyuqroq çegara
};

/** Fon uchun: ochiq ton → quyuq ton */
const BG_STEP = { 50: 950, 100: 900, 200: 800 };

/** Chegara/ring uchun */
const LINE_STEP = { 50: 950, 100: 900, 200: 800, 300: 700 };

/** Matn uchun: quyuq ton → ochiq ton */
const TEXT_STEP = { 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 };

/** Kulrang matn alohida — 500 ham muted sifatida ishlatiladi */
const NEUTRAL_TEXT_STEP = {
  400: 500,
  500: 400,
  600: 300,
  700: 200,
  800: 100,
  900: 50,
  950: 50,
};

const NEUTRAL_BG = {
  50: SURFACE.page,
  100: SURFACE.raised,
  200: SURFACE.sunken,
};

const NEUTRAL_LINE = {
  100: SURFACE.lineSoft,
  200: SURFACE.line,
  300: SURFACE.lineStrong,
  400: SURFACE.lineStrong,
};

const NEUTRALS = new Set(["slate", "gray", "zinc", "neutral", "stone"]);

/** Loyihaning o'z tokenlari */
const MB_DARK = {
  page: SURFACE.page,
  tint: night.tint,
  tintSoft: night.tintSoft,
  line: SURFACE.line,
  ink: night.ink,
  muted: night.muted,
  brand: night.brand, // faqat matn/çegara uçun, fon quyida alohida
  brandDark: night.brandStrong,
};

/* ------------------------------------------------------------------ */
/*  2. Manbadagi klasslarni yig'amiz                                   */
/* ------------------------------------------------------------------ */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(path);
  }
  return out;
}

const files = SCAN.flatMap((d) => walk(join(ROOT, d)));
const source = files.map((f) => readFileSync(f, "utf8")).join("\n");

/**
 * Klass nomlarini ajratamiz. Variantlar (hover:, sm:hover:, focus:)
 * saqlanadi, chunki CSS selektorida ular kerak bo'ladi.
 */
const CLASS_RE =
  /(?:^|[\s"'`{}()])((?:(?:sm|md|lg|xl|2xl|hover|focus|focus-visible|active|disabled|group-hover|dark|print):)*)(bg|from|to|text|border|ring|divide|placeholder|decoration|caret|outline|accent|fill|stroke|shadow)-([a-zA-Z]+)-?(\d{2,3})?(\/\d{1,3})?(?=[\s"'`{}()]|$)/g;

const found = new Map(); // to'liq klass -> {variants, prop, color, step, alpha}

for (const m of source.matchAll(CLASS_RE)) {
  const [, variants, prop, color, step, alpha] = m;
  const full = `${variants}${prop}-${color}${step ? `-${step}` : ""}${alpha ?? ""}`;
  if (!found.has(full)) {
    found.set(full, {
      variants: variants ? variants.slice(0, -1).split(":") : [],
      prop,
      color,
      step: step ? Number(step) : null,
      alpha: alpha ? Number(alpha.slice(1)) : null,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  3. Har bir klass uchun tun qiymati                                 */
/* ------------------------------------------------------------------ */

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function css(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return alpha === null
    ? `rgb(${r} ${g} ${b})`
    : `rgb(${r} ${g} ${b} / ${alpha / 100})`;
}

function paletteHex(color, step) {
  const scale = palette[color] ?? tailwindColors[color];
  if (!scale || typeof scale !== "object") return null;
  return scale[step] ?? null;
}

/** Klass tun rejimida qanday qiymat olishi kerak — bilmasak null */
function darkValue({ prop, color, step, alpha }) {
  // Loyiha tokenlari
  if (color === "mb") return null; // mb-* pastda alohida

  const isNeutral = NEUTRALS.has(color);

  /*
   * --- FON VA GRADIYENT UCHLARI ---
   *
   * `from-amber-50 to-orange-50` kabi ochiq gradientlar tun rejimida
   * ham oq bo'lib qolardi va ustidagi matn o'qilmasdi. Endi ular ham
   * fon kabi quyuq tomonga o'giriladi.
   *
   * `via-` ataylab qoldirilgan: Tailwind uni alohida o'zgaruvchiga
   * emas, `--tw-gradient-stops` ichiga to'g'ridan-to'g'ri yozadi,
   * ya'ni bitta qiymat bilan almashtirib bo'lmaydi.
   */
  if (prop === "bg" || prop === "from" || prop === "to") {
    if (color === "white") {
      /*
       * Past shaffoflikdagi oq (bg-white/10, /15, /20) — bu sirt emas,
       * quyuq gradient hero ustidagi yorug' parda. Uni quyuq qilsak
       * ko'rinmay qoladi, shuning uchun tegilmaydi.
       */
      if (alpha !== null && alpha < 50) return null;
      return css(SURFACE.card, alpha);
    }
    if (color === "black") return null;
    if (step === null) return null;

    if (isNeutral) {
      // Quyuq kulrang fonlar (900/950) allaqachon tun uchun mos
      if (step >= 700) return null;
      const hex = NEUTRAL_BG[step];
      return hex ? css(hex, alpha) : null;
    }

    // Rangli tint'lar: ochiq → quyuq. To'q ranglar (tugmalar) tegilmaydi.
    const target = BG_STEP[step];
    if (!target) return null;
    const hex = paletteHex(color, target);
    return hex ? css(hex, alpha) : null;
  }

  // --- MATN ---
  if (prop === "text" || prop === "placeholder" || prop === "decoration") {
    if (color === "white" || color === "black") return null;
    if (step === null) return null;

    const map = isNeutral ? NEUTRAL_TEXT_STEP : TEXT_STEP;
    const target = map[step];
    if (!target) return null; // ochiq ranglar (100-300) quyuq fonda qoladi
    const hex = paletteHex(color, target);
    return hex ? css(hex, alpha) : null;
  }

  // --- CHEGARA / RING / DIVIDE ---
  if (prop === "border" || prop === "ring" || prop === "divide") {
    if (color === "white" || color === "black") return null;
    if (step === null) return null;

    if (isNeutral) {
      const hex = NEUTRAL_LINE[step];
      return hex ? css(hex, alpha) : null;
    }

    const target = LINE_STEP[step];
    if (!target) return null;
    const hex = paletteHex(color, target);
    return hex ? css(hex, alpha) : null;
  }

  return null;
}

const CSS_PROP = {
  bg: "background-color",
  from: "--tw-gradient-from",
  to: "--tw-gradient-to",
  text: "color",
  placeholder: "color",
  decoration: "text-decoration-color",
  border: "border-color",
  ring: "--tw-ring-color",
  divide: "border-color",
};

/** Tailwind klass nomini CSS selektoriga aylantiradi */
function selector(full, info) {
  const escaped = full
    .replace(/([:/.])/g, "\\$1")
    .replace(/\\:/g, "\\:"); // : va / oldiga backslash

  let sel = `.dark .${escaped}`;

  for (const v of info.variants) {
    if (v === "hover") sel += ":hover";
    else if (v === "focus") sel += ":focus";
    else if (v === "focus-visible") sel += ":focus-visible";
    else if (v === "active") sel += ":active";
    else if (v === "disabled") sel += ":disabled";
  }

  if (info.prop === "placeholder") sel += "::placeholder";
  if (info.prop === "divide") sel += " > :not([hidden]) ~ :not([hidden])";

  return sel;
}

const MEDIA = { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" };

const plain = [];
const byMedia = new Map();
let skipped = 0;

for (const [full, info] of found) {
  if (info.variants.includes("dark") || info.variants.includes("print")) continue;
  if (info.variants.includes("group-hover")) continue;

  const value = darkValue(info);

  if (value === null) {
    skipped++;
    continue;
  }

  const rule = `${selector(full, info)} { ${CSS_PROP[info.prop]}: ${value}; }`;
  const bp = info.variants.find((v) => MEDIA[v]);

  if (bp) {
    if (!byMedia.has(bp)) byMedia.set(bp, []);
    byMedia.get(bp).push(rule);
  } else {
    plain.push(rule);
  }
}

/* ------------------------------------------------------------------ */
/*  4. Faylni yozamiz                                                  */
/* ------------------------------------------------------------------ */

const mbRules = [];

/*
 * mb-* tokenlari yuqoridagi umumiy regexga tushmaydi (ular `mb-page`
 * kabi ikki qismli), shuning uchun alohida qidiramiz.
 */
const usedMb = new Set();

for (const m of source.matchAll(
  /\b(bg|text|border|ring|divide)-mb-([A-Za-z]+)\b/g,
)) {
  usedMb.add(`${m[1]}-mb-${m[2]}`);
}

function hasMb(cls) {
  return usedMb.has(cls);
}

for (const [name, hex] of Object.entries(MB_DARK)) {
  if (hasMb(`text-mb-${name}`)) {
    mbRules.push(`.dark .text-mb-${name} { color: ${css(hex, null)}; }`);
  }
  if (hasMb(`border-mb-${name}`)) {
    mbRules.push(
      `.dark .border-mb-${name} { border-color: ${css(hex, null)}; }`,
    );
  }
  if (hasMb(`ring-mb-${name}`)) {
    mbRules.push(
      `.dark .ring-mb-${name} { --tw-ring-color: ${css(hex, null)}; }`,
    );
  }
  if (hasMb(`divide-mb-${name}`)) {
    mbRules.push(
      `.dark .divide-mb-${name} > :not([hidden]) ~ :not([hidden]) { border-color: ${css(hex, null)}; }`,
    );
  }
}

// mb fonlari: brand tugma foni bo'lgani uchun ataylab tegilmaydi
for (const name of ["page", "tint", "tintSoft", "line"]) {
  if (hasMb(`bg-mb-${name}`)) {
    mbRules.push(
      `.dark .bg-mb-${name} { background-color: ${css(MB_DARK[name], null)}; }`,
    );
  }
}

const header = `/*
 * AVTOMATIK YARATILGAN — qo'lda tahrirlamang.
 * Yangilash uchun:  node scripts/build-dark-theme.mjs
 * Qo'lda yoziladigan qoidalar: scripts/dark-theme-extras.css
 *
 * Bu fayl faqat .dark selektori ichida ishlaydi, shuning uchun
 * yorug' rejimga umuman ta'sir qilmaydi.
 *
 * Qamrov: ${found.size} ta rang klassi topildi,
 *         ${plain.length + [...byMedia.values()].flat().length} tasiga tun qiymati berildi,
 *         ${skipped} tasi ataylab o'zgarishsiz qoldirildi
 *         (to'q tugma fonlari, oq matn, gradient heroylar).
 */
`;

let out = header + "\n";

/*
 * Hammasi `@media screen` ichida.
 *
 * Sababi: natijalarni qog'ozga chiqarish imkoniyati bor. Tun rejimi
 * yoqilgan holda chop etilsa, sahifa qop-qora bo'lib, siyoh behuda
 * sarflanardi. Bu o'ram bilan chop etishda doim yorug' variant
 * ishlatiladi — alohida hech narsa yozish shart emas.
 */
out += "@media screen {\n\n";

out += "/* --- Loyiha tokenlari --- */\n";
out += mbRules.join("\n") + "\n\n";

out += "/* --- Umumiy --- */\n";
out += plain.sort().join("\n") + "\n";

out += "\n}\n";

for (const [bp, rules] of byMedia) {
  out += `\n@media screen and (min-width: ${MEDIA[bp]}) {\n`;
  out += rules
    .sort()
    .map((r) => "  " + r)
    .join("\n");
  out += "\n}\n";
}

/*
 * Qöl bilan yozilgan qöşimça qoidalar. Generator har safar faylni
 * boşidan yozadi, şuning uçun qölda yozilgan narsa şu alohida faylda
 * turadi va oxiriga ulanadi — qayta işga tuşirsangiz yöqolmaydi.
 */
const EXTRAS = join(ROOT, "scripts", "dark-theme-extras.css");

if (existsSync(EXTRAS)) {
  out += "\n" + readFileSync(EXTRAS, "utf8");
}

writeFileSync(OUT, out);

console.log(`Topilgan rang klasslari : ${found.size}`);
console.log(`Tun qiymati berildi     : ${plain.length + [...byMedia.values()].flat().length}`);
console.log(`O'zgarishsiz qoldirildi : ${skipped}`);
console.log(`Yozildi                 : app/dark-theme.css`);
