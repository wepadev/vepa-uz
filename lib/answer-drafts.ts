import { createClient } from "@/lib/supabase/client";

/**
 * Test ishlashda javoblarni yo'qotmaslik.
 *
 * Ikki qatlam bor:
 *
 *  1. `localStorage` — bir zumda, aloqasiz ham ishlaydi. Sahifa
 *     yangilansa, brauzer yopilsa yoki telefon o'chib qolsa ham
 *     javoblar shu yerdan tiklanadi.
 *
 *  2. Baza (`save_answer_draft`) — sekinroq, lekin brauzer tozalansa
 *     yoki o'quvchi boshqa qurilmadan kirsa ham javoblar joyida.
 *
 * Ikkalasi ham baholashga umuman ta'sir qilmaydi: yakuniy natija
 * ilgarigidek forma orqali yuborilgan javoblardan hisoblanadi.
 * Qoralama faqat yo'qolgan ishni qaytarish uchun.
 */

/** Bir sessiya uchun brauzer xotirasidagi kalit */
export function draftStorageKey(sessionId: string) {
  return `vepa-ustoz-javoblar-${sessionId}`;
}

/**
 * Brauzer xotirasidan o'qish.
 *
 * `sessionStorage` emas, `localStorage`: birinchisi ilova yopilganda
 * o'chib ketadi, ya'ni aynan biz himoyalamoqchi bo'lgan holatda
 * yordam bermaydi.
 */
export function readLocalDraft(sessionId: string) {
  try {
    const saved = window.localStorage.getItem(
      draftStorageKey(sessionId),
    );

    if (!saved) return null;

    const parsed: unknown = JSON.parse(saved);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        result[key] = value;
      }
    }

    return result;
  } catch {
    // Buzilgan yozuv — tozalab, qoralamasiz davom etamiz
    try {
      window.localStorage.removeItem(draftStorageKey(sessionId));
    } catch {
      /* xotira umuman ishlamayapti — e'tiborsiz qoldiramiz */
    }

    return null;
  }
}

/** Brauzer xotirasiga yozish */
export function writeLocalDraft(
  sessionId: string,
  answers: Record<string, string>,
) {
  try {
    window.localStorage.setItem(
      draftStorageKey(sessionId),
      JSON.stringify(answers),
    );
  } catch {
    /*
     * Xotira to'lgan yoki brauzer taqiqlagan bo'lishi mumkin.
     * Bu test ishlashga xalaqit bermasligi kerak — jim o'tamiz.
     */
  }
}

/** Test yuborilgach brauzer xotirasini tozalash */
export function clearLocalDraft(sessionId: string) {
  try {
    window.localStorage.removeItem(draftStorageKey(sessionId));
  } catch {
    /* e'tiborsiz */
  }
}

/**
 * Bitta javobni bazaga yozish.
 *
 * Ataylab hech qanday xato tashlamaydi va hech narsa qaytarmaydi:
 * aloqa uzilgani uchun o'quvchiga ogohlantirish chiqarish yoki
 * testni to'xtatish noto'g'ri bo'lardi. Brauzer xotirasi baribir
 * ishlab turadi.
 */
export async function saveRemoteDraft(
  sessionId: string,
  questionId: number,
  answer: string,
) {
  try {
    const supabase = createClient();

    await supabase.rpc("save_answer_draft", {
      p_session_id: sessionId,
      p_question_id: questionId,
      p_answer: answer,
    });
  } catch {
    /* aloqa yo'q — brauzer xotirasi yetarli */
  }
}
