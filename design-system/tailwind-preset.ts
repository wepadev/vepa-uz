/**
 * Vepa Ustoz — Tailwind preset (Tailwind 3.4).
 * tokens.json dan avtomatik yaratilgan. Qiymatlar vepa-tokens.css dagi
 * --vp-* özgaruvçilardan olinadi, şuning uçun yoruğ va qoronği tema bitta joydan.
 */
import type { Config } from "tailwindcss";

const vp = {
  "page": "rgb(var(--vp-page-rgb) / <alpha-value>)",
  "surface": "rgb(var(--vp-surface-rgb) / <alpha-value>)",
  "raised": "rgb(var(--vp-raised-rgb) / <alpha-value>)",
  "surface-soft": "rgb(var(--vp-surface-soft-rgb) / <alpha-value>)",
  "tint": "rgb(var(--vp-tint-rgb) / <alpha-value>)",
  "line": "rgb(var(--vp-line-rgb) / <alpha-value>)",
  "line-strong": "rgb(var(--vp-line-strong-rgb) / <alpha-value>)",
  "ink": "rgb(var(--vp-ink-rgb) / <alpha-value>)",
  "muted": "rgb(var(--vp-muted-rgb) / <alpha-value>)",
  "brand": "rgb(var(--vp-brand-rgb) / <alpha-value>)",
  "brand-strong": "rgb(var(--vp-brand-strong-rgb) / <alpha-value>)",
  "on-brand": "rgb(var(--vp-on-brand-rgb) / <alpha-value>)",
  "hero": "rgb(var(--vp-hero-rgb) / <alpha-value>)",
  "on-hero": "rgb(var(--vp-on-hero-rgb) / <alpha-value>)",
  "hero-deco": "var(--vp-hero-deco)",
  "tone-tests": "rgb(var(--vp-tone-tests-rgb) / <alpha-value>)",
  "tone-tests-soft": "rgb(var(--vp-tone-tests-soft-rgb) / <alpha-value>)",
  "tone-people": "rgb(var(--vp-tone-people-rgb) / <alpha-value>)",
  "tone-people-soft": "rgb(var(--vp-tone-people-soft-rgb) / <alpha-value>)",
  "tone-content": "rgb(var(--vp-tone-content-rgb) / <alpha-value>)",
  "tone-content-soft": "rgb(var(--vp-tone-content-soft-rgb) / <alpha-value>)",
  "tone-insight": "rgb(var(--vp-tone-insight-rgb) / <alpha-value>)",
  "tone-insight-soft": "rgb(var(--vp-tone-insight-soft-rgb) / <alpha-value>)",
  "tone-system": "rgb(var(--vp-tone-system-rgb) / <alpha-value>)",
  "tone-system-soft": "rgb(var(--vp-tone-system-soft-rgb) / <alpha-value>)",
  "success": "rgb(var(--vp-success-rgb) / <alpha-value>)",
  "success-soft": "rgb(var(--vp-success-soft-rgb) / <alpha-value>)",
  "success-line": "rgb(var(--vp-success-line-rgb) / <alpha-value>)",
  "warning": "rgb(var(--vp-warning-rgb) / <alpha-value>)",
  "warning-soft": "rgb(var(--vp-warning-soft-rgb) / <alpha-value>)",
  "warning-line": "rgb(var(--vp-warning-line-rgb) / <alpha-value>)",
  "danger": "rgb(var(--vp-danger-rgb) / <alpha-value>)",
  "danger-soft": "rgb(var(--vp-danger-soft-rgb) / <alpha-value>)",
  "danger-line": "rgb(var(--vp-danger-line-rgb) / <alpha-value>)",
  "medal-gold": "rgb(var(--vp-medal-gold-rgb) / <alpha-value>)",
  "medal-gold-ink": "rgb(var(--vp-medal-gold-ink-rgb) / <alpha-value>)",
  "medal-silver": "rgb(var(--vp-medal-silver-rgb) / <alpha-value>)",
  "medal-silver-ink": "rgb(var(--vp-medal-silver-ink-rgb) / <alpha-value>)",
  "medal-bronze": "rgb(var(--vp-medal-bronze-rgb) / <alpha-value>)",
  "medal-bronze-ink": "rgb(var(--vp-medal-bronze-ink-rgb) / <alpha-value>)",
};

/**
 * Eski mb-* nomlari — mavjud kod özgarmasdan işlaydi.
 * Ataylab YORUĞ qiymatda qotirilgan: tun rejimini avvalgidek
 * app/dark-theme.css boşqaradi (u bg-mb-brand kabi töq tugma
 * fonlarini özgartirmaydi — ustidagi oq matn öqilişi uçun).
 * Temaga qarab özgaradigan yangi klasslar uçun vp-* işlating.
 */
const mb = {
  page: "rgb(244 247 251 / <alpha-value>)", // #f4f7fb
  tint: "rgb(222 234 251 / <alpha-value>)", // #deeafb
  tintSoft: "rgb(237 244 253 / <alpha-value>)", // #edf4fd
  line: "rgb(230 234 240 / <alpha-value>)", // #e6eaf0
  ink: "rgb(21 26 35 / <alpha-value>)", // #151a23
  muted: "rgb(94 107 130 / <alpha-value>)", // #5e6b82
  brand: "rgb(22 103 224 / <alpha-value>)", // #1667e0
  brandDark: "rgb(18 82 184 / <alpha-value>)", // #1252b8
};

const preset = {
  theme: {
    extend: {
      colors: { mb, vp },
      borderRadius: {
        "vp-sm": "var(--vp-radius-sm)",
        "vp-md": "var(--vp-radius-md)",
        "vp-lg": "var(--vp-radius-lg)",
        "vp-xl": "var(--vp-radius-xl)",
        "vp-full": "var(--vp-radius-full)"
      },
      boxShadow: {
        "vp-sm": "var(--vp-shadow-sm)",
        "vp-md": "var(--vp-shadow-md)",
        "vp-tile": "var(--vp-shadow-tile)",
        "vp-lg": "var(--vp-shadow-lg)",
        "vp-focus-ring": "var(--vp-focus-ring)"
      },
      fontSize: {
        "vp-score": "var(--vp-fs-score)",
        "vp-display": "var(--vp-fs-display)",
        "vp-title-lg": "var(--vp-fs-title-lg)",
        "vp-page-title": "var(--vp-fs-page-title)",
        "vp-question": "var(--vp-fs-question)",
        "vp-title": "var(--vp-fs-title)",
        "vp-body": "var(--vp-fs-body)",
        "vp-body-sm": "var(--vp-fs-body-sm)",
        "vp-eyebrow": "var(--vp-fs-eyebrow)",
        "vp-caption": "var(--vp-fs-caption)",
        "vp-tab": "var(--vp-fs-tab)"
      },
      fontFamily: {
        "vp-sans": ["var(--vp-font-sans)"],
        "vp-math": ["var(--vp-font-math)"],
        "vp-mono": ["var(--vp-font-mono)"]
      },
      spacing: {
        "vp-1": "var(--vp-space-1)",
        "vp-2": "var(--vp-space-2)",
        "vp-3": "var(--vp-space-3)",
        "vp-4": "var(--vp-space-4)",
        "vp-5": "var(--vp-space-5)",
        "vp-6": "var(--vp-space-6)",
        "vp-8": "var(--vp-space-8)",
        "vp-12": "var(--vp-space-12)"
      },
      maxWidth: { "vp-content": "var(--vp-content-max)" },
    },
  },
} satisfies Partial<Config>;

export default preset;
