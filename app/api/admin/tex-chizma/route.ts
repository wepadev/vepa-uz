import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { renderFigure } from "@/lib/tex-chizma";

/*
 * Bitta chizmani PNG rasmga aylantirish.
 *
 * `.tex` dan test ajratilganda chizmali savolga LaTeX hujjat
 * (`figure`) biriktiriladi. Brauzer har bir chizmani shu yerga
 * NAVBAT BILAN yuboradi: bitta mavzuda 20+ chizma bo'ladi, hammasi
 * bitta so'rovda chizilsa funksiya vaqti yetmaydi. Har bir chizma
 * 0.3–5 soniya oladi.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/* Eng katta chizma ~60 KB; bundan kattasi — xato yoki suiiste'mol */
const MAX_CHARS = 200_000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Tizimga kirmagansiz." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.is_active !== true) {
    return NextResponse.json(
      { error: "Bu amal faqat administrator uçun." },
      { status: 403 },
    );
  }

  let document = "";

  try {
    const body = (await request.json()) as { document?: unknown };
    document = typeof body.document === "string" ? body.document : "";
  } catch {
    return NextResponse.json({ error: "Sörov öqilmadi." }, { status: 400 });
  }

  if (!document.includes("\\begin{document}")) {
    return NextResponse.json({ error: "Çizma hujjati yöq." }, { status: 400 });
  }

  if (document.length > MAX_CHARS) {
    return NextResponse.json({ error: "Çizma juda katta." }, { status: 400 });
  }

  try {
    const png = await renderFigure(document);

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Çizma çizilmadi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 422 },
    );
  }
}
