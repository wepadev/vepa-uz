import { NextResponse } from "next/server";

import { checkClaudeKey } from "@/lib/pdf-ai-tuzatish";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * AI kaliti tekshiruvi.
 *
 * Nega kerak: PDF yuklab, kutib, so'ng "kalit yo'q" degan xabarni
 * ko'rish — vaqt isrofi. Bu yo'l bir soniyada javob beradi.
 *
 * ESLATMA: kalit endi MAJBURIY emas. `.tex` dan o'qish va PDF'ni
 * qoidalar bilan ajratish kalitsiz ishlaydi; model faqat
 * qoidalar uddalay olmagan savollarni tiklaydi.
 *
 * Kalitning o'zi hech qachon javobga qo'shilmaydi.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Tizimga kirmagansiz." },
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
      { ok: false, message: "Bu amal faqat administrator uchun." },
      { status: 403 },
    );
  }

  return NextResponse.json(await checkClaudeKey());
}
