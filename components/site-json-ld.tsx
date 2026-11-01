/**
 * Google uchun sayt haqida tuzilgan ma'lumot (JSON-LD).
 *
 * Bu odamga ko'rinmaydi — u faqat qidiruv tizimlari o'qiydigan
 * yozuv. Google shu orqali "vepa.uz" nomini tashkilot nomi bilan
 * bog'laydi, logotipni biladi va ijtimoiy tarmoqlaringizni ko'radi.
 * Natijada "vepa ustoz" deb qidirilganda sayt to'g'ri tanilishi
 * ehtimoli oshadi.
 *
 * Ijtimoiy tarmoq havolalari noto'g'ri bo'lsa shu yerdan tuzating.
 */
import {
  INSTAGRAM_USERNAME,
  TELEGRAM_CHANNEL_USERNAME,
} from "@/lib/contacts";

const SOCIAL_LINKS = [
  `https://www.instagram.com/${INSTAGRAM_USERNAME}`,
  `https://t.me/${TELEGRAM_CHANNEL_USERNAME}`,
];

export default function SiteJsonLd({ siteUrl }: { siteUrl: string }) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Vepa Ustoz",
        alternateName: ["vepa.uz", "Vepa ustoz", "Vepa Ustoz matematika"],
        inLanguage: "uz",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "EducationalOrganization",
        "@id": `${siteUrl}/#organization`,
        name: "Vepa Ustoz",
        alternateName: "vepa.uz",
        url: siteUrl,
        logo: `${siteUrl}/icon-512.png`,
        image: `${siteUrl}/icon-512.png`,
        description:
          "Matematika böyiça onlayn testlar, videodarslar va darslik yeçimlari platformasi.",
        areaServed: "UZ",
        sameAs: SOCIAL_LINKS,
        founder: {
          "@type": "Person",
          name: "Vepa Kurbankliçev",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Ma'lumot o'zimizniki, tashqaridan kelmaydi — xavfsiz
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
