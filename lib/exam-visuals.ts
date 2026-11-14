import {
  Award,
  GraduationCap,
  NotebookPen,
  ScrollText,
  type IconComponent,
} from "@/components/ui/icons";

import type { Accent } from "@/components/ui/section-visual";

/**
 * Test yo'nalishlarining ikonka va rangi — bitta manba.
 *
 * Admin paneli ham, foydalanuvchi katalogi ham shu yerdan oladi.
 * Shu sababli ikkala tomonda ikonkalar hech qachon ajralib qolmaydi:
 * bu yerda o'zgartirsangiz, ikkalasida ham o'zgaradi.
 */
export type ExamCode =
  | "attestatsiya"
  | "milliy-sertifikat"
  | "sat"
  | "guruh-testlari";

export const EXAM_ICONS: Record<ExamCode, IconComponent> = {
  attestatsiya: Award,           // medal — pedagog attestatsiyasi
  "milliy-sertifikat": ScrollText, // sertifikat varaqasi
  sat: GraduationCap,            // akademik qalpoq
  "guruh-testlari": NotebookPen, // daftar + qalam — uy vazifasi
};

/*
 * Hamma yo'nalish bitta "tests" ohangida (ko'k).
 *
 * Rang bo'limlar GURUHIGA beriladi, alohida yo'nalishga emas:
 * Attestatsiya ham, Milliy sertifikat ham, SAT ham bitta ishning
 * turlari. Ularni rang emas, ikonka va nom ajratib turadi.
 */
export const EXAM_ACCENTS: Record<ExamCode, Accent> = {
  attestatsiya: "tests",
  "milliy-sertifikat": "tests",
  sat: "tests",
  "guruh-testlari": "tests",
};

/** Noma'lum kod kelsa ham sahifa buzilmasin */
export function examIcon(code: string): IconComponent {
  return EXAM_ICONS[code as ExamCode] ?? Award;
}

export function examAccent(code: string): Accent {
  return EXAM_ACCENTS[code as ExamCode] ?? "tests";
}

/**
 * Öquvçi sahifalari uçun yönaliş belgisi (components/ui/glyph.tsx).
 * Admin panel kiçik ikonkada (examIcon), öquvçi tomoni katta belgida.
 */
export function examGlyph(
  code: string,
): "attestation" | "certificate" | "sat" | "homework" | "tests" {
  /* Mock yönalişi asl yönaliş belgisini oladi: mock-sat -> sat */
  if (code.startsWith("mock-")) code = code.slice(5);

  switch (code) {
    case "attestatsiya":
      return "attestation";
    case "milliy-sertifikat":
      return "certificate";
    case "sat":
      return "sat";
    case "guruh-testlari":
      return "homework";
    default:
      return "tests";
  }
}
