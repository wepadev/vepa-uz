import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Vepa Ustoz kiçik ikonkalari — bölim belgilari (glyph.tsx) bilan
 * bitta oila.
 *
 * Tayyor töplam (lucide) örniga özimiz çizdik, şuning uçun hamma
 * ikonka bitta qoidaga böysunadi:
 *   - tör 24×24, çiziq 2 (ölçamidan qat'i nazar bir xil qalinlik),
 *     uçlari va burçaklari yumaloq;
 *   - faqat toğri çiziq, aylana va yoy — logodagi çizğiç va sirkul;
 *   - "narsa" ikonkalarida bitta sariq urğu (play, tanga, tugma
 *     uçi ...), xuddi bölim belgilaridagi kabi. Yönaliş ikonkalari
 *     (strelka, belgi, yopiş) — urğusiz, faqat çiziq.
 *   - kök tugma, sariq tugma yoki kök blok içida urğu özi oq / matn
 *     rangiga ötadi (globals.css, `.vi`).
 *
 * Komponent nomlari lucide bilan bir xil — import manzilini
 * almaştiriş kifoya.
 */
export type IconProps = {
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
  /** Lucide bilan moslik uçun — e'tiborga olinmaydi, qalinlik bitta */
  strokeWidth?: number;
  /** Urğu qismining rangi (masalan videodagi oq play uçun "currentColor") */
  fill?: string;
};

export type IconComponent = (props: IconProps) => ReactNode;
/** Eski nom — lucide tipi örnida */
export type LucideIcon = IconComponent;

const ACCENT = "var(--vi-accent, var(--vp-accent))";

const a = { fill: ACCENT } as const;
const dot = { fill: "currentColor", stroke: "none" } as const;

function make(name: string, body: ReactNode): IconComponent {
  function Icon({
    className,
    style,
    "aria-hidden": ariaHidden,
    "aria-label": ariaLabel,
    fill,
  }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={ariaLabel ? undefined : (ariaHidden ?? true)}
        aria-label={ariaLabel}
        role={ariaLabel ? "img" : undefined}
        focusable="false"
        className={cn("vi h-5 w-5", className)}
        style={
          fill
            ? ({ ...style, "--vi-accent": fill } as CSSProperties)
            : style
        }
      >
        {body}
      </svg>
    );
  }

  Icon.displayName = name;
  return Icon;
}

/* ---------------- Yönaliş: strelkalar ---------------------------- */

export const ChevronRight = make("ChevronRight", <path d="M9.5 6l6 6-6 6" />);
export const ChevronLeft = make("ChevronLeft", <path d="M14.5 6l-6 6 6 6" />);
export const ChevronDown = make("ChevronDown", <path d="M6 9.5l6 6 6-6" />);
export const ArrowRight = make(
  "ArrowRight",
  <path d="M5 12h13.5M13.5 7l5 5-5 5" />,
);
export const RotateCcw = make(
  "RotateCcw",
  <>
    <path d="M5.2 13.5A7 7 0 1 0 7.4 6.6" />
    <path d="M5 4.5v4.5h4.5" />
  </>,
);
export const Download = make(
  "Download",
  <path d="M12 4.5v10M7.5 10.5l4.5 4.5 4.5-4.5M5 19.5h14" />,
);
export const Send = make(
  "Send",
  <>
    <path d="M20 4L3.8 10.4l6.4 2.7 2.7 6.4z" />
    <path d="M20 4l-9.8 9.1" />
  </>,
);

/* ---------------- Belgi: tasdiq, yopiş, qöşiş -------------------- */

export const Check = make("Check", <path d="M5 12.5l4.5 4.5L19 7.5" />);
export const X = make("X", <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />);
export const Plus = make("Plus", <path d="M12 5.5v13M5.5 12h13" />);
export const Circle = make("Circle", <circle cx="12" cy="12" r="8.5" />);
export const Loader2 = make(
  "Loader2",
  <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />,
);
export const Search = make(
  "Search",
  <>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l4.5 4.5" />
  </>,
);
export const Menu = make(
  "Menu",
  <>
    <path d="M4.5 7h15M4.5 12h15M4.5 17h9" />
    <circle cx="18.5" cy="17" r="1.6" {...a} stroke="none" />
  </>,
);

