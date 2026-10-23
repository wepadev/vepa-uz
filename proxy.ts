import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Quyidagilardan tashqari hamma yo'lda ishlaydi:
     * - _next/static, _next/image — Next.js fayllari
     * - favicon.ico va rasmlar
     *
     * PWA fayllari (manifest.webmanifest, sw.js, offline.html) ham
     * ro'yxatda. Sababi muhim: brauzer manifest va service worker'ni
     * cookie'siz so'raydi. Ular tekshiruvdan o'tsa, tizimga kirmagan
     * so'rov deb /auth/login ga yo'naltirilardi va Chrome manifest
     * o'rniga HTML olardi. Natijada sayt "o'rnatiladigan" deb
     * tanilmay, menyuda faqat "Create shortcut" chiqardi.
     *
     * `.html` fayllari ham ro'yxatda: Google Search Console saytni
     * tasdiqlash uchun `google1a2b3c.html` kabi fayl so'raydi. U ham
     * cookie'siz so'raladi va login sahifasiga yo'naltirilsa,
     * tasdiqlash muvaffaqiyatsiz tugaydi.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|html|txt|xml)$).*)",
  ],
};
