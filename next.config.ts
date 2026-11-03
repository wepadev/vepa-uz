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
  serverExternalPackages: [
    "pdfjs-dist",
    "pdf-lib",
    /* Chizma: WebAssembly TeX va resvg'ning tayyor kutubxonasi */
    "node-tikzjax",
    "@resvg/resvg-js",
  ],

  /*
   * `node-tikzjax` TeX fayllari va shriftlarni ishlash paytida
   * diskdan o'qiydi — Vercel ularni funksiyaga o'zi qo'shmaydi.
   */
  outputFileTracingIncludes: {
    "/api/admin/tex-chizma": [
      "./node_modules/node-tikzjax/tex/**",
      "./node_modules/node-tikzjax/css/bakoma/ttf/**",
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
