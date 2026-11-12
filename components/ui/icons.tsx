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

/* ---------------- Amallar: tahrir, öçiriş, qaytariş -------------- */

export const Minus = make("Minus", <path d="M5.5 12h13" />);
export const MoreHorizontal = make(
  "MoreHorizontal",
  <>
    <circle cx="6" cy="12" r="1.6" {...dot} />
    <circle cx="12" cy="12" r="1.6" {...dot} />
    <circle cx="18" cy="12" r="1.6" {...dot} />
  </>,
);
export const MinusCircle = make(
  "MinusCircle",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12h7" />
  </>,
);
export const CircleSlash = make(
  "CircleSlash",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 15.5l7-7" />
  </>,
);
export const Undo2 = make(
  "Undo2",
  <>
    <path d="M9 14L4.5 9.5 9 5" />
    <path d="M4.5 9.5H15a4.5 4.5 0 0 1 0 9h-3" />
  </>,
);
export const Redo2 = make(
  "Redo2",
  <>
    <path d="M15 14l4.5-4.5L15 5" />
    <path d="M19.5 9.5H9a4.5 4.5 0 0 0 0 9h3" />
  </>,
);
export const History = make(
  "History",
  <>
    <path d="M5.2 13.5A7 7 0 1 0 7.4 6.6" />
    <path d="M5 4.5v4.5h4.5" />
    <path d="M12 9v3.5l2.5 1.6" />
  </>,
);
export const Trash2 = make(
  "Trash2",
  <>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
    <path d="M6.5 7l.9 11.6a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    <path d="M10 11v5M14 11v5" />
  </>,
);
export const Pencil = make(
  "Pencil",
  <>
    <path d="M14.4 6.1l3.5 3.5L8.6 18.9l-4.1.6.6-4.1z" />
    <path
      d="M15.9 4.6a1.6 1.6 0 0 1 2.3 0l1.2 1.2a1.6 1.6 0 0 1 0 2.3l-1.5 1.5-3.5-3.5z"
      {...a}
    />
  </>,
);
export const Settings2 = make(
  "Settings2",
  <>
    <path d="M4.5 7.5h8M17.5 7.5h2M4.5 16.5h2M11.5 16.5h8" />
    <circle cx="15" cy="7.5" r="2.5" {...a} />
    <circle cx="9" cy="16.5" r="2.5" />
  </>,
);
export const EyeOff = make(
  "EyeOff",
  <>
    <path d="M9.6 6.3A9.6 9.6 0 0 1 12 6c3.9 0 7.2 2.2 9.2 6a12.8 12.8 0 0 1-2 2.8M14.1 17.6A9.4 9.4 0 0 1 12 18c-3.9 0-7.2-2.2-9.2-6a12.7 12.7 0 0 1 3.4-4.1" />
    <path d="M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6" />
    <path d="M4.5 4.5l15 15" />
  </>,
);
export const Link2 = make(
  "Link2",
  <path d="M10 8H8a4 4 0 0 0 0 8h2M14 8h2a4 4 0 0 1 0 8h-2M8.5 12h7" />,
);
export const Merge = make(
  "Merge",
  <>
    <path d="M7 4.5V7c0 3 5 4.5 5 8.5v4M17 4.5V7c0 3-5 4.5-5 8.5" />
    <path d="M9.5 17l2.5 2.5 2.5-2.5" />
  </>,
);
export const Maximize2 = make(
  "Maximize2",
  <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />,
);
export const Minimize2 = make(
  "Minimize2",
  <path d="M9 4.5V9H4.5M15 4.5V9h4.5M19.5 15H15v4.5M9 19.5V15H4.5" />,
);

/* ---------------- Fayl va hujjat (bukilgan burçak urğuli) -------- */

const fileFrame = (
  <>
    <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
    <path d="M13.5 3.5V9H19z" {...a} />
  </>
);

