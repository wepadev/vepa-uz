"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

/**
 * Telefonda pastda turadigan "+ Yangi ..." tugmasi.
 *
 * Admin ro'yxatlari uzun: 40 ta dars yoki 89 ta mavzu pastga
 * tushganda yaratish formasi tepada qolib ketardi. Bu tugma doim
 * barmoq ostida turadi — bosilsa forma ochiladi va ekranga keladi.
 *
 * Forma ochiq yoki ekranda ko'rinib turgan bo'lsa tugma yashirinadi.
 * Kompyuterda (sm va undan katta) umuman chiqmaydi.
 */
export default function CreatePanelFab({
  targetId,
  label,
}: {
  targetId: string;
  label: string;
}) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const panel = document.getElementById(targetId) as HTMLDetailsElement | null;
    if (!panel) return;

    let inView = false;
    const update = () => setHidden(panel.open || inView);

    const observer = new IntersectionObserver(([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      update();
    });

    observer.observe(panel);
    panel.addEventListener("toggle", update);
    update();

    return () => {
      observer.disconnect();
      panel.removeEventListener("toggle", update);
    };
  }, [targetId]);

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const panel = document.getElementById(targetId) as HTMLDetailsElement | null;
        if (!panel) return;
        panel.open = true;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        panel.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select")?.focus({
          preventScroll: true,
        });
      }}
      className="press fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-1/2 z-40 inline-flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-mb-brand px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-mb-brandDark sm:hidden"
    >
      <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
      {label}
    </button>
  );
}
