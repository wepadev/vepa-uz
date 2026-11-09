import { NextResponse, type NextRequest } from "next/server";

import { createRateLimiter, clientIp } from "@/lib/rate-limit";
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
 * yuz berishi mumkin. Suiiste'moldan himoya: matn uzunligi
 * cheklangan, bir xil xabarlar takrorlanmaydi, boshqa saytdan
 * kelgan so'rov rad etiladi va bitta manzildan yuboriladigan
 * xabarlar soni cheklangan (lib/rate-limit.ts).
 */
/* Bitta manzildan 10 daqiqada 5 ta, hammasidan birga soatiga 60 ta */
const perIp = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });
const overall = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 });

function isSameHost(origin: string, host: string | null) {
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  /*
   * Boshqa saytdan yuborilgan so'rovni qabul qilmaymiz. Brauzer
   * o'z saytimizdan yuborganda Origin bizning manzil bo'ladi.
   */
  const origin = request.headers.get("origin");

  if (origin && !isSameHost(origin, request.headers.get("host"))) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  if (!perIp.take(clientIp(request.headers)) || !overall.take("hammasi")) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

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
