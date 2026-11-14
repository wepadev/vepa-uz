import { NextResponse, type NextRequest } from "next/server";

import { createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/current-user";
import {
  createTelegramUser,
  findLinkedUser,
  linkTelegram,
  signInAs,
  touchTelegram,
} from "@/lib/telegram/accounts";
import { getAppBotToken } from "@/lib/telegram/config";
import { telegramFullName, verifyInitData } from "@/lib/telegram/init-data";
import { readLinkToken, readPathStartParam } from "@/lib/telegram/start-param";

/*
 * Mini App içida kiriş. /tg sahifasi Telegram bergan initData'ni
 * şu yerga yuboradi.
 *
 * Tartib:
 *   1. startapp=L_... (profildan "Telegram'ga ulaş") — öşa hisobga bog'lanadi
 *   2. Telegram allaqaçon bog'langan — öşa hisobga kiriladi
 *   3. Sahifada sessiya bor (email bilan kirgan) — şu hisobga bog'lanadi
 *   4. mode = "create" — yangi hisob oçiladi
 *   5. Aks holda { status: "choose" }: sahifa tanlov körsatadi
 */

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

type Body = { initData?: unknown; mode?: unknown };

export async function POST(request: NextRequest) {
  const botToken = getAppBotToken();

  if (!botToken) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";

  if (!limiter.take(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const verified = verifyInitData(
    typeof body.initData === "string" ? body.initData : "",
    botToken,
  );

  if (!verified) {
    return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });
  }

  const { user: tgUser, startParam } = verified;
  const next = readPathStartParam(startParam) ?? "/";

  try {
    const admin = createAdminClient();
    const current = await getCurrentUser();
    const linkUserId = readLinkToken(
      startParam,
      process.env.SUPABASE_SECRET_KEY ?? "",
    );

    let target: string | null = null;
    let linked = false;

    if (linkUserId) {
      await linkTelegram(admin, tgUser, linkUserId);
      target = linkUserId;
      linked = true;
    } else {
      target = await findLinkedUser(admin, tgUser.id);

      if (!target && current) {
        await linkTelegram(admin, tgUser, current.id);
        target = current.id;
        linked = true;
      }

      if (!target && body.mode === "create") {
        target = await createTelegramUser(admin, tgUser);
        await linkTelegram(admin, tgUser, target);
      }
    }

    if (!target) {
      return NextResponse.json({
        status: "choose",
        name: telegramFullName(tgUser),
      });
    }

    if (target !== current?.id) {
      await signInAs(admin, target);
    }

    await touchTelegram(admin, tgUser);

    return NextResponse.json({ status: "ok", next, linked });
  } catch (error) {
    console.error("[telegram] kiriş xatosi:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
