/**
 * Vepa Ustoz vizual tizimi — bo'lim ohanglari.
 *
 * MUAMMO: hamma narsa bitta ko'kda bo'lsa sayt zerikarli va
 * bo'limlar bir-biridan ajralmaydi; har bo'limga o'z rangi berilsa
 * ola-chipor bo'lib ketadi.
 *
 * YECHIM: rang alohida bo'limga emas, bo'limlar GURUHIGA beriladi.
 * To'rtta guruh, to'rtta ohang. Ohanglar bitta palitradan: hammasi
 * Tailwind'ning 600-pog'onasi, ya'ni bir xil to'qlik va to'yinganlik
 * — shuning uchun yonma-yon turganda bir oila bo'lib ko'rinadi.
 *
 * Ranglar ko'zga emas, o'lchab tanlangan (OKLab ΔE): eng yaqin juft
 * ham oddiy ko'rishda 27, rang ko'rmaslikda 25 birlik uzoqlikda —
 * ya'ni dalton bo'lgan odam ham ularni adashtirmaydi.
 *
 * QOIDA — ohang va holat rangini aralashtirmang:
 *   - OHANG  = ikonka ostidagi yumshoq plitka (bo'lim qayerga
 *     tegishli ekanini aytadi);
 *   - HOLAT  = matnli yumaloq yorliq: yashil "Bepul", sariq
 *     "Qoralama", qizil "Xato".
 * Ikkalasi hech qachon bitta elementda uchrashmaydi, shuning uchun
 * yashil va sariq ikkala vazifani ham bemalol bajaradi.
 *
 * Tugmalar OHANG OLMAYDI — ular doim brend ko'kida. Rang bu yerda
 * "bu qayer" degan savolga javob beradi, "bu muhim" degan emas.
 */
export type Accent =
  /** Testlar, test tekshirish, imtihon taymeri, Premium */
  | "tests"
  /** Guruhlar, o'quvchilar, foydalanuvchilar */
  | "people"
  /** Darsliklar, videodarslar, takrorlash, do'kon */
  | "content"
  /** Natijalar, analitika, reyting */
  | "insight"
  /** Texnik xizmat va boshqa xizmat bo'limlari */
  | "system";

/*
 * 2026-11: to'rtta pastel ohang (ko'k, yashil, sariq, binafsha)
 * yonma-yon turganda sahifa ola-chipor ko'rinardi. Endi hamma
 * guruh bitta plitkada — brend ko'kining och toni. Bo'limlar rang
 * bilan emas, BELGI bilan farqlanadi (components/ui/glyph.tsx).
 * Guruh nomlari (tests, people, ...) eski kod uchun saqlangan.
 */
const TONE = {
  tint: "bg-blue-50",
  icon: "text-blue-700",
  tile: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100",
  button: "bg-mb-brand hover:bg-mb-brandDark",
  softBox: "bg-blue-50 text-blue-700",
};

export const accents: Record<
  Accent,
  {
    /** Karta rasm zonasining foni */
    tint: string;
    /** Ikonka rangi */
    icon: string;
    /** Ikonka plitkasi: fon + rang birga */
    tile: string;
    /** Asosiy tugma — doim brend ko'ki */
    button: string;
    /** Guruh sarlavhasi uchun yumshoq quti */
    softBox: string;
  }
> = {
  tests: TONE,
  people: TONE,
  content: TONE,
  insight: TONE,
  system: {
    tint: "bg-slate-100",
    icon: "text-slate-600",
    tile: "bg-slate-100 text-slate-600",
    button: "bg-mb-brand hover:bg-mb-brandDark",
    softBox: "bg-slate-100 text-slate-600",
  },
};
