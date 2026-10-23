import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    /*
     * Tekshirilmaydigan papkalar.
     *
     * `backups/` — eski fayllarning aynan nusxalari. Ularni ham
     * tekshirish `npm run check` ni bir necha barobar
     * sekinlashtiradi va allaqachon tuzatilgan eski xatolarni
     * qayta ko'rsatadi.
     *
     * `.claude/`, `.agents/`, `.codex/`, `.impeccable/` — yordamchi
     * dasturlarning (Claude Code skill'lari) o'z kodi. U bizning
     * kodimiz emas, uni tuzatish ham bizning ishimiz emas: har
     * yangilanishda xatolar qaytib keladi. Ularsiz `npm run check`
     * faqat saytning o'z kodini ko'rsatadi.
     */
    ignores: [
      "backups/**",
      ".next/**",
      "out/**",
      ".claude/**",
      ".agents/**",
      ".codex/**",
      ".impeccable/**",
      "Claude outputs/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      /*
       * Pastki chiziq bilan boshlangan nom — "bu qiymat ataylab
       * ishlatilmaydi" degani. Bu obyektdan bitta maydonni olib
       * tashlashning odatiy usuli:
       *
       *   const { id: _id, ...rest } = row;
       *
       * Bunday nomlarga ogohlantirish bermaymiz.
       */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
