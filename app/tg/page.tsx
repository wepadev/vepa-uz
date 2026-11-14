import type { Metadata } from "next";

import TelegramEntry from "@/components/telegram/telegram-entry";
import { getSafeNext } from "@/lib/safe-next";

/*
 * Telegram Mini App'ning kiriş eşigi (BotFather'da ilova manzili:
 * https://vepa.uz/tg). Sahifa Telegram bergan ma'lumot bilan
 * foydalanuvçini taniydi va kerakli sahifaga ötkazadi.
 */

export const metadata: Metadata = {
  title: "Telegram",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ p?: string | string[] }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.p) ? params.p[0] : params.p;

  return <TelegramEntry fallbackNext={raw ? getSafeNext(raw) : null} />;
}
