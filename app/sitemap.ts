import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vepa.uz";

/**
 * Sayt xaritasi.
 *
 * Bu yerda faqat ochiq sahifalar bor: bosh sahifa va tariflar. Testlar, darslar va yechimlar
 * ataylab qo'shilmagan: ular tizimga kirmagan foydalanuvchini login
 * sahifasiga yo'naltiradi, ya'ni Google ularni baribir o'qiy olmaydi.
 * Yo'q sahifani xaritaga yozish esa indekslash xatolariga olib keladi.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  /*
   * Kirish sahifasi ataylab yo'q: robots.txt da /auth taqiqlangan.
   * Ikkalasida turli javob bo'lsa Search Console "Submitted URL
   * blocked by robots.txt" xatosini beradi.
   */
  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
