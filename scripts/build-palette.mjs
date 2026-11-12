/**
 * Vepa Ustoz palitrasi — bitta formuladan.
 *
 * MUAMMO: Tailwind'ning tayyor ranglari (slate, blue, amber, emerald,
 * red) alohida-alohida çizilgan: har birining yoruğligi va
 * töyinganligi boşqaça. Yonma-yon turganda "ola-çipor" körinadi.
 *
 * YEÇIM: hamma rang OKLCH fazosida bitta jadvaldan yasaladi.
 *   - yoruğlik (L) pogonasi hamma rangda bir xil;
 *   - töyinganlik (C) egri çizigi bir xil, faqat çöqqisi rangga qarab;
 *   - tus (H) — logodagi kobalt kök (264°) atrofida tanlangan:
 *       slate   264°  kulrang ham şu tusda, juda past töyinganlikda
 *       blue    264°  brend
 *       amber    78°  kökning qarama-qarşisi (yutuq, tanga, Premium)
 *       emerald 158°  toğri javob
 *       red      24°  xato
 *       violet  296°  faqat admin grafiklari
 *       teal    200°  faqat admin belgilari
 *
 * Işga tuşiriş:  node scripts/build-palette.mjs
 * Natija:        design-system/palette.json  (Tailwind va tun rejimi
 *                generatori şu fayldan öqiydi), hamda tokens.json,
 *                vepa-tokens.css va tailwind-preset.ts dagi rang
 *                qiymatlari yangilanadi.
 * Keyin:         node scripts/build-dark-theme.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** Hamma rang uçun umumiy yoruğlik pogonasi */
const L = {
  50: 0.978, 100: 0.955, 200: 0.915, 300: 0.85, 400: 0.74, 500: 0.63,
  600: 0.535, 700: 0.455, 800: 0.385, 900: 0.315, 950: 0.235,
};

/** Töyinganlik egri çizigi (çöqqiga nisbatan ulush) */
const C = {
  50: 0.1, 100: 0.2, 200: 0.36, 300: 0.58, 400: 0.84, 500: 1,
  600: 1, 700: 0.92, 800: 0.8, 900: 0.66, 950: 0.5,
};

/**
 * Sariq-zarğaldoq tabiatan yoruğ: 63% yoruğlikda u jigarrangga
 * aylanadi. Şuning uçun amber pogonasi yuqoriroq — lekin egri çiziq
 * şakli öşa.
 */
const L_WARM = {
  50: 0.982, 100: 0.962, 200: 0.925, 300: 0.88, 400: 0.835, 500: 0.775,
  600: 0.67, 700: 0.555, 800: 0.47, 900: 0.4, 950: 0.28,
};

/** Kulrangning töq uçi qoraroq — matn siyohi aniq öqilsin */
const L_NEUTRAL = {
  ...L,
  600: 0.5, 700: 0.42, 800: 0.335, 900: 0.26, 950: 0.195,
};

const HUES = {
  slate: { h: 264, peak: 0.026, neutral: true, L: L_NEUTRAL },
  blue: { h: 264, peak: 0.215 },
  amber: { h: 78, peak: 0.165, L: L_WARM },
  emerald: { h: 158, peak: 0.135 },
  red: { h: 24, peak: 0.2 },
  violet: { h: 296, peak: 0.19 },
  teal: { h: 200, peak: 0.105 },
};

/** Kulrang: oqiş uçlari deyarli rangsiz, töq uçi siyoh-kök */
const C_NEUTRAL = {
  50: 0.2, 100: 0.3, 200: 0.42, 300: 0.6, 400: 0.85, 500: 1,
  600: 1.1, 700: 1.25, 800: 1.4, 900: 1.55, 950: 1.5,
};

/* ---------- OKLCH → sRGB ---------- */

