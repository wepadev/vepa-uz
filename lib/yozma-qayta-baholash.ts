import "server-only";

import { matchesAnyKey } from "@/lib/javob-tengligi";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Yozma javoblarni ma'nosi böyiça qayta tekşiriş.
 *
 * `submit_timed_test` (bazada) yozma javobni kalit bilan harfma-harf
 * solişti radi. Öquvçi "-17/4" yozib, kalitda "$-\dfrac{17}4$"
 * tursa — xato deb belgilanadi. Test topşirilişi bilanoq şu funksiya
 * xato deb belgilangan yozma javoblarni son sifatida qayta tekşiradi
 * (lib/javob-tengligi.ts) va töğri çiqqanini töğri qilib qöyadi.
 *
 * Ball hisobi `set_answer_correctness` (db/39) bilan bir xil:
 * har töğri javob 2 ball, foiz urinişdagi maksimal ballga nisbatan.
 *
 * Faqat "xato -> töğri" tomonga özgartiradi. Xato bölsa jim qoladi:
 * natija baribir saqlangan, bu faqat qöşimça yordam.
 */
export async function regradeWrittenAnswers(attemptId: string): Promise<number> {
  try {
    const admin = createAdminClient();

    const { data: answers, error } = await admin
      .from("user_answers")
      .select("question_id, selected_answer, is_correct, questions!inner(question_type)")
      .eq("attempt_id", attemptId)
      .eq("is_correct", false)
      .eq("questions.question_type", "written");

    if (error || !answers?.length) return 0;

    const candidates = (answers as Array<{
      question_id: number;
      selected_answer: string | null;
    }>).filter((row) => (row.selected_answer ?? "").trim().length > 0);

    if (candidates.length === 0) return 0;

    const { data: keys } = await admin
      .from("answer_keys")
      .select("question_id, correct_answer, accepted_answers")
      .in(
        "question_id",
        candidates.map((row) => row.question_id),
      );

    const keyMap = new Map(
      ((keys ?? []) as Array<{
        question_id: number;
        correct_answer: string | null;
        accepted_answers: string[] | null;
      }>).map((key) => [
        key.question_id,
        [key.correct_answer, ...(key.accepted_answers ?? [])],
      ]),
    );

    const fixed = candidates
      .filter((row) =>
        matchesAnyKey(row.selected_answer ?? "", keyMap.get(row.question_id) ?? []),
      )
      .map((row) => row.question_id);

    if (fixed.length === 0) return 0;

    await admin
      .from("user_answers")
      .update({ is_correct: true })
      .eq("attempt_id", attemptId)
      .in("question_id", fixed);

    const [{ data: all }, { data: attempt }] = await Promise.all([
      admin.from("user_answers").select("is_correct").eq("attempt_id", attemptId),
      admin.from("attempts").select("total_questions").eq("id", attemptId).maybeSingle(),
    ]);

    const rows = (all ?? []) as Array<{ is_correct: boolean | null }>;
    const score = rows.filter((row) => row.is_correct).length * 2;
    const total =
      Number((attempt as { total_questions: number | null } | null)?.total_questions) ||
      rows.length * 2;

    await admin
      .from("attempts")
      .update({
        score,
        percentage: total > 0 ? Math.min(Math.round((score / total) * 10000) / 100, 100) : 0,
      })
      .eq("id", attemptId);

    // Uy vazifasi bali yangi foizga moslanadi (db/39)
    await admin.rpc("refresh_award_points", { p_attempt_id: attemptId });

    return fixed.length;
  } catch (error) {
    console.error("Yozma javoblar qayta tekşirilmadi:", error);
    return 0;
  }
}