export const FileUp = make(
  "FileUp",
  <>
    {fileFrame}
    <path d="M12 17.5v-5.5M9.5 14.2l2.5-2.5 2.5 2.5" />
  </>,
);
export const FilePlus = make(
  "FilePlus",
  <>
    {fileFrame}
    <path d="M12 11.5v6M9 14.5h6" />
  </>,
);
export const ScrollText = make(
  "ScrollText",
  <>
    <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
    <path d="M8 8h8M8 11.5h5" />
    <circle cx="15" cy="16" r="2.3" {...a} />
  </>,
);
export const Printer = make(
  "Printer",
  <>
    <path d="M7 9V4.5h10V9" />
    <path d="M7 16.5H5.5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2H17" />
    <rect x="7" y="13.5" width="10" height="6.5" rx="1" />
    <circle cx="17" cy="11.8" r="1.2" {...a} stroke="none" />
  </>,
);
export const Database = make(
  "Database",
  <>
    <ellipse cx="12" cy="6" rx="7" ry="2.5" {...a} />
    <path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
    <path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
  </>,
);
/** Daftar va ruçka — uy vazifasi belgisi bilan bir xil */
export const NotebookPen = ClipboardList;

/* ---------------- Tahlil: grafik va yönaliş ---------------------- */

export const BarChart3 = make(
  "BarChart3",
  <>
    <path d="M4 4v15a1 1 0 0 0 1 1h15" />
    <path d="M8.5 16.5v-4M17.5 16.5v-6" />
    <rect x="11.5" y="7.5" width="3" height="9" rx="1" {...a} />
  </>,
);
export const TrendingUp = make(
  "TrendingUp",
  <path d="M3.5 17l5.5-5.5 3.5 3.5 7-7M15 8h4.5v4.5" />,
);
export const TrendingDown = make(
  "TrendingDown",
  <path d="M3.5 7l5.5 5.5 3.5-3.5 7 7M15 16h4.5v-4.5" />,
);

/* ---------------- Odamlar ---------------------------------------- */

export const User = make(
  "User",
  <>
    <circle cx="12" cy="8" r="3.8" {...a} />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
  </>,
);
export const UserPlus = make(
  "UserPlus",
  <>
    <circle cx="9" cy="8" r="3.5" {...a} />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M18.5 8v6M15.5 11h6" />
  </>,
);

/* ---------------- Mukofot va imtihon ----------------------------- */

export const Trophy = make(
  "Trophy",
  <>
    <path d="M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0z" {...a} />
    <path d="M7.5 6.5H5.5a2 2 0 0 0 0 4h2.3M16.5 6.5h2a2 2 0 0 1 0 4h-2.3" />
    <path d="M12 14v3.5" />
    <rect x="8.5" y="17.5" width="7" height="3" rx="1" />
  </>,
);
export const Medal = make(
  "Medal",
  <>
    <path d="M8 3.5l2.8 6.4M16 3.5l-2.8 6.4" />
    <circle cx="12" cy="15" r="5.3" {...a} />
  </>,
);
export const Award = make(
  "Award",
  <>
    <circle cx="12" cy="9" r="5.5" />
    <circle cx="12" cy="9" r="2.2" {...a} />
    <path d="M8.8 13.5l-1.3 7 4.5-2.5 4.5 2.5-1.3-7" />
  </>,
);
export const GraduationCap = make(
  "GraduationCap",
  <>
    <path d="M2.5 9.5L12 5l9.5 4.5L12 14z" {...a} />
    <path d="M6.5 11.7v4.3c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.3" />
    <path d="M21.5 9.5v5" />
  </>,
);
export const Gift = make(
  "Gift",
  <>
    <rect x="4" y="9" width="16" height="4" rx="1" />
    <path d="M5.5 13v6a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6" />
    <path d="M12 9v11.5" />
    <path
      d="M12 9C10.6 5.4 7.5 4.8 7.5 7c0 1.3 1.5 2 4.5 2zM12 9c1.4-3.6 4.5-4.2 4.5-2 0 1.3-1.5 2-4.5 2z"
      {...a}
    />
  </>,
);

/* ---------------- Media: video, ovoz ----------------------------- */

export const Youtube = make(
  "Youtube",
  <>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="M10 9.3v5.4l4.6-2.7z" {...a} />
  </>,
);
export const Pause = make(
  "Pause",
  <>
    <rect x="6.5" y="5.5" width="3.5" height="13" rx="1" {...a} />
    <rect x="14" y="5.5" width="3.5" height="13" rx="1" {...a} />
  </>,
);
const speaker = (
  <path d="M4.5 9.5h2.8L12 5.5v13l-4.7-4H4.5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" {...a} />
);
export const Volume2 = make(
  "Volume2",
  <>
    {speaker}
    <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" />
  </>,
);
export const VolumeX = make(
  "VolumeX",
  <>
    {speaker}
    <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
  </>,
);

/* ---------------- Yozuv quroli (PDF yozuv bölimi) ---------------- */

