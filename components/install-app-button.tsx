"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Chrome o'rnatish mumkin bo'lganda yuboradigan hodisa.
 * TypeScript'ning standart tiplarida yo'q, shuning uchun o'zimiz yozamiz.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallAppButtonProps = {
  /**
   * "menu"     — menyu ichidagi keng tugma
   * "floating" — kompyuterda suzib turuvchi tugma
   */
  variant?: "menu" | "floating";
  className?: string;
};

export default function InstallAppButton({
  variant = "menu",
  className,
}: InstallAppButtonProps) {
  const [deferred, setDeferred] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    /*
     * Ilova allaqachon o'rnatilgan bo'lsa (alohida oynada ochilgan),
     * tugmani umuman ko'rsatmaymiz.
     */
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (standalone) return;

    function onBeforeInstallPrompt(event: Event) {
      // Chrome'ning o'z bannerini to'xtatamiz — o'z tugmamizni ko'rsatamiz
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;

    await deferred.prompt();
    await deferred.userChoice;

    /*
     * Hodisani ikkinchi marta ishlatib bo'lmaydi — foydalanuvchi
     * rad etsa ham tugmani yashiramiz, Chrome keyinroq qayta yuboradi.
     */
    setDeferred(null);
  }

  // Chrome hali ruxsat bermagan bo'lsa — tugma yo'q
  if (!deferred) return null;

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={install}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-xl bg-mb-brand px-4 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-mb-brandDark",
          className,
        )}
      >
        <Download className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        Ilovani o‘rnatish
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={install}
      className={cn(
        "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-mb-brand px-4 text-[15px] font-semibold text-white active:bg-mb-brandDark",
        className,
      )}
    >
      <Download className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
      Ilovani o‘rnatish
    </button>
  );
}