/* ---------------- Holat: toğri, xato, diqqat --------------------- */

export const CheckCircle2 = make(
  "CheckCircle2",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
  </>,
);
export const XCircle = make(
  "XCircle",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
  </>,
);
export const Info = make(
  "Info",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="7.9" r="1.15" {...dot} />
  </>,
);
export const AlertTriangle = make(
  "AlertTriangle",
  <>
    <path d="M10.7 5.2a1.5 1.5 0 0 1 2.6 0l7 12.3a1.5 1.5 0 0 1-1.3 2.2H5a1.5 1.5 0 0 1-1.3-2.2z" />
    <path d="M12 10v3.8" />
    <circle cx="12" cy="16.6" r="1.15" {...dot} />
  </>,
);
export const AlertOctagon = make(
  "AlertOctagon",
  <>
    <path d="M8.7 3.8h6.6l4.9 4.9v6.6l-4.9 4.9H8.7l-4.9-4.9V8.7z" />
    <path d="M12 8v4.6" />
    <circle cx="12" cy="15.7" r="1.15" {...dot} />
  </>,
);

/* ---------------- Narsalar (sariq urğu bilan) -------------------- */

export const Lock = make(
  "Lock",
  <>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    <circle cx="12" cy="15.5" r="1.6" {...a} stroke="none" />
  </>,
);
export const KeyRound = make(
  "KeyRound",
  <>
    <circle cx="8.5" cy="15.5" r="4" {...a} />
    <path d="M11.4 12.6L19.5 4.5M16.5 7.5l2 2M14 10l1.5 1.5" />
  </>,
);
export const Play = make(
  "Play",
  <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.2 5.1a.8.8 0 0 0-1.2.7z" {...a} />,
);
export const Star = make(
  "Star",
  <path
    d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.3l-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"
    {...a}
  />,
);
export const Crown = make(
  "Crown",
  <>
    <path d="M4.5 8.5l3.8 3.5L12 6l3.7 6 3.8-3.5-1.4 9.5H5.9z" {...a} />
    <path d="M6 20.5h12" />
  </>,
);
export const Sparkles = make(
  "Sparkles",
  <>
    <path
      d="M11 4c.6 3.6 2.3 5.3 6 6-3.7.7-5.4 2.4-6 6-.6-3.6-2.3-5.3-6-6 3.7-.7 5.4-2.4 6-6z"
      {...a}
    />
    <path d="M18.5 15v4.5M16.25 17.25h4.5" />
  </>,
);
export const Coins = make(
  "Coins",
  <>
    <ellipse cx="12" cy="7" rx="6.5" ry="2.6" {...a} />
    <path d="M5.5 7v5c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6V7" />
    <path d="M5.5 12v5c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6v-5" />
  </>,
);
export const ShoppingBag = make(
  "ShoppingBag",
  <>
    <path d="M5.3 8h13.4l-1 11a1.5 1.5 0 0 1-1.5 1.4H7.8A1.5 1.5 0 0 1 6.3 19z" />
    <path d="M9 8V6.8a3 3 0 0 1 6 0V8" />
    <circle cx="12" cy="13.5" r="1.6" {...a} stroke="none" />
  </>,
);
export const Save = make(
  "Save",
  <>
    <path d="M4.5 7a2.5 2.5 0 0 1 2.5-2.5h8.5l4 4V17a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17z" />
    <path d="M8.5 4.5v3.5h6V4.5" />
    <rect x="8" y="13" width="8" height="6.5" rx="1" {...a} />
  </>,
);
export const Compass = make(
  "Compass",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15.2 8.8l-1.7 4.7-4.7 1.7 1.7-4.7z" {...a} />
  </>,
);
export const Sun = make(
  "Sun",
  <>
    <circle cx="12" cy="12" r="3.8" {...a} />
    <path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3" />
  </>,
);
export const Moon = make(
  "Moon",
  <path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z" />,
);

/* ---------------- Vaqt va sana ----------------------------------- */

