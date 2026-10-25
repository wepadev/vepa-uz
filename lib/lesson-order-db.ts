import type { createClient } from "@/lib/supabase/server";

import {
  planLessonReorder,
  type LessonOrderRow,
} from "@/lib/lesson-order";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Darsni bo'lim ichida berilgan o'ringa qo'yadi va qolganlarini
 * suradi. Xato bo'lsa matnini qaytaradi, hammasi joyida bo'lsa null.
 */
export async function moveLessonTo(
  supabase: SupabaseClient,
  categoryId: number,
  lessonId: number,
  position: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, order_number")
    .eq("category_id", categoryId);

  if (error) {
    return error.message;
  }

  const updates = planLessonReorder(
    (data ?? []) as LessonOrderRow[],
    lessonId,
    position,
  );

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("lessons")
      .update({ order_number: update.order_number })
      .eq("id", update.id)
      .eq("category_id", categoryId);

    if (updateError) {
      return updateError.message;
    }
  }

  return null;
}
