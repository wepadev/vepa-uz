import { NextResponse, type NextRequest } from "next/server";

import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Xato xabarnomasini tekshirish uchun tashxis yo'li.
 *
 * Brauzerda ochasiz (admin sifatida kirgan holda):
 *   /api/admin/test-error
 *
 * Javobda nima sozlangani va Telegram nima deganini ko'rasiz.
 * Bu yo'l xato tashlamaydi — u shunchaki xabar yuborib, natijani
 * ochiq ko'rsatadi.
 *
 * Ikkinchi rejim:
 *   /api/admin/test-error?throw=1
 *
 * Bu haqiqiy xato tashlaydi. Shu orqali instrumentation.ts ilgagi
 * ishlayotganini tekshiramiz — ya'ni sayt o'zi xatoni sezib xabar
 * beradimi. Yuqoridagi oddiy rejim faqat Telegram ulanishini
 * tekshiradi, bu esa butun zanjirni.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { xato: "Tizimga kirmagansiz." },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.is_active !== true) {
    return NextResponse.json(
      { xato: "Bu sahifa faqat administrator uchun." },
      { status: 403 },
    );
  }

  /*
   * Ataylab xato tashlaymiz. Next.js uni instrumentation.ts dagi
   * onRequestError ilgagiga uzatishi kerak — o'sha yerdan Telegramga
   * xabar ketadi. Agar bu rejimda xabar kelmasa, muammo ilgakda;
   * oddiy rejim ishlab, bu ishlamasa — aniq shu.
   */
  if (request.nextUrl.searchParams.get("throw") === "1") {
    throw new Error(
      `Sinov xatosi — ataylab tashlandi (${new Date().toISOString()})`,
    );
  }

  const hasSharedToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const hasErrorToken = Boolean(process.env.TELEGRAM_ERROR_BOT_TOKEN);
  const hasChatId = Boolean(process.env.TELEGRAM_ERROR_CHAT_ID);

  // Vaqtni qo'shamiz — 10 daqiqalik takror to'sig'iga tushmasin
  const result = await reportError({
    where: "sinov",
    message: `Sinov xabari — ${new Date().toISOString()}`,
    url: "/api/admin/test-error",
    detail: "Bu haqiqiy xato emas. Xabarnoma ishlayotganini tekshirish.",
  });

  return NextResponse.json({
    sozlamalar: {
      TELEGRAM_BOT_TOKEN: hasSharedToken ? "bor" : "YO‘Q",
      TELEGRAM_ERROR_BOT_TOKEN: hasErrorToken ? "bor" : "yo‘q (ixtiyoriy)",
      TELEGRAM_ERROR_CHAT_ID: hasChatId ? "bor" : "YO‘Q",
    },
    natija: result.delivered
      ? "Xabar yuborildi — Telegramni tekshiring."
      : "Yuborilmadi.",
    sabab: result.reason ?? null,
    maslahat: result.delivered
      ? null
      : "Xabar kelmasa: botga Telegramda bir marta /start yozganingizni va chat id to‘g‘riligini tekshiring.",
  });
}
