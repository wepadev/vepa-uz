/*
 * Vepa Ustoz — service worker.
 *
 * Ikkita vazifasi bor:
 *   1. Chrome "Ilovani o'rnatish" taklifini ko'rsatishi uchun fetch
 *      ishlovchisi kerak — u shu yerda.
 *   2. Internet uzilganda bo'sh dinozavr o'rniga o'z sahifamiz chiqadi.
 *
 * MUHIM QAROR: HTML sahifalar KESHLANMAYDI.
 * Sayt server tomonda render qilinadi va foydalanuvchiga qarab
 * o'zgaradi (kim kirgan, qaysi test ochiq, qaysi natija). Agar HTML
 * keshlansa, o'quvchi boshqa odamning ma'lumotini yoki eskirgan
 * natijani ko'rib qolishi mumkin edi. Shu sababli sahifalar doim
 * tarmoqdan olinadi, kesh faqat o'zgarmaydigan fayllar uchun.
 */

const VERSION = "v1";
const CACHE = `vepa-ustoz-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/** Oldindan saqlanadigan fayllar */
const PRECACHE = [OFFLINE_URL, "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      // Yangi versiya darhol kuchga kirsin
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Eski versiyalarning keshini tozalaymiz
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Faqat o'zgarmaydigan, xesh nomli fayllar keshlanadi */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|css)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Faqat oddiy o'qish so'rovlari
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Boshqa domenlar (Supabase, YouTube, shriftlar) — tegilmaydi
  if (url.origin !== self.location.origin) return;

  // Sahifalar: doim tarmoqdan. Uzilsa — offline sahifa.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL);

          return (
            cached ??
            new Response(
              "<h1>Internet aloqasi yo‘q</h1>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } },
            )
          );
        }
      })(),
    );
    return;
  }

  // Statik fayllar: avval keshdan, bo'lmasa tarmoqdan olib saqlaymiz
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, response.clone());
          }

          return response;
        } catch (error) {
          const fallback = await caches.match(request);
          if (fallback) return fallback;
          throw error;
        }
      })(),
    );
  }

  // Qolgan hamma narsa (API, ma'lumot so'rovlari) — to'g'ridan-to'g'ri tarmoqqa
});
