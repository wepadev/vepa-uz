"use client";

/*
 * Telegram Web App SDK (telegram-web-app.js) faqat Telegram içida
 * yuklanadi: oddiy brauzerdagi foydalanuvçi bu faylni umuman olmaydi.
 */

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  colorScheme: "light" | "dark";
  platform?: string;
  version?: string;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (handler: () => void) => void;
    offClick: (handler: () => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const SDK_URL = "https://telegram.org/js/telegram-web-app.js?59";
const FLAG = "vepa-tg";

let loading: Promise<TelegramWebApp | null> | null = null;

/** Sahifa Telegram Mini App sifatida oçilganmi (SDK yuklanmasdan oldin) */
export function looksLikeTelegram() {
  if (typeof window === "undefined") return false;

  try {
    return (
      window.location.hash.includes("tgWebAppData") ||
      window.location.search.includes("tgWebAppStartParam") ||
      sessionStorage.getItem(FLAG) === "1" ||
      sessionStorage.getItem("__telegram__initParams") !== null
    );
  } catch {
    return window.location.hash.includes("tgWebAppData");
  }
}

export function loadTelegram(): Promise<TelegramWebApp | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Telegram?.WebApp) return Promise.resolve(withData(window.Telegram.WebApp));
  if (loading) return loading;

  loading = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve(withData(window.Telegram?.WebApp));
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return loading;
}

/** initData bölmasa — bu Telegram emas (SDK oddiy brauzerda ham yuklanadi) */
function withData(app: TelegramWebApp | undefined) {
  if (!app?.initData) return null;

  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    /* maxfiy rejim */
  }

  return app;
}
