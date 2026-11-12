import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

import palette from "./design-system/palette.json";
import vepaPreset from "./design-system/tailwind-preset";

export default {
  /*
   * Vepa Ustoz dizayn tizimi: mb-* va vp-* ranglar, burchaklar,
   * soyalar va shrift o'lchamlari shu presetdan keladi. Qiymatlar
   * design-system/vepa-tokens.css dagi --vp-* o'zgaruvchilarda,
   * shuning uchun yorug' va tun rejimi bitta joydan boshqariladi.
   */
  presets: [vepaPreset],
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /*
       * Palitra design-system/palette.json dan (scripts/build-palette.mjs
       * yasaydi). Tailwind'ning tayyor slate/blue/amber/emerald/red
       * ranglari örniga bitta formuladan çiqqan ranglar qöyiladi —
       * şunda eski klasslar ham (bg-blue-50, text-slate-600 ...) özi
       * yangi, mutanosib palitraga ötadi. Tun rejimi: app/dark-theme.css.
       */
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sm: "0 1px 0 rgb(12 20 38 / 0.04)",
        DEFAULT: "0 1px 2px rgb(12 20 38 / 0.06)",
        md: "0 6px 16px -8px rgb(12 20 38 / 0.18)",
        lg: "0 14px 30px -14px rgb(12 20 38 / 0.24)",
        xl: "0 24px 48px -18px rgb(12 20 38 / 0.3)",
        /* Bosiladigan elementning pastki qirrasi */
        edge: "0 3px 0 0 rgb(var(--vp-line-rgb))",
      },
      colors: {
        slate: palette.slate,
        blue: palette.blue,
        amber: palette.amber,
        emerald: palette.emerald,
        red: palette.red,
        violet: palette.violet,
        teal: palette.teal,
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "16px",
        "3xl": "22px",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