/** Flomaster */
export const Pen = make(
  "Pen",
  <>
    <path d="M16.5 4.5l3 3L9 18l-4.5 1.5L6 15z" />
    <path d="M6 15l3 3" />
  </>,
);
/** Pero — uçi urğuli */
export const PenTool = make(
  "PenTool",
  <>
    <path d="M12 20.5L6.5 11 9 4.5h6l2.5 6.5z" />
    <path d="M12 20.5v-7" />
    <circle cx="12" cy="11.5" r="1.6" {...a} />
  </>,
);
/** Möyqalam */
export const Brush = make(
  "Brush",
  <>
    <path d="M19.5 4.5l-7.4 7.4" />
    <path
      d="M10.4 13.1c-2.6-.6-4.9 1.1-4.9 3.6 0 1.2-.5 2.2-1.5 2.8 3 .6 6.6-.3 7.4-3a2.7 2.7 0 0 0-1-3.4z"
      {...a}
    />
  </>,
);
/** Qalam çizig'i */
export const PenLine = make(
  "PenLine",
  <>
    <path d="M14.5 5.5l3 3L8 18l-4 1 1-4z" />
    <path d="M12.5 20h7" />
  </>,
);
export const Highlighter = make(
  "Highlighter",
  <>
    <path d="M15.5 4l4.5 4.5-7.5 7.5L8 11.5z" />
    <path d="M8 11.5l-2.5 5 1.5 1.5 5-2.5" />
    <path d="M3.5 20.5h8" stroke={ACCENT} strokeWidth={2.6} />
  </>,
);
export const Eraser = make(
  "Eraser",
  <>
    <path d="M8.5 19.5L4 15a1.5 1.5 0 0 1 0-2.1l8.9-8.9a1.5 1.5 0 0 1 2.1 0l4.5 4.5a1.5 1.5 0 0 1 0 2.1L12 19.5z" />
    <path d="M8.4 8.5l7.1 7.1-3.5 3.9H8.5L4 15a1.5 1.5 0 0 1 0-2.1z" {...a} />
    <path d="M12 19.5h8" />
  </>,
);
export const Type = make("Type", <path d="M5 7.5V5h14v2.5M12 5v14M9 19h6" />);
export const Hand = make(
  "Hand",
  <path d="M8 12.5V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5M14 10.5v-4a1.5 1.5 0 0 1 3 0V14a6.5 6.5 0 0 1-6.5 6.5H10a6 6 0 0 1-4.6-2.2L3.9 16.4a1.5 1.5 0 0 1 2.3-1.9L8 16.5v-4" />,
);
export const Grid3x3 = make(
  "Grid3x3",
  <>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" />
  </>,
);

/* ---------------- Sovğa dökoni narsalari ------------------------- */

