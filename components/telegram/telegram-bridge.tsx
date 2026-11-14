"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import {
  loadTelegram,
  looksLikeTelegram,
  type TelegramWebApp,
} from "@/components/telegram/sdk";

/*
 * Sayt Telegram Mini App sifatida oçilganda uni Telegram'ga moslaydi.
 * Oddiy brauzerda hech narsa qilmaydi va hech narsa yuklamaydi.
 *
 *   - <html> ga `tg-app` klassi: Google tugmasi, "Ilovani örnatiş" kabi
 *     Telegram içida keraksiz narsalar yaşiriladi (globals.css)
 *   - kun/tun rejimi: foydalanuvçi özi tanlamagan bölsa Telegram'nikiga
 *     qaraydi; Telegram sarlavhasi va foni sayt foniga böyaladi
 *   - Telegram'ning "Orqaga" tugmasi: bosh sahifadan boşqa joyda körinadi
 *   - pastga surganda ilova yopilib ketmaydi (test, çizma, PDF uçun muhim)
 *   - t.me havolalari Telegram'ning özida, boşqa saytlar brauzerda oçiladi
 */

const ROOT_PATHS = new Set(["/", "/tg"]);

function toHex(color: string) {
  const match = color.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return null;
  return `#${match
    .slice(0, 3)
    .map((part) => Math.round(Number(part)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function paint(app: TelegramWebApp) {
  const hex = toHex(getComputedStyle(document.body).backgroundColor);
  if (!hex) return;
  try {
    app.setHeaderColor?.(hex);
    app.setBackgroundColor?.(hex);
    app.setBottomBarColor?.(hex);
  } catch {
    /* eski Telegram versiyasi */
  }
}

export default function TelegramBridge() {
  const [app, setApp] = useState<TelegramWebApp | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  // 1. Telegram'mi? Bölsa SDK'ni yuklab, boşlang'iç sozlamalar
  useEffect(() => {
    if (!looksLikeTelegram()) return;

    let cancelled = false;

    loadTelegram().then((webApp) => {
      if (cancelled || !webApp) return;

      document.documentElement.classList.add("tg-app");
      webApp.ready();
      webApp.expand();
      try {
        webApp.disableVerticalSwipes?.();
      } catch {
        /* 7.7 dan eski */
      }

      let chosen: string | null = null;
      try {
        chosen = localStorage.getItem("theme");
      } catch {
        /* maxfiy rejim */
      }
      if (!chosen) setTheme(webApp.colorScheme === "dark" ? "dark" : "light");

      setApp(webApp);
    });

    return () => {
      cancelled = true;
    };
  }, [setTheme]);

  // 2. Rang: mavzu almaşganda Telegram sarlavhasi ham almaşadi
  useEffect(() => {
    if (!app) return;
    const frame = requestAnimationFrame(() => paint(app));
    return () => cancelAnimationFrame(frame);
  }, [app, resolvedTheme, pathname]);

  // 3. "Orqaga" tugmasi
  useEffect(() => {
    const back = app?.BackButton;
    if (!back) return;

    const onBack = () => {
      if (window.history.length > 1) router.back();
      else router.push("/");
    };

    if (ROOT_PATHS.has(pathname)) back.hide();
    else back.show();

    back.onClick(onBack);
    return () => back.offClick(onBack);
  }, [app, pathname, router]);

  // 4. Tashqi havolalar
  useEffect(() => {
    if (!app) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;

      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin === window.location.origin) return;
      if (!/^https?:$/.test(url.protocol)) return;

      event.preventDefault();

      if (url.hostname === "t.me" || url.hostname === "telegram.me") {
        app.openTelegramLink?.(url.href);
      } else {
        app.openLink?.(url.href);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [app]);

  return null;
}
