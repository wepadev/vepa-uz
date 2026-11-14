# Telegram Mini App

vepa.uz Telegram içida ilova bölib oçiladi: botda «Oçiş» tugmasi,
kiriş Telegram orqali (parolsiz), Telegram'ning «Orqaga» tugmasi,
kun/tun rejimi va sarlavha rangi moslaşadi.

## Bir martalik sozlaş

1. **Bot yaratiş.** Telegram'da @BotFather → `/newbot` → nom
   (masalan «Vepa Ustoz») va username (masalan `vepa_uz_bot`).
   BotFather token beradi. **Tokenni hec kimga yubormang, çatga ham.**
2. **Mini App.** @BotFather → `/mybots` → bot → *Bot Settings* →
   *Configure Mini App* → *Enable Mini App* → manzil:
   `https://vepa.uz/tg`. (Bu «Main App»: profilda «Ilovani oçiş»
   tugmasi çiqadi va `t.me/<bot>?startapp` havolalari işlaydi.)
3. **Vercel.** math-booster → Settings → Environment Variables
   (Production):
   - `TELEGRAM_APP_BOT_TOKEN` = BotFather bergan token
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` = bot username, @ siz
   Keyin Deployments → oxirgisi → *Redeploy*.
4. **Baza.** Supabase → SQL Editor → `db/44-telegram.sql` → Run.
5. **Webhook va menyu.** Admin bölib kirib, brauzerda
   `https://vepa.uz/api/admin/telegram-setup` ni oçing. Javobda
   `"ok": true` çiqişi kerak. Bu webhook, çapdagi «Oçiş» tugmasi va
   buyruqlarni (/start, /mock, /testlar, /natijalar) yozadi.

## Kiriş qanday işlaydi

- Ilova `/tg` dan oçiladi. Sahifa Telegram bergan `initData` ni
  `/api/telegram/auth` ga yuboradi, server uni bot tokeni bilan
  tekşiradi (HMAC). Soxta yoki 24 soatdan eski bölsa rad etiladi.
- Telegram hisobi saytdagi hisobga bog'langan bölsa — darrov kiradi.
- Bog'lanmagan bölsa ikki yöl:
  - **«Menda hisob bor — kiriş»** — email va parol bilan kiradi,
    Telegram öşa hisobga bog'lanadi.
  - **«Yangi hisob oçiş»** — Telegram ismi bilan yangi hisob
    (`tg<id>@telegram.vepa.uz`). Profilda parol qöysa, şu email
    bilan saytga ham kira oladi.
- **Google bilan kirganlar:** Google Telegram içidagi oynada kirişga
  ruxsat bermaydi. Ular saytni brauzerda oçib, Profil → «Telegram'ga
  ulaş» tugmasini bosadi (30 daqiqa yaroqli imzoli havola).

## Havolalar

- `https://t.me/<bot>?startapp` — ilovani oçadi.
- Ma'lum sahifani oçiş: `startapp=p_<base64url(yöl)>`
  (`lib/telegram/start-param.ts`, `pathStartParam("/mock")`).

## Cheklovlar

- Telegram Web (web.telegram.org) ilovani iframe içida oçadi va
  brauzer cookie'ni bloklaşi mumkin. Telefon va kompyuter
  ilovalarida muammo yöq.
