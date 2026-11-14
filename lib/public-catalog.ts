import "server-only";

import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicCatalog = {
  testCount: number;
  lessonCount: number;
  textbookCount: number;
  examTypes: string[];
  lessonCategories: string[];
};

/**
 * Bosh sahifada mehmonga ko'rsatiladigan katalog: nechta test,
 * dars va darslik borligi hamda bo'lim nomlari.
 *
 * Tizimga kirmagan foydalanuvchining bazani o'qish huquqi yo'q,
 * shuning uchun admin mijozi ishlatiladi — lekin faqat nashr
 * qilingan narsalarning soni va nomi olinadi, boshqa hech narsa.
 *
 * Natija bir soatga saqlanadi: har bir mehmon bazaga so'rov
 * yubormasin. Xato bo'lsa `null` — bosh sahifa katalogsiz chiqadi.
 */
export const getPublicCatalog = unstable_cache(
  async (): Promise<PublicCatalog | null> => {
    try {
      const admin = createAdminClient();

      const [tests, lessons, textbooks, examTypes, categories] =
        await Promise.all([
          admin
            .from("tests")
            .select("id", { count: "exact", head: true })
            .eq("is_published", true),
          admin
            .from("lessons")
            .select("id", { count: "exact", head: true })
            .eq("is_published", true),
          admin
            .from("textbooks")
            .select("id", { count: "exact", head: true })
            .eq("is_published", true),
          admin
            .from("test_exam_types")
            .select("title")
            .eq("is_published", true)
            /* Mock testlar /mock da, katalogda emas (lib/mock.ts) */
            .not("code", "like", "mock-%")
            .order("order_number", { ascending: true }),
          admin
            .from("lesson_categories")
            .select("title")
            .eq("is_published", true)
            .order("order_number", { ascending: true }),
        ]);

      if (tests.error || lessons.error || textbooks.error) {
        return null;
      }

      const titles = (rows: { title: string }[] | null) =>
        (rows ?? []).map((row) => row.title).filter(Boolean);

      return {
        testCount: tests.count ?? 0,
        lessonCount: lessons.count ?? 0,
        textbookCount: textbooks.count ?? 0,
        examTypes: titles(examTypes.data),
        lessonCategories: titles(categories.data),
      };
    } catch {
      return null;
    }
  },
  ["public-catalog"],
  { revalidate: 3600 },
);
