import type { MetadataRoute } from "next";

/**
 * PWA manifesti.
 *
 * Buningsiz Chrome "Ilovani o'rnatish" da tasodifiy ikonkani oladi va
 * logo shaffof bo'lgani uchun telefon ekranida fon bilan qo'shilib
 * ketardi. Endi ikkita xil ikonka beriladi:
 *
 *   purpose: "any"      — Chrome/desktop uchun, oq kvadrat ichida logo
 *   purpose: "maskable" — Android uchun. Android ikonkani doira yoki
 *                         yumaloq kvadrat qilib KESADI, shuning uchun
 *                         bu variantda logo kichikroq va markazda.
 *
 * background_color — ilova ochilayotganda ko'rinadigan fon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vepa Ustoz — matematika platformasi",
    short_name: "Vepa Ustoz",
    description:
      "Attestatsiya, Milliy sertifikat va SAT testlari, videodarslar hamda darslik yeçimlari.",
    lang: "uz",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f8fb",
    theme_color: "#285ee7",
    categories: ["education"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Testlar",
        url: "/tests",
      },
      {
        name: "Videodarslar",
        url: "/lessons",
      },
      {
        name: "Uy vazifalarim",
        url: "/homework",
      },
    ],
  };
}