export const Ruler = make(
  "Ruler",
  <>
    <path d="M3.5 16l12.5-12.5 4.5 4.5L8 20.5z" {...a} />
    <path d="M7.5 12l2 2M10.5 9l2 2M13.5 6l2 2" />
  </>,
);
export const Calculator = make(
  "Calculator",
  <>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <rect x="8" y="6" width="8" height="3.5" rx="1" {...a} />
    <circle cx="8.8" cy="13.5" r="1" {...dot} />
    <circle cx="12" cy="13.5" r="1" {...dot} />
    <circle cx="15.2" cy="13.5" r="1" {...dot} />
    <circle cx="8.8" cy="17" r="1" {...dot} />
    <circle cx="12" cy="17" r="1" {...dot} />
    <circle cx="15.2" cy="17" r="1" {...dot} />
  </>,
);
export const Backpack = make(
  "Backpack",
  <>
    <path d="M6 10.5a6 6 0 0 1 12 0V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19z" />
    <path d="M10 4.8V3.5h4v1.3" />
    <rect x="8.5" y="13.5" width="7" height="4" rx="1.2" {...a} />
  </>,
);
export const Candy = make(
  "Candy",
  <>
    <circle cx="12" cy="12" r="3.8" {...a} />
    <path d="M8.4 10.6L4 8.5v7l4.4-2.1M15.6 10.6L20 8.5v7l-4.4-2.1" />
  </>,
);
export const Cake = make(
  "Cake",
  <>
    <rect x="4.5" y="12" width="15" height="8.5" rx="2" />
    <path d="M4.5 15.8c1.9 1.2 3.6 1.2 5 0s3.1-1.2 5 0 3.6 1.2 5 0" />
    <path d="M12 12V8.5" />
    <path d="M12 3.8c1.1 1.1 1.4 2.1 0 3-1.4-.9-1.1-1.9 0-3z" {...a} />
  </>,
);
export const IceCream = make(
  "IceCream",
  <>
    <path d="M7.5 11.5L12 21l4.5-9.5" />
    <path d="M7 11.5a5 5 0 1 1 10 0z" {...a} />
  </>,
);
export const Pizza = make(
  "Pizza",
  <>
    <path d="M3.8 8.6C6 6.6 8.9 5.5 12 5.5s6 1.1 8.2 3.1L19 10.3H5z" {...a} />
    <path d="M5 10.3l7 10.7 7-10.7" />
    <circle cx="10.3" cy="13.2" r="1.1" {...dot} />
    <circle cx="13.4" cy="15.8" r="1.1" {...dot} />
  </>,
);
export const Apple = make(
  "Apple",
  <>
    <path d="M12 8c-2-1.5-7.5-1.5-7.5 4.5 0 4 2.5 8 5 8 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c2.5 0 5-4 5-8 0-6-5.5-6-7.5-4.5z" />
    <path d="M12 8c0-1.6.4-2.8 1.2-3.6" />
    <path d="M13.3 5.6c.4-1.6 1.7-2.4 3.7-2.4-.3 1.7-1.6 2.5-3.7 2.4z" {...a} />
  </>,
);
export const Ticket = make(
  "Ticket",
  <>
    <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v2.5A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4z" />
    <path d="M15 8.3v1.2M15 11.4v1.2M15 14.5v1.2" />
    <rect x="7" y="10" width="4.5" height="4" rx="1" {...a} />
  </>,
);
export const Gamepad = make(
  "Gamepad",
  <>
    <path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 3.6l.8 4.3a2.4 2.4 0 0 1-4.2 2L16 15H8l-1.5 1.9a2.4 2.4 0 0 1-4.2-2l.8-4.3A4.5 4.5 0 0 1 7.5 7z" />
    <path d="M7.5 9.5v3M6 11h3" />
    <circle cx="15.5" cy="10" r="1.3" {...a} stroke="none" />
    <circle cx="17.3" cy="12.3" r="1.1" {...dot} />
  </>,
);
export const Headphones = make(
  "Headphones",
  <>
    <path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3" />
    <rect x="3.5" y="13.5" width="4" height="6.5" rx="1.5" {...a} />
    <rect x="16.5" y="13.5" width="4" height="6.5" rx="1.5" {...a} />
  </>,
);
export const Ball = make(
  "Ball",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8.3l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" {...a} />
    <path d="M12 8.3V3.5M15.6 10.9l4.4-1.5M14.2 15.1l2.7 3.8M9.8 15.1l-2.7 3.8M8.4 10.9L4 9.4" />
  </>,
);
export const Puzzle = make(
  "Puzzle",
  <path d="M5 7.5h4a2.2 2.2 0 1 1 4 0h4v4a2.2 2.2 0 1 1 0 4v4H5z" {...a} />,
);
export const Shirt = make(
  "Shirt",
  <>
    <path d="M9 4.5L4 7l1.5 4 2-1v9.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V10l2 1L20 7l-5-2.5c-.5 1.3-1.7 2-3 2s-2.5-.7-3-2z" />
    <rect x="13" y="11.5" width="2.5" height="2.5" rx=".6" {...a} stroke="none" />
  </>,
);
export const Smartphone = make(
  "Smartphone",
  <>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 5.5h3" />
    <circle cx="12" cy="18" r="1.3" {...a} stroke="none" />
  </>,
);
export const Watch = make(
  "Watch",
  <>
    <path d="M9 6.8l.6-3.3h4.8l.6 3.3M9 17.2l.6 3.3h4.8l.6-3.3" />
    <circle cx="12" cy="12" r="5.5" {...a} />
    <path d="M12 9.8V12l1.5 1" />
  </>,
);
export const Rocket = make(
  "Rocket",
  <>
    <path d="M12 3c3 2 4.5 5.5 4.5 9.5L15 16H9l-1.5-3.5C7.5 8.5 9 5 12 3z" />
    <circle cx="12" cy="9.5" r="1.8" />
    <path d="M7.5 12.5L5 15v3l4-2M16.5 12.5L19 15v3l-4-2" />
    <path d="M10 16l2 4.5 2-4.5z" {...a} />
  </>,
);
