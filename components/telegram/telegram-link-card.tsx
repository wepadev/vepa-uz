import "server-only";

import { createClient } from "@/lib/supabase/server";
import { miniAppLink } from "@/lib/telegram/config";
import { createLinkToken } from "@/lib/telegram/start-param";
import { btnGhost, btnPrimary, card } from "@/lib/ui";

/*
 * Profil sahifasidagi "Telegram" bloki.
 *
 * Ulanmagan bölsa tugma Mini App'ni imzoli kod bilan oçadi
 * (30 daqiqa yaroqli) — Telegram öşa zahoti şu hisobga bog'lanadi.
 * Google bilan kirganlar uçun yagona yöl: Telegram içida Google
 * kirişi işlamaydi.
 */
export default async function TelegramLinkCard({ userId }: { userId: string }) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  const openLink = miniAppLink();

  if (!openLink || !secret) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("telegram_accounts")
    .select("username, first_name")
    .eq("user_id", userId)
    .maybeSingle();

  const linkUrl = miniAppLink(createLinkToken(userId, secret));

  return (
    <section className={`${card} mt-4 p-5 sm:p-6`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        Telegram
      </p>

      {data ? (
        <>
          <p className="mt-2 font-semibold text-mb-ink">
            Ulangan
            {data.username ? ` — @${data.username}` : data.first_name ? ` — ${data.first_name}` : ""}
          </p>
          <p className="mt-1 text-sm leading-6 text-mb-muted">
            Botda «Oçiş» tugmasini bossangiz, şu hisob bilan kirasiz.
          </p>
          <a href={openLink} className={`${btnGhost} mt-4 w-full sm:w-auto`}>
            Telegram’da oçiş
          </a>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-mb-muted">
            Saytni Telegram içida ilova sifatida oçing: testlar,
            natijalar va guruhingiz şu hisobda qoladi.
          </p>
          {linkUrl && (
            <a href={linkUrl} className={`${btnPrimary} mt-4 w-full sm:w-auto`}>
              Telegram’ga ulaş
            </a>
          )}
        </>
      )}
    </section>
  );
}