export const Clock = make(
  "Clock",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const Timer = make(
  "Timer",
  <>
    <circle cx="12" cy="13.5" r="7" />
    <path d="M10 3.5h4M12 3.5v3M12 13.5V10M18.2 7.3l1.3-1.3" />
    <circle cx="12" cy="13.5" r="1.4" {...a} stroke="none" />
  </>,
);

const calendarFrame = (
  <>
    <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
    <path d="M8 3.5v4M16 3.5v4M4 10h16" />
  </>
);

export const CalendarDays = make(
  "CalendarDays",
  <>
    {calendarFrame}
    <rect x="7.5" y="13" width="3.2" height="3.2" rx=".8" {...a} stroke="none" />
    <path d="M14 14.6h2.5" />
  </>,
);
export const CalendarCheck = make(
  "CalendarCheck",
  <>
    {calendarFrame}
    <path d="M9 15l2 2 4-4.5" />
  </>,
);
export const CalendarClock = make(
  "CalendarClock",
  <>
    {calendarFrame}
    <path d="M12 12.8v2.6l1.8 1.2" />
    <circle cx="16.8" cy="13.2" r="1.3" {...a} stroke="none" />
  </>,
);

/* ---------------- Bölimlar (glyph.tsx ning kiçik nusxasi) --------- */

/** Testlar — javoblar varağı, bitta qator belgilangan */
export const ClipboardCheck = make(
  "ClipboardCheck",
  <>
    <rect x="5" y="3.5" width="14" height="17" rx="3" />
    <circle cx="9.2" cy="8.5" r="1.4" />
    <circle cx="9.2" cy="15.5" r="1.4" {...a} />
    <path d="M12.8 8.5h3M12.8 15.5h3" />
  </>,
);
/** Natijalar / tekşiriş röyxati — uçta qator */
export const ListChecks = make(
  "ListChecks",
  <>
    <circle cx="6.5" cy="6.5" r="1.8" />
    <circle cx="6.5" cy="12" r="1.8" {...a} />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <path d="M11 6.5h8.5M11 12h8.5M11 17.5h8.5" />
  </>,
);
/** Uy vazifasi — daftar va qalam */
export const ClipboardList = make(
  "ClipboardList",
  <>
    <rect x="4" y="3.5" width="12.5" height="17" rx="2.5" />
    <path d="M7.5 8h5.5M7.5 12h4M7.5 16h2.5" />
    <path d="M20.6 9.4l-5.2 5.2-2.4.7.7-2.4 5.2-5.2a1.2 1.2 0 0 1 1.7 1.7z" {...a} />
  </>,
);
/** Videodarslar — ekran va play */
export const MonitorPlay = make(
  "MonitorPlay",
  <>
    <rect x="3" y="4.5" width="18" height="12" rx="3" />
    <path d="M10.5 8.2v4.6l4-2.3z" {...a} />
    <path d="M12 16.5v3M8.5 20h7" />
  </>,
);
/** Darslik yeçimlari — oçiq kitob, öng betda tasdiq */
export const BookOpen = make(
  "BookOpen",
  <>
    <path d="M12 6.8C10 5.1 7 4.6 3.5 5.1v12.6C7 17.2 10 17.7 12 19.4c2-1.7 5-2.2 8.5-1.7V5.1C17 4.6 14 5.1 12 6.8z" />
    <path d="M12 6.8v12.6" />
    <path d="M14.6 12.2l1.5 1.5 2.5-3" stroke={ACCENT} strokeWidth={2.4} />
  </>,
);
/** Boş sahifa — uy, eşigi urğuli */
export const House = make(
  "House",
  <>
    <path d="M3.8 11L12 4.3l8.2 6.7" />
    <path d="M6 9.4V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.4" />
    <rect x="10" y="14" width="4" height="6" rx="1" {...a} />
  </>,
);
/** Guruh — uç nuqta, bitta uçburçak */
export const Users = make(
  "Users",
  <>
    <circle cx="12" cy="6.5" r="2.5" {...a} />
    <circle cx="6" cy="17.5" r="2.5" />
    <circle cx="18" cy="17.5" r="2.5" />
    <path d="M10.7 8.7L7.3 15.3M13.3 8.7l3.4 6.6M8.5 17.5h7" />
  </>,
);
