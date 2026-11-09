/*
 * Sayt navigatsiyasining yagona ro'yxati.
 *
 * Telefondagi pastki tab bar va menyu, kompyuterdagi tepadagi menyu
 * — hammasi shu yerdan oladi. Yangi bo'lim qo'shilsa, bitta joyda
 * yoziladi va hamma joyda bir xil chiqadi.
 */

export type NavUser = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Guruhga qo'shilganmi — vazifalar va do'kon shunga qarab chiqadi */
  isInGroup: boolean;
};

export type NavLink = {
  href: string;
  label: string;
  hint: string;
  /** Faol deb belgilash uchun yo'l boshi (href'dan farq qilsa) */
  match?: string;
};

export type NavSection = {
  title: string;
  links: NavLink[];
};

/** Bo'limlar tizimga kirmaganga login sahifasini ochadi */
export function authHref(user: NavUser, href: string) {
  return user.isAuthenticated
    ? href
    : `/auth/login?next=${encodeURIComponent(href)}`;
}

/** Mehmon uchun ochiq katalogning tegishli qismi */
const GUEST_CATALOG: Record<string, string> = {
  "/tests": "/katalog#testlar",
  "/lessons": "/katalog#darslar",
  "/textbooks": "/katalog#yecimlar",
};

function catalogHref(user: NavUser, href: string) {
  return user.isAuthenticated ? href : GUEST_CATALOG[href] ?? authHref(user, href);
}

/** Asosiy o'quv bo'limlari — kompyuter menyusida birinchi turadi */
export function primaryLinks(user: NavUser): NavLink[] {
  return [
    ...(user.isAuthenticated && user.isInGroup
      ? [
          {
            href: "/homework",
            label: "Vazifalar",
            hint: "Guruhga berilgan uy vazifalari",
          },
        ]
      : []),
    {
      href: catalogHref(user, "/tests"),
      match: "/tests",
      label: "Testlar",
      hint: "Attestatsiya, Milliy sertifikat, SAT",
    },
    {
      href: catalogHref(user, "/lessons"),
      match: "/lessons",
      label: "Darslar",
      hint: "Mavzular böyiça videodarslar",
    },
    {
      href: catalogHref(user, "/textbooks"),
      match: "/textbooks",
      label: "Yeçimlar",
      hint: "5–11-sinf va TOP kitoblar",
    },
  ];
}

/**
 * "Menyu" / "Yana" ichidagi havolalar, ikki guruhda:
 * guruh hayoti va o'quvchining o'zi.
 */
export function menuSections(user: NavUser): NavSection[] {
  if (!user.isAuthenticated) {
    return [
      {
        title: "Hisob",
        links: [
          { href: "/auth/login", label: "Kiriş", hint: "Email yoki Google orqali" },
          {
            href: "/auth/login?mode=signup",
            label: "Röyxatdan ötiş",
            hint: "Yangi hisob yaratiş",
          },
          { href: "/pricing", label: "Premium", hint: "Tarif va narxlar" },
        ],
      },
    ];
  }

  const sections: NavSection[] = [
    {
      title: "Guruh",
      links: [
        {
          href: "/guruhim",
          label: "Guruhim",
          hint: user.isInGroup
            ? "Ballar, tangalar va guruh reytingi"
            : "Guruh kodini kiritib qöşiliş",
        },
        ...(user.isInGroup
          ? [
              {
                href: "/dokon",
                label: "Dökon",
                hint: "Tangani sovğaga almaştiriş",
              },
            ]
          : []),
        { href: "/leaderboard", label: "Reyting", hint: "Eng faol öquvçilar" },
      ],
    },
    {
      title: "Men",
      links: [
        { href: "/results", label: "Natijalarim", hint: "Işlangan testlar tahlili" },
        {
          href: "/takrorlash",
          label: "Haftalik takrorlaş",
          hint: "Hafta davomidagi xatolar",
        },
        { href: "/profile", label: "Profilim", hint: "Şaxsiy ma’lumotlar" },
        { href: "/pricing", label: "Premium", hint: "Tarif va tölovlar" },
      ],
    },
  ];

  if (user.isAdmin) {
    sections.push({
      title: "Boşqaruv",
      links: [
        { href: "/admin", label: "Admin panel", hint: "Platformani boşqariş" },
      ],
    });
  }

  return sections;
}

/** Navigatsiya ko'rinmaydigan yo'llar (o'z sarlavhasi yoki to'liq ekran) */
export const NAV_HIDDEN_PREFIXES = [
  "/auth",
  "/admin",
  "/tests/take",
  "/access-denied",
  "/access-required",
  "/ota-ona",
];

export function isNavHidden(pathname: string) {
  return NAV_HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isActivePath(pathname: string, match: string) {
  if (match === "/") return pathname === "/";

  const path = match.split("?")[0];

  return pathname === path || pathname.startsWith(`${path}/`);
}
