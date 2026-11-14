import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Vepa Ustoz belgilari — bölimlarning öz ikonkalari.
 *
 * MUAMMO: bölim belgilari tayyor ikonkalar töplamidan olingan edi —
 * har biri boşqa qalinlikda, boşqa rangli plitkada. Tizim yöq edi.
 *
 * YEÇIM: hamma belgi bitta qoida bilan çizilgan (logodagi çizğiç va
 * sirkul kabi — toğri çiziq, aylana va yoydan):
 *   - tör 48×48, çiziq 2.5, uçlari yumaloq;
 *   - uç rang: çiziq — brend köki, içi — oçiq kök, bitta sariq nuqta
 *     yoki şakl (urğu). Boşqa rang yöq;
 *   - sariq şakl har belgida bitta va u "eng muhim joy"ni körsatadi
 *     (tanlangan javob, play tugmasi, birinçi örin ...).
 *
 * Ranglar CSS özgaruvçilaridan, şuning uçun tun rejimida özi almaşadi.
 * Yangi bölim qöşilsa — şu yerga yangi belgi çiziladi, tayyor ikonka
 * qöyilmaydi.
 */
export type GlyphName =
  | "tests"
  | "lessons"
  | "solutions"
  | "homework"
  | "group"
  | "ranking"
  | "shop"
  | "review"
  | "results"
  | "premium"
  | "profile"
  | "attestation"
  | "certificate"
  | "sat"
  | "school"
  | "top"
  | "locked"
  | "empty"
  | "mock";

const INK = "var(--vp-brand-strong)";
const SOFT = "var(--vp-tint)";
const PAPER = "var(--vp-surface)";
const SUN = "var(--vp-accent)";

