import { NextResponse, type NextRequest } from "next/server";

import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";

/**
 * Brauzerda yuz bergan xatolarni qabul qiladi.
 *
 * Server xatolarini instrumentation.ts ushlaydi, lekin brauzerdagilar
 * (render xatosi, komponent buzilishi) u yerga tushmaydi — ular shu
 * yo'l orqali keladi.
 *
 * Yo'l ochiq, chunki xato tizimga kirmagan foydalanuvchida ham
 * yuz berishi mumkin. Suiiste'moldan himoya sifatida matn uzunligi
 * cheklangan va bir xil xabarlar takrorlanmaydi.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      message?: unknown;
      digest?: unknown;
      url?: unknown;
    };

    const message = String(body.message ?? "").slice(0, 500);

    if (!message) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await reportError({
      where: "brauzer",
      message,
      digest: body.digest ? String(body.digest).slice(0, 100) : null,
      url: body.url ? String(body.url).slice(0, 300) : null,
      detail: request.headers.get("user-agent")?.slice(0, 200) ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