function oklchToLinear(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L3 = l_ ** 3;
  const M3 = m_ ** 3;
  const S3 = s_ ** 3;

  return [
    4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3,
    -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3,
    -0.0041960863 * L3 - 0.7034186147 * M3 + 1.707614701 * S3,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

const gamma = (v) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055;

/** Ekran körsata olmaydigan rang bölsa — töyinganlikni kamaytiramiz */
function toHex(l, c, h) {
  let chroma = c;
  let rgb = oklchToLinear(l, chroma, h);

  while (!inGamut(rgb) && chroma > 0) {
    chroma -= 0.002;
    rgb = oklchToLinear(l, chroma, h);
  }

  return (
    "#" +
    rgb
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, gamma(v))) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

const palette = {};

for (const [name, spec] of Object.entries(HUES)) {
  const lightness = spec.L ?? L;
  const curve = spec.neutral ? C_NEUTRAL : C;

  palette[name] = Object.fromEntries(
    STEPS.map((step) => [
      step,
      toHex(lightness[step], spec.peak * curve[step], spec.h),
    ]),
  );
}

/*
 * Tun rejimi sirtlari — öşa tusda (264°), past yoruğlikda.
 * Kartalar sahifadan biroz oçiqroq: çuqurlik soya bilan emas,
 * yoruğlik bilan beriladi.
 */
palette.night = {
  page: toHex(0.165, 0.028, 264),
  card: toHex(0.215, 0.032, 264),
  raised: toHex(0.255, 0.034, 264),
  sunken: toHex(0.3, 0.036, 264),
  line: toHex(0.31, 0.034, 264),
  lineSoft: toHex(0.265, 0.032, 264),
  lineStrong: toHex(0.39, 0.034, 264),
  ink: toHex(0.95, 0.008, 264),
  muted: toHex(0.74, 0.024, 264),
  brand: toHex(0.72, 0.15, 264),
  brandStrong: toHex(0.82, 0.1, 264),
  tint: toHex(0.3, 0.085, 264),
  tintSoft: toHex(0.245, 0.06, 264),
};

const out = join(process.cwd(), "design-system", "palette.json");
writeFileSync(out, JSON.stringify(palette, null, 2) + "\n");

console.log(`✓ ${out}`);

/* ------------------------------------------------------------------ */
/*  Ma'noli tokenlar: --vp-* (yoruğ / tun)                             */
/* ------------------------------------------------------------------ */

const { slate, blue, amber, emerald, red, violet, night } = palette;

/** nom → [yoruğ, tun, izoh] */
const SEMANTIC = {
  page: [slate[50], night.page],
  surface: ["#ffffff", night.card],
  raised: [slate[100], night.raised],
  "surface-soft": [blue[50], night.tintSoft],
  tint: [blue[100], night.tint],
  line: [slate[200], night.line],
  "line-strong": [slate[400], night.lineStrong],
  ink: [slate[900], night.ink],
  muted: [slate[600], night.muted],
  brand: [blue[600], night.brand],
  "brand-strong": [blue[700], night.brandStrong],
  "brand-edge": [blue[800], blue[600], "Kök tugmaning pastki qirrasi (bosiladigan çuqurlik)."],
  "on-brand": ["#ffffff", night.page],
  accent: [amber[400], amber[400], "Yagona iliq urğu: yutuq, tanga, Premium, belgi içidagi nuqta."],
  "accent-strong": [amber[700], amber[300], "Urğu rangidagi matn."],
  "accent-soft": [amber[50], amber[950], "Urğu foni."],
  "accent-edge": [amber[600], amber[600], "Sariq tugmaning pastki qirrasi."],
  "on-accent": [slate[950], slate[950], "Sariq fon ustidagi matn."],
  hero: [blue[600], night.tint],
  "on-hero": ["#ffffff", "#ffffff"],
  "tone-tests": [blue[700], blue[300]],
  "tone-tests-soft": [blue[50], night.tintSoft],
  "tone-people": [emerald[700], emerald[300]],
  "tone-people-soft": [emerald[50], emerald[950]],
  "tone-content": [amber[700], amber[300]],
  "tone-content-soft": [amber[50], amber[950]],
  "tone-insight": [violet[700], violet[300]],
  "tone-insight-soft": [violet[50], violet[950]],
  "tone-system": [slate[600], slate[300]],
  "tone-system-soft": [slate[100], night.raised],
  success: [emerald[700], emerald[400]],
  "success-soft": [emerald[50], emerald[950]],
  "success-line": [emerald[200], emerald[800]],
  warning: [amber[700], amber[400]],
  "warning-soft": [amber[50], amber[950]],
  "warning-line": [amber[300], amber[800]],
  danger: [red[700], red[400]],
  "danger-soft": [red[50], red[950]],
  "danger-line": [red[200], red[800]],
  "medal-gold": [amber[100], amber[900]],
  "medal-gold-ink": [amber[800], amber[300]],
  "medal-silver": [slate[200], night.sunken],
  "medal-silver-ink": [slate[700], slate[200]],
  "medal-bronze": [amber[300], amber[800]],
  "medal-bronze-ink": [amber[950], amber[100]],
};

const rgbTriple = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

const dir = join(process.cwd(), "design-system");

/* --- vepa-tokens.css --- */
{
  const file = join(dir, "vepa-tokens.css");
  let [root, dark] = readFileSync(file, "utf8").split(".dark {");

  const put = (block, name, hex) => {
    const decl = `  --vp-${name}: ${hex};\n  --vp-${name}-rgb: ${rgbTriple(hex)};\n`;
    const re = new RegExp(
      `  --vp-${name}: [^;]+;\\n  --vp-${name}-rgb: [^;]+;\\n`,
    );
    return re.test(block)
      ? block.replace(re, decl)
      : block.replace(/(  --vp-shadow-sm:)/, `${decl}$1`);
  };

  for (const [name, [light, night_]] of Object.entries(SEMANTIC)) {
    root = put(root, name, light);
    dark = put(dark, name, night_);
  }

  writeFileSync(file, `${root}.dark {${dark}`);
  console.log(`✓ ${file}`);
}

/* --- tokens.json --- */
{
  const file = join(dir, "tokens.json");
  const tokens = JSON.parse(readFileSync(file, "utf8"));
  const list = tokens.color.tokens;

  for (const [name, [light, dark, usage]] of Object.entries(SEMANTIC)) {
    const found = list.find((token) => token.name === name);

    if (found) found.value = { light, dark };
    else list.push({ name, value: { light, dark }, usage: usage ?? "" });
  }

  tokens.color.palette = Object.fromEntries(
    Object.entries(palette).filter(([name]) => name !== "night"),
  );

  writeFileSync(file, JSON.stringify(tokens, null, 2) + "\n");
  console.log(`✓ ${file}`);
}

/* --- tailwind-preset.ts: eski mb-* nomlari va yangi vp-* qatorlari --- */
{
  const file = join(dir, "tailwind-preset.ts");
  let source = readFileSync(file, "utf8");

  const mb = {
    page: slate[50],
    tint: blue[100],
    tintSoft: blue[50],
    line: slate[200],
    ink: slate[900],
    muted: slate[600],
    brand: blue[600],
    brandDark: blue[700],
  };

  source = source.replace(
    /const mb = \{[\s\S]*?\n\};/,
    `const mb = {\n${Object.entries(mb)
      .map(
        ([name, hex]) =>
          `  ${name}: "rgb(${rgbTriple(hex)} / <alpha-value>)", // ${hex}`,
      )
      .join("\n")}\n};`,
  );

  for (const name of Object.keys(SEMANTIC)) {
    if (!source.includes(`"${name}": "rgb(var(--vp-${name}-rgb)`)) {
      source = source.replace(
        /(\n  "medal-bronze-ink": [^\n]+\n)/,
        `$1  "${name}": "rgb(var(--vp-${name}-rgb) / <alpha-value>)",\n`,
      );
    }
  }

  writeFileSync(file, source);
  console.log(`✓ ${file}`);
}
