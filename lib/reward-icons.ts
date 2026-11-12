import {
  Apple,
  Backpack,
  Ball,
  BookOpen,
  Cake,
  Calculator,
  Candy,
  ClipboardList,
  Coins,
  Compass,
  Crown,
  Eraser,
  Gamepad,
  Gift,
  GraduationCap,
  Headphones,
  IceCream,
  KeyRound,
  Medal,
  Pen,
  Pencil,
  Pizza,
  Puzzle,
  Rocket,
  Ruler,
  Shirt,
  ShoppingBag,
  Smartphone,
  Star,
  Ticket,
  Trophy,
  Watch,
  type IconComponent,
} from "@/components/ui/icons";

/**
 * Sovğa dökoni uçun ikonkalar.
 *
 * Hammasi özimiz çizgan töplamdan (components/ui/icons.tsx): bitta
 * qalinlik, bitta sariq urğu. Röyxat ataylab qisqa — 75 ta tayyor
 * ikonka örniga sovğaga keraklilari.
 *
 * Bazada faqat kalit saqlanadi (masalan "notebook"), komponent emas.
 * Eski kalitlar (avvalgi katta röyxatdan) `LEGACY` orqali eng yaqin
 * yangi ikonkaga yönaltiriladi — bazani özgartiriş şart emas.
 */
export type RewardIconKey = string;

type RewardIcon = { key: string; icon: IconComponent; label: string };

export const REWARD_ICON_GROUPS: Array<{
  title: string;
  icons: RewardIcon[];
}> = [
  {
    title: "Mukofot",
    icons: [
      { key: "gift", icon: Gift, label: "Sovğa" },
      { key: "trophy", icon: Trophy, label: "Kubok" },
      { key: "medal", icon: Medal, label: "Medal" },
      { key: "star", icon: Star, label: "Yulduz" },
      { key: "crown", icon: Crown, label: "Toj" },
      { key: "coins", icon: Coins, label: "Tanga" },
    ],
  },
  {
    title: "Öquv qurollari",
    icons: [
      { key: "notebook", icon: ClipboardList, label: "Daftar" },
      { key: "book", icon: BookOpen, label: "Kitob" },
      { key: "pen", icon: Pen, label: "Ruçka" },
      { key: "pencil", icon: Pencil, label: "Qalam" },
      { key: "eraser", icon: Eraser, label: "Öçirğiç" },
      { key: "ruler", icon: Ruler, label: "Çizğiç" },
      { key: "calculator", icon: Calculator, label: "Kalkulyator" },
      { key: "backpack", icon: Backpack, label: "Sumka" },
      { key: "graduation", icon: GraduationCap, label: "Bitiruv" },
    ],
  },
  {
    title: "Şirinlik va ovqat",
    icons: [
      { key: "candy", icon: Candy, label: "Konfet" },
      { key: "cake", icon: Cake, label: "Tort" },
      { key: "ice-cream", icon: IceCream, label: "Muzqaymoq" },
      { key: "pizza", icon: Pizza, label: "Pitsa" },
      { key: "apple", icon: Apple, label: "Meva" },
    ],
  },
  {
    title: "Köngiloçar",
    icons: [
      { key: "ticket", icon: Ticket, label: "Çipta" },
      { key: "gamepad", icon: Gamepad, label: "Öyin" },
      { key: "headphones", icon: Headphones, label: "Quloqçin" },
      { key: "ball", icon: Ball, label: "Töp" },
      { key: "puzzle", icon: Puzzle, label: "Boşqotirma" },
    ],
  },
  {
    title: "Boşqa",
    icons: [
      { key: "shopping-bag", icon: ShoppingBag, label: "Xarid" },
      { key: "shirt", icon: Shirt, label: "Kiyim" },
      { key: "smartphone", icon: Smartphone, label: "Telefon" },
      { key: "watch", icon: Watch, label: "Soat" },
      { key: "rocket", icon: Rocket, label: "Raketa" },
      { key: "compass", icon: Compass, label: "Kompas" },
      { key: "key", icon: KeyRound, label: "Kalit" },
    ],
  },
];

/** Avvalgi röyxatdagi kalitlar -> eng yaqin yangi kalit */
const LEGACY: Record<string, string> = {
  award: "medal",
  badge: "medal",
  "badge-check": "medal",
  sparkles: "star",
  sticker: "star",
  heart: "star",
  smile: "star",
  "thumbs-up": "star",
  handshake: "star",
  gem: "crown",
  party: "gift",
  flag: "trophy",
  target: "trophy",
  "notebook-pen": "notebook",
  highlighter: "pen",
  brush: "pencil",
  palette: "pencil",
  scissors: "pencil",
  bookmark: "book",
  "book-open": "book",
  library: "book",
  newspaper: "book",
  school: "graduation",
  presentation: "book",
  lollipop: "candy",
  cookie: "cake",
  donut: "cake",
  croissant: "cake",
  milk: "cake",
  coffee: "cake",
  banana: "apple",
  popcorn: "ticket",
  video: "ticket",
  camera: "smartphone",
  music: "headphones",
  mic: "headphones",
  dices: "gamepad",
  bike: "ball",
  volleyball: "ball",
  zap: "rocket",
  flame: "rocket",
  timer: "watch",
  hourglass: "watch",
  trees: "compass",
  globe: "compass",
};

/** Kalit -> komponent jadvali. Tez qidiriş uçun bir marta yasaladi. */
const BY_KEY = new Map<string, IconComponent>(
  REWARD_ICON_GROUPS.flatMap((group) =>
    group.icons.map((item) => [item.key, item.icon] as const),
  ),
);

/** Eski kalitni yangisiga aylantiradi (tanlov oynasida belgilaş uçun) */
export function normalizeRewardIconKey(key: string | null | undefined) {
  if (!key) return "gift";
  if (BY_KEY.has(key)) return key;
  return LEGACY[key] ?? "gift";
}

/** Ikonka nomi böyiça komponent. Topilmasa — sovğa ikonkasi. */
export function rewardIcon(key: string | null | undefined): IconComponent {
  return BY_KEY.get(normalizeRewardIconKey(key)) ?? Gift;
}

/** Röyxatdagi barça ikonkalar soni — ekranda körsatiş uçun */
export const REWARD_ICON_COUNT = BY_KEY.size;
