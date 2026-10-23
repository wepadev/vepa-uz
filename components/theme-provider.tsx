"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * Kun/tun rejimi.
 *
 * `attribute="class"` — <html> ga `dark` klassi qo'yiladi, Tailwind
 * shu klass orqali ishlaydi (tailwind.config.ts: darkMode: ["class"]).
 *
 * `defaultTheme="light"` va `enableSystem={false}` — birinchi kirgan
 * foydalanuvchi doim yorug' rejimda ko'radi. Telefon sozlamasi tun
 * rejimida bo'lsa ham sayt o'zgarmaydi; tun rejimini faqat
 * foydalanuvchi o'zi tugma orqali yoqadi.
 *
 * Tanlov localStorage'da saqlanadi, shuning uchun keyingi tashriflarda
 * o'sha rejim ochiladi.
 *
 * `disableTransitionOnChange` — almashish paytida hamma element
 * bir vaqtda animatsiya qilib miltillamasligi uchun.
 */
export function ThemeProvider({
  children,
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

export default ThemeProvider;
