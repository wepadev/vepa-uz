import {
  Apple,
  Award,
  Backpack,
  Badge,
  BadgeCheck,
  Banana,
  Bike,
  Book,
  BookOpen,
  Bookmark,
  Brush,
  Cake,
  Calculator,
  Camera,
  Candy,
  Coffee,
  Coins,
  Compass,
  Cookie,
  Croissant,
  Dices,
  Donut,
  Eraser,
  Flag,
  Flame,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Handshake,
  Headphones,
  Heart,
  Highlighter,
  Hourglass,
  IceCreamCone,
  Key,
  Library,
  Lollipop,
  Medal,
  Mic,
  Milk,
  Music,
  Newspaper,
  Notebook,
  NotebookPen,
  Palette,
  PartyPopper,
  PenTool,
  Pencil,
  Pizza,
  Popcorn,
  Presentation,
  Puzzle,
  Rocket,
  Ruler,
  School,
  Scissors,
  Shirt,
  ShoppingBag,
  Smartphone,
  Smile,
  Sparkles,
  Star,
  Sticker,
  Target,
  ThumbsUp,
  Ticket,
  Timer,
  Trees,
  Trophy,
  Video,
  Volleyball,
  Watch,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Sovg'a do'koni uchun ikonkalar.
 *
 * Butun sayt lucide-react ishlatadi — bu yerda ham o'sha to'plamdan
 * olinadi, shunda ikonkalar bir uslubda bo'ladi.
 *
 * Ro'yxat ataylab tanlangan: lucide'da mingdan ortiq ikonka bor,
 * lekin ularning ko'pi sovg'aga aloqasiz. Bu yerda faqat o'quv
 * qurollari, mukofot, shirinlik va ko'ngilochar narsalar.
 *
 * Bazada faqat kalit saqlanadi (masalan "notebook"), komponent emas.
 */
export type RewardIconKey = string;

export const REWARD_ICON_GROUPS: Array<{
  title: string;
  icons: Array<{ key: string; icon: LucideIcon; label: string }>;
}> = [
  {
    title: "Mukofot",
    icons: [
      { key: "gift", icon: Gift, label: "Sovğa" },
      { key: "trophy", icon: Trophy, label: "Kubok" },
      { key: "medal", icon: Medal, label: "Medal" },
      { key: "award", icon: Award, label: "Mukofot" },
      { key: "star", icon: Star, label: "Yulduz" },
      { key: "sparkles", icon: Sparkles, label: "Uçqun" },
      { key: "gem", icon: Gem, label: "Qimmatbaho toş" },
      { key: "badge", icon: Badge, label: "Nişon" },
      { key: "badge-check", icon: BadgeCheck, label: "Tasdiq nişoni" },
      { key: "party", icon: PartyPopper, label: "Bayram" },
      { key: "sticker", icon: Sticker, label: "Stiker" },
      { key: "flag", icon: Flag, label: "Bayroq" },
      { key: "target", icon: Target, label: "Nişon" },
      { key: "coins", icon: Coins, label: "Tanga" },
    ],
  },
  {
    title: "Öquv qurollari",
    icons: [
      { key: "notebook", icon: Notebook, label: "Daftar" },
      { key: "notebook-pen", icon: NotebookPen, label: "Daftar va ruçka" },
      { key: "pen", icon: PenTool, label: "Ruçka" },
      { key: "pencil", icon: Pencil, label: "Qalam" },
      { key: "highlighter", icon: Highlighter, label: "Marker" },
      { key: "eraser", icon: Eraser, label: "Öçirğiç" },
      { key: "ruler", icon: Ruler, label: "Çizğiç" },
      { key: "calculator", icon: Calculator, label: "Kalkulyator" },
      { key: "backpack", icon: Backpack, label: "Sumka" },
      { key: "scissors", icon: Scissors, label: "Qayçi" },
      { key: "brush", icon: Brush, label: "Möyqalam" },
      { key: "palette", icon: Palette, label: "Böyoq" },
      { key: "bookmark", icon: Bookmark, label: "Xatçöp" },
    ],
  },
  {
    title: "Kitob va bilim",
    icons: [
      { key: "book", icon: Book, label: "Kitob" },
      { key: "book-open", icon: BookOpen, label: "Oçiq kitob" },
      { key: "library", icon: Library, label: "Kutubxona" },
      { key: "newspaper", icon: Newspaper, label: "Gazeta" },
      { key: "graduation", icon: GraduationCap, label: "Bitiruv" },
      { key: "school", icon: School, label: "Maktab" },
      { key: "presentation", icon: Presentation, label: "Taqdimot" },
    ],
  },
  {
    title: "Şirinlik va ovqat",
    icons: [
      { key: "candy", icon: Candy, label: "Konfet" },
      { key: "lollipop", icon: Lollipop, label: "Karamel" },
      { key: "cookie", icon: Cookie, label: "Peçenye" },
      { key: "cake", icon: Cake, label: "Tort" },
      { key: "donut", icon: Donut, label: "Ponçik" },
      { key: "ice-cream", icon: IceCreamCone, label: "Muzqaymoq" },
      { key: "popcorn", icon: Popcorn, label: "Popkorn" },
      { key: "pizza", icon: Pizza, label: "Pitsa" },
      { key: "croissant", icon: Croissant, label: "Kruassan" },
      { key: "apple", icon: Apple, label: "Olma" },
      { key: "banana", icon: Banana, label: "Banan" },
      { key: "milk", icon: Milk, label: "Sut" },
      { key: "coffee", icon: Coffee, label: "Çoy" },
    ],
  },
  {
    title: "Köngiloçar",
    icons: [
      { key: "music", icon: Music, label: "Musiqa" },
      { key: "headphones", icon: Headphones, label: "Quloqçin" },
      { key: "gamepad", icon: Gamepad2, label: "Öyin" },
      { key: "dices", icon: Dices, label: "Zar" },
      { key: "puzzle", icon: Puzzle, label: "Boşqotirma" },
      { key: "ticket", icon: Ticket, label: "Çipta" },
      { key: "video", icon: Video, label: "Video" },
      { key: "camera", icon: Camera, label: "Kamera" },
      { key: "mic", icon: Mic, label: "Mikrofon" },
      { key: "bike", icon: Bike, label: "Velosiped" },
      { key: "volleyball", icon: Volleyball, label: "Töp" },
    ],
  },
  {
    title: "Boşqa",
    icons: [
      { key: "shopping-bag", icon: ShoppingBag, label: "Xarid" },
      { key: "shirt", icon: Shirt, label: "Kiyim" },
      { key: "watch", icon: Watch, label: "Soat" },
      { key: "smartphone", icon: Smartphone, label: "Telefon" },
      { key: "heart", icon: Heart, label: "Yurak" },
      { key: "smile", icon: Smile, label: "Tabassum" },
      { key: "thumbs-up", icon: ThumbsUp, label: "Zör" },
      { key: "handshake", icon: Handshake, label: "Qöl beriş" },
      { key: "rocket", icon: Rocket, label: "Raketa" },
      { key: "zap", icon: Zap, label: "Çaqmoq" },
      { key: "flame", icon: Flame, label: "Alanga" },
      { key: "key", icon: Key, label: "Kalit" },
      { key: "timer", icon: Timer, label: "Sekundomer" },
      { key: "hourglass", icon: Hourglass, label: "Qum soat" },
      { key: "trees", icon: Trees, label: "Daraxt" },
      { key: "globe", icon: Globe, label: "Globus" },
      { key: "compass", icon: Compass, label: "Kompas" },
    ],
  },
];

/** Kalit -> komponent jadvali. Tez qidirish uchun bir marta yasaladi. */
const BY_KEY = new Map<string, LucideIcon>(
  REWARD_ICON_GROUPS.flatMap((group) =>
    group.icons.map((item) => [item.key, item.icon] as const),
  ),
);

/** Ikonka nomi bo'yicha komponent. Topilmasa — sovg'a ikonkasi. */
export function rewardIcon(key: string | null | undefined): LucideIcon {
  return (key && BY_KEY.get(key)) || Gift;
}

/** Ro'yxatdagi barcha ikonkalar soni — ekranda ko'rsatish uchun */
export const REWARD_ICON_COUNT = BY_KEY.size;
