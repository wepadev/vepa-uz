import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vepa.uz";

/**
 * Qidiruv tizimlari uchun qoidalar.
 *
 * Saytning ko'p qismi tizimga kirishni talab qiladi va u yerda
 * shaxsiy ma'lumot bor — natijalar, profil, admin panel. Ularni
 * indekslashdan ataylab to'sib qo'yamiz: Google ularga baribir
 * kira olmaydi, lekin so'rov yubormagani ma'qul.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/auth",
        "/profile",
        "/results",
        "/homework",
        "/takrorlash",
        "/mock",
        "/guruhim",
        "/dokon",
        "/payment",
        "/tests/take",
        "/access-denied",
        "/access-required",
        "/ota-ona",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
