"use client";

import { useEffect } from "react";

/**
 * Service worker'ni ro'yxatdan o'tkazadi.
 *
 * Faqat production'da ishlaydi: ishlab chiqish paytida kesh
 * o'zgarishlarni ko'rsatmay, chalkashlik keltirib chiqaradi.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ro'yxatdan o'tmasa ham sayt normal ishlayveradi
      });
    };

    // Sahifa yuklanib bo'lgach ro'yxatdan o'tkazamiz —
    // birinchi ochilish tezligiga xalaqit bermasin
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
