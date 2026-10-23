import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  /*
   * PDF kutubxonalari serverda o'z holicha ishlasin.
   *
   * `pdfjs-dist` va `pdf-lib` ichida brauzerga mo'ljallangan
   * qismlar bor (worker, canvas). Turbopack ularni yig'ishga
   * urinsa qurilish xato beradi. Bu ro'yxatdagi paketlar
   * yig'ilmaydi — Node ularni ishlash paytida o'zi yuklaydi.
   */
  serverExternalPackages: ["pdfjs-dist", "pdf-lib"],

  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