const line = {
  fill: "none",
  stroke: INK,
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const soft = { ...line, fill: SOFT } as const;
const paper = { ...line, fill: PAPER } as const;
const sun = { ...line, fill: SUN } as const;

const glyphs: Record<GlyphName, ReactNode> = {
  /* Mock: javoblar varağı va sekundomer — vaqtli töliq imtihon */
  mock: (
    <>
      <rect x="6" y="6" width="25" height="34" rx="5" {...soft} />
      <path d="M12 15h13M12 22h9M12 29h6" {...line} />
      <circle cx="33" cy="32" r="9.5" {...paper} />
      <path d="M33 27v5l3.500 2.500" {...line} />
      <path d="M30.5 19.5h5" {...line} stroke={SUN} strokeWidth={3} />
    </>
  ),

  /* Javoblar varağı: uçta qator, bittasi belgilangan */
  tests: (
    <>
      <rect x="9" y="5" width="30" height="38" rx="6" {...soft} />
      <circle cx="17.5" cy="15" r="3" {...paper} />
      <circle cx="17.5" cy="24" r="3" {...sun} />
      <circle cx="17.5" cy="33" r="3" {...paper} />
      <path d="M25 15h7M25 24h7M25 33h7" {...line} />
    </>
  ),

  /* Ekran va play */
  lessons: (
    <>
      <rect x="5" y="8" width="38" height="27" rx="6" {...soft} />
      <path d="M20.5 15.5v12l10-6z" {...sun} />
      <path d="M24 35v6M16 42h16" {...line} />
    </>
  ),

  /* Oçiq kitob: çap betda masala, öng betda yeçim belgisi */
  solutions: (
    <>
      <path
        d="M24 13c-4-3.5-10.5-4.5-18-3.500v27c7.5-1 14 0 18 3.5 4-3.5 10.5-4.5 18-3.500v-27c-7.5-1-14 0-18 3.500z"
        {...soft}
      />
      <path d="M24 13v27" {...line} />
      <path d="M11 18.500c2.5-.3 4.8 0 7 .800M11 25c2.5-.3 4.8 0 7 .8" {...line} />
      <path d="M29.5 24l3 3 5.5-6.5" {...line} stroke={SUN} strokeWidth={3} />
    </>
  ),

  /* Daftar va qalam */
  homework: (
    <>
      <rect x="8" y="6" width="26" height="36" rx="5" {...soft} />
      <path d="M14 15h14M14 22h10M14 29h7" {...line} />
      <path d="M41.5 20.500l-11 11-5 1.5 1.5-5 11-11z" {...sun} />
    </>
  ),

  /* Uç nuqta — bitta uçburçak: guruh */
  group: (
    <>
      <path d="M24 13L11 34h26z" {...line} />
      <circle cx="24" cy="12" r="6" {...sun} />
      <circle cx="11" cy="34" r="6" {...soft} />
      <circle cx="37" cy="34" r="6" {...soft} />
    </>
  ),

  /* Uçta ustun: örinlar */
  ranking: (
    <>
      <rect x="5" y="23" width="12" height="19" rx="3" {...soft} />
      <rect x="18" y="8" width="12" height="34" rx="3" {...sun} />
      <rect x="31" y="16" width="12" height="26" rx="3" {...soft} />
      <path d="M22.5 16l2-1.5v7" {...line} />
    </>
  ),

  /* Tanga */
  shop: (
    <>
      <circle cx="24" cy="24" r="18" {...soft} />
      <circle cx="24" cy="24" r="10.5" {...sun} />
      <path d="M24 19.500v9M20.5 22l3.5-2.5" {...line} />
    </>
  ),

  /* Aylanib qaytiş */
  review: (
    <>
      <path d="M40 24a16 16 0 1 1-5.5-12.1" {...line} />
      <path d="M35.5 5v7.500H28" {...line} />
      <circle cx="24" cy="24" r="5.5" {...sun} />
    </>
  ),

  /* Doira diagramma: sariq bölak — natija */
  results: (
    <>
      <circle cx="24" cy="24" r="18" {...soft} />
      <path d="M24 24V6a18 18 0 0 1 15.6 27z" {...sun} />
      <circle cx="24" cy="24" r="18" {...line} />
    </>
  ),

  /* Toj */
  premium: (
    <>
      <path d="M7 36l-2-20 11 8 8-13 8 13 11-8-2 20z" {...soft} />
      <path d="M9 42h30" {...line} />
      <circle cx="24" cy="29" r="3.5" {...sun} />
    </>
  ),

  /* Odam */
  profile: (
    <>
      <path d="M8 42c0-8.5 7-14 16-14s16 5.5 16 14" {...soft} />
      <circle cx="24" cy="15" r="8.5" {...sun} />
    </>
  ),

  /* Attestatsiya: nişon va lenta */
  attestation: (
    <>
      <path d="M16 27l-4 15 12-5 12 5-4-15" {...soft} />
      <circle cx="24" cy="18" r="13" {...paper} />
      <circle cx="24" cy="18" r="6" {...sun} />
    </>
  ),

  /* Milliy sertifikat: hujjat va muhr */
  certificate: (
    <>
      <rect x="5" y="8" width="38" height="28" rx="5" {...soft} />
      <path d="M12 17h14M12 24h9" {...line} />
      <circle cx="33" cy="27" r="6" {...sun} />
      <path d="M29.5 32v10l3.5-2.5 3.5 2.500V32" {...line} />
    </>
  ),

  /* SAT: bitiruvçi qalpoği */
  sat: (
    <>
      <path d="M13 23v10c3 3.5 7 5 11 5s8-1.5 11-5V23" {...soft} />
      <path d="M3 18l21-10 21 10-21 10z" {...paper} />
      <path d="M41 20v11" {...line} />
      <circle cx="41" cy="33" r="3" {...sun} />
    </>
  ),

  /* Maktab darsliklari: uçta kitob */
  school: (
    <>
      <rect x="6" y="30" width="36" height="10" rx="3" {...soft} />
      <rect x="10" y="19" width="30" height="10" rx="3" {...sun} />
      <rect x="7" y="8" width="32" height="10" rx="3" {...soft} />
      <path d="M13 13h8M35 35h1" {...line} />
    </>
  ),

  /* TOP kitoblar: kitob va xatçöp */
  top: (
    <>
      <path d="M10 10a5 5 0 0 1 5-5h23v32H15a5 5 0 0 0-5 5z" {...soft} />
      <path d="M10 42a5 5 0 0 1 5-5h23v6H15a5 5 0 0 1-5-1" {...paper} />
      <path d="M24 5v15l4.5-3.500L33 20V5" {...sun} />
    </>
  ),

  /* Qulf */
  locked: (
    <>
      <path d="M15 21v-6a9 9 0 0 1 18 0v6" {...line} />
      <rect x="8" y="21" width="32" height="22" rx="6" {...soft} />
      <circle cx="24" cy="31" r="3.5" {...sun} />
    </>
  ),

  /* Böş holat: koordinata öqlari va nuqta */
  empty: (
    <>
      <path d="M9 6v33h33" {...line} />
      <path d="M9 31c9 0 12-17 30-19" {...line} strokeDasharray="1 6" />
      <circle cx="39" cy="12" r="4.5" {...sun} />
    </>
  ),
};

export function Glyph({
  name,
  className,
}: {
  name: GlyphName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={cn("h-10 w-10 shrink-0", className)}
    >
      {glyphs[name]}
    </svg>
  );
}

const TILE = {
  sm: "h-11 w-11 rounded-xl [&>svg]:h-7 [&>svg]:w-7",
  md: "h-14 w-14 rounded-2xl [&>svg]:h-9 [&>svg]:w-9",
  lg: "h-[72px] w-[72px] rounded-[20px] [&>svg]:h-12 [&>svg]:w-12",
} as const;

/** Belgi uçun yagona plitka: hamma joyda bir xil fon va burçak */
export function GlyphTile({
  name,
  size = "md",
  className,
}: {
  name: GlyphName;
  size?: keyof typeof TILE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-vp-surface-soft ring-1 ring-inset ring-vp-tint",
        TILE[size],
        className,
      )}
    >
      <Glyph name={name} />
    </span>
  );
}
