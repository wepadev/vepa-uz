import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/require-admin";
import { callBot, miniAppUrl, siteUrl, webhookSecret } from "@/lib/telegram/bot";
import { getAppBotToken } from "@/lib/telegram/config";

/*
 * Botni bir marta sozlaş: admin bölib kirib, brauzerda
 * https://vepa.uz/api/admin/telegram-setup ni oçadi.
 *
 *   - webhook  → /api/telegram/webhook (maxfiy so'z bilan)
 *   - menyu tugmasi (çapdagi "Oçiş") → Mini App
 *   - buyruqlar röyxati
 *
 * Qayta oçiş xavfsiz: hammasi qayta yoziladi.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();

  if (!getAppBotToken()) {
    return NextResponse.json(
      { ok: false, xato: "Vercel'da TELEGRAM_APP_BOT_TOKEN qöyilmagan" },
      { status: 503 },
    );
  }

  const [me, webhook, menu, commands] = await Promise.all([
    callBot<{ username: string }>("getMe", {}),
    callBot("setWebhook", {
      url: `${siteUrl}/api/telegram/webhook`,
      secret_token: webhookSecret(),
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
    callBot("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Oçiş",
        web_app: { url: miniAppUrl },
      },
    }),
    callBot("setMyCommands", {
      commands: [
        { command: "start", description: "Ilovani oçiş" },
        { command: "mock", description: "Mock testlar" },
        { command: "testlar", description: "Mavzu testlari" },
        { command: "natijalar", description: "Natijalarim" },
      ],
    }),
  ]);

  return NextResponse.json({
    ok: me.ok && webhook.ok && menu.ok && commands.ok,
    bot: me.result?.username ? `@${me.result.username}` : me.description,
    miniApp: miniAppUrl,
    webhook: webhook.ok ? "ulandi" : webhook.description,
    menyu: menu.ok ? "ulandi" : menu.description,
    buyruqlar: commands.ok ? "yozildi" : commands.description,
  });
}
