import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

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
       * "Katakli daftar" dizayni (2026-11): saytdagi barça slate-* va
       * blue-* klasslari şu yerda qayta belgilanadi. Kulranglar —
       * qoğoz va qalam (iliq), köklar — logodagi ruçka siyohi.
       * Şunday qilib yuzlab fayllarga teğmasdan butun sayt bir
       * palitraga ötadi. Tun rejimi app/dark-theme.css da.
       */
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        hand: ["var(--font-hand)", "cursive"],
      },
      boxShadow: {
        sm: "0 1px 0 rgb(22 27 40 / 0.04)",
        DEFAULT: "0 1px 2px rgb(22 27 40 / 0.06)",
        md: "0 1px 0 rgb(22 27 40 / 0.04), 0 8px 20px -10px rgb(22 27 40 / 0.22)",
        lg: "0 1px 0 rgb(22 27 40 / 0.04), 0 16px 32px -14px rgb(22 27 40 / 0.28)",
        xl: "0 24px 48px -18px rgb(22 27 40 / 0.32)",
      },
      colors: {
        slate: {
          50: "#f7f5f0",
          100: "#efece5",
          200: "#e3dfd6",
          300: "#ccc7bc",
          400: "#9c9a93",
          500: "#6e6f72",
          600: "#525662",
          700: "#3c4150",
          800: "#262b38",
          900: "#161b28",
          950: "#0d111b",
        },
        blue: {
          50: "#eff2fc",
          100: "#dee5f9",
          200: "#bfccf3",
          300: "#93a8ea",
          400: "#5f7edd",
          500: "#3a5ed3",
          600: "#1d47c9",
          700: "#1638a6",
          800: "#142f85",
          900: "#13296a",
          950: "#0c1a45",
        },
        /* Ustozning qizil ruçkasi — faqat bezak (çizik, belgi), holat emas */
        pen: "#d7362a",
        /* Marker — muhim söz ostidagi sariq çiziq */
        marker: "#ffe27a",
        /*
         * mb-* ranglar endi design-system/tailwind-preset.ts dan keladi
         * (CSS o'zgaruvchilariga bog'langan). Qiymatlarni o'zgartirish:
         * design-system/tokens.json.
         */
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
        /* Daftar uslubi: burçaklar yumşoq, lekin "pufak" emas */
        "2xl": "14px",
        "3xl": "20px",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
