import "katex/dist/katex.min.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

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

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default:
      "Vepa Ustoz — matematika testlari, videodarslar va darslik yechimlari",
    template: "%s | Vepa Ustoz",
  },
  description:
    "Vepa Ustoz (vepa.uz) — Attestatsiya, Milliy sertifikat va SAT testlari, videodarslar hamda darslik yechimlari. Onlayn test ishlang, natijangizni ko‘ring.",
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
    "Vepa Kurbanklichev",
    "matematika",
    "attestatsiya",
    "milliy sertifikat",
    "SAT",
    "videodars",
    "darslik yechimlari",
    "Vepa Ustoz",
  ],
  authors: [{ name: "Vepa Kurbanklichev" }],
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    url: defaultUrl,
    siteName: "Vepa Ustoz",
    title: "Vepa Ustoz — matematika testlari va videodarslar",
    description:
      "Testlar, videodarslar va darslik yechimlari — barchasi bir joyda.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vepa Ustoz — matematika platformasi",
    description:
      "Testlar, videodarslar va darslik yechimlari — barchasi bir joyda.",
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
  themeColor: "#1B72F2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uz"
      suppressHydrationWarning
    >
      <body
        className={`${inter.className} ${inter.variable} antialiased`}
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
