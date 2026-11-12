import "katex/dist/katex.min.css";
import type { Metadata, Viewport } from "next";
import { Geologica } from "next/font/google";
import localFont from "next/font/local";

import SiteNav from "@/components/site-nav";
import SiteJsonLd from "@/components/site-json-ld";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/*
 * Tun rejimi uslublari. Fayl `scripts/build-dark-theme.mjs` orqali
 * yaratiladi va faqat `.dark` selektori ichida ishlaydi — yorug'
 * rejimga umuman ta'sir qilmaydi.
 *
 * Yangi rang klassi qo'shganingizda generatorni qayta ishga tushiring:
 *   node scripts/build-dark-theme.mjs
 */
import "./dark-theme.css";

/*
 * Saytning asosiy manzili.
 *
 * DIQQAT: Vercel'da NEXT_PUBLIC_SITE_URL sozlanmagan bo'lsa, manzil
 * sifatida vercel.app domeni olinadi. U holda Google og:image va
 * canonical havolalarni o'sha domenga qarab oladi va qidiruvda
 * vepa.uz o'rniga vercel.app chiqishi mumkin.
 *
 * Shu sababli oxirgi zaxira qiymat — vepa.uz.
 */
const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.NODE_ENV === "production"
    ? "https://vepa.uz"
    : "http://localhost:3000";

/*
 * Yagona şrift — Geologica: sarlavhada qalin (700–800), matnda 400–600.
 * Bitta oila = bitta fayl: zaif internetda tez oçiladi va sayt bir
 * ovozda gapiradi. ö, ğ, ş, ç harflari bor (latin-ext).
 */
const sans = Geologica({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});

/*
 * Savol matni va formulalar şrifti — CMU Serif (Computer Modern
 * Unicode, LaTeX'ning öz şrifti). Sayt interfeysi Geologica'da qoladi;
 * CMU faqat `.math-content` içida işlatiladi (globals.css,
 * `--font-latex-text`). ö, ğ, ş, ç şriftning özida çizilgan.
 *
 * `preload: false` — fayllar faqat savol bor sahifada yuklanadi.
 * Fayllar kiçraytirilgan (lotin, yunon, matematik belgilar; ~32 KB),
 * qayta yasaş: docs/dizayn.md → "Şrift".
 */
const cmu = localFont({
  src: [
    { path: "../assets/fonts/cmu-serif-regular.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/cmu-serif-italic.woff2", weight: "400", style: "italic" },
    { path: "../assets/fonts/cmu-serif-bold.woff2", weight: "700", style: "normal" },
    { path: "../assets/fonts/cmu-serif-bold-italic.woff2", weight: "700", style: "italic" },
  ],
  display: "swap",
  preload: false,
  variable: "--font-cmu",
  fallback: ["KaTeX_Main", "Latin Modern Roman", "Times New Roman", "serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default:
      "Vepa Ustoz — matematika testlari, videodarslar va darslik yeçimlari",
    template: "%s | Vepa Ustoz",
  },
  description:
    "Vepa Ustoz (vepa.uz) — Attestatsiya, Milliy sertifikat va SAT testlari, videodarslar hamda darslik yeçimlari. Onlayn test işlang, natijangizni köring.",
  applicationName: "Vepa Ustoz",

  // Google qaysi manzilni asosiy deb bilishini aniq aytamiz
  alternates: {
    canonical: "/",
  },

  /*
   * Search Console'ni "HTML tag" usuli bilan tasdiqlash uchun.
   * Kodni Vercel'da NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION o'zgaruvchisiga
   * qo'ysangiz yetarli — kodga tegish shart emas.
   * Sozlanmagan bo'lsa hech qanday teg qo'shilmaydi.
   */
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,

  keywords: [
    "vepa.uz",
    "vepa ustoz",
    "Vepa Kurbankliçev",
    "Vepa Kurbanklichev",
    "matematika",
    "attestatsiya",
    "milliy sertifikat",
    "SAT",
    "videodars",
    "darslik yeçimlari",
    "Vepa Ustoz",
  ],
  authors: [{ name: "Vepa Kurbankliçev" }],
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    url: defaultUrl,
    siteName: "Vepa Ustoz",
    title: "Vepa Ustoz — matematika testlari va videodarslar",
    description:
      "Testlar, videodarslar va darslik yeçimlari — barçasi bir joyda.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vepa Ustoz — matematika platformasi",
    description:
      "Testlar, videodarslar va darslik yeçimlari — barçasi bir joyda.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180" },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Vepa Ustoz",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#080e1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uz"
      // --font-cmu <html> da turadi: globals.css dagi :root uni şunda köradi
      className={cmu.variable}
      suppressHydrationWarning
    >
      <body
        className={`${sans.className} ${sans.variable} antialiased`}
      >
        {/* Qidiruv tizimlari uchun — ekranda ko'rinmaydi */}
        <SiteJsonLd siteUrl={defaultUrl} />

        <ThemeProvider>
          <SiteNav>{children}</SiteNav>
        </ThemeProvider>
      </body>
    </html>
  );
}
