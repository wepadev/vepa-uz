import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { callBot, openAppKeyboard, webhookSecret } from "@/lib/telegram/bot";
import { getAppBotToken } from "@/lib/telegram/config";

/*
 * Bot xabarlari (Telegram webhook). Bot oddiy: buyruqqa qisqa javob
 * va ilovani oçadigan tugma. Hamma iş Mini App içida.
 *
 * Webhook /api/admin/telegram-setup orqali bir marta ulanadi.
 */

export const dynamic = "force-dynamic";

const COMMANDS: Record<string, { text: string; button: string; path?: string }> = {
  "/start": {
    text:
      "Assalomu alaykum! Bu — <b>Vepa Ustoz</b> platformasi.\n\n" +
      "📚 Videodarslar va mavzu testlari\n" +
      "📝 Mock testlar: Attestatsiya, Milliy sertifikat, SAT\n" +
      "📈 Natijalar va xatolar tahlili\n\n" +
      "Pastdagi tugmani bosing — ilova şu yerda, Telegram içida oçiladi.",
    button: "Ilovani oçiş",
  },
  "/mock": {
    text: "Mock testlar: real imtihon kabi, vaqt bilan.",
    button: "Mock testlar",
    path: "/mock",
  },
  "/testlar": {
    text: "Mavzu testlari — bölim va mavzu böyiça.",
    button: "Testlar",
    path: "/tests",
  },
  "/natijalar": {
    text: "Işlagan testlaringiz va xatolaringiz tahlili.",
    button: "Natijalarim",
    path: "/results",
  },
};

function sameSecret(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Update = {
  message?: {
    chat?: { id?: number; type?: string };
    text?: string;
  };
};

export async function POST(request: NextRequest) {
  const token = getAppBotToken();

  if (
    !token ||
    !sameSecret(
      request.headers.get("x-telegram-bot-api-secret-token"),
      webhookSecret(token),
    )
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as Update | null;
  const message = update?.message;
  const chatId = message?.chat?.id;

  // Faqat şaxsiy suhbat: guruhlarda bot jim turadi
  if (!chatId || message?.chat?.type !== "private") {
    return NextResponse.json({ ok: true });
  }

  const command = (message.text ?? "").trim().split(/[\s@]/)[0].toLowerCase();
  const reply = COMMANDS[command] ?? COMMANDS["/start"];

  await callBot("sendMessage", {
    chat_id: chatId,
    text: reply.text,
    parse_mode: "HTML",
    reply_markup: openAppKeyboard(reply.button, reply.path),
  }).catch((error) => console.error("[telegram] javob xatosi:", error));

  return NextResponse.json({ ok: true });
}
