import Link from "next/link";
import { redirect } from "next/navigation";
import { FileUp } from "lucide-react";

import PdfImportForm, {
  type SaveDraftState,
  type TopicOption,
} from "@/components/admin/pdf-import-form";
import AppAlert from "@/components/ui/app-alert";
import type { ParsedQuestion } from "@/lib/pdf-import";
import { saveParsedTest } from "@/lib/save-parsed-test";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ExamTypeRow = {
  id: number;
  code: string;
  title: string;
  order_number: number;
};

type SectionRow = {
  id: number;
  exam_type_id: number;
  title: string;
  order_number: number;
};

type TopicRow = {
  id: number;
  section_id: number;
  title: string;
  order_number: number;
};

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.is_active !== true) {
    redirect("/");
  }

  return supabase;
}

/** Ko'rib chiqilgan va tahrirlangan testni qoralama sifatida saqlaydi */
async function saveDraft(
  _previousState: SaveDraftState,
  formData: FormData,
): Promise<SaveDraftState> {
  "use server";

  // Auth redirectlari to'g'ri ishlashi uchun requireAdmin try/catch tashqarisida.
  const supabase = await requireAdmin();

  try {
    const topicId = Number(formData.get("topicId"));
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const timeLimit = Number(formData.get("timeLimitMinutes"));
    const payload = String(formData.get("questions") ?? "");

    if (!Number.isInteger(topicId) || topicId <= 0) {
      return {
        status: "error",
        message: "Mavzu tanlanmadi.",
        testId: null,
      };
    }

    /*
     * Bo'limni mavzudan olamiz: test ikkala ustunga ham yoziladi,
     * chunki uy vazifasi testini aniqlaydigan `is_group_only_test()`
     * va eski hisobotlar `section_id` ga tayanadi.
     */
    const { data: topicRow } = await supabase
      .from("test_topics")
      .select("id, section_id")
      .eq("id", topicId)
      .maybeSingle();

    if (!topicRow) {
      return {
        status: "error",
        message: "Tanlangan mavzu topilmadi.",
        testId: null,
      };
    }

    if (title.length < 2) {
      return {
        status: "error",
        message: "Test nomini kiriting.",
        testId: null,
      };
    }

    if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
      return {
        status: "error",
        message: "Vaqt çegarasi notöğri.",
        testId: null,
      };
    }

    let questions: ParsedQuestion[];

    try {
      questions = JSON.parse(payload) as ParsedQuestion[];
    } catch {
      return {
        status: "error",
        message: "Savollar röyxati öqilmadi.",
        testId: null,
      };
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return {
        status: "error",
        message: "Savollar böş.",
        testId: null,
      };
    }

    const { testId, error } = await saveParsedTest(supabase, {
      topicId,
      sectionId: topicRow.section_id as number,
      title,
      description: description || null,
      timeLimitMinutes: timeLimit,
      questions,
    });

    if (error || !testId) {
      return {
        status: "error",
        message: error ?? "Test saqlanmadi.",
        testId: null,
      };
    }

    return {
      status: "success",
      message: "Qoralama sifatida saqlandi.",
      testId,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Qoralamani saqlaşda xatolik yuz berdi.",
      testId: null,
    };
  }
}

export default async function AdminTestImportPage() {
  const supabase = await requireAdmin();

  const [examTypesResult, sectionsResult, topicsResult] = await Promise.all([
    supabase
      .from("test_exam_types")
      .select("id, code, title, order_number")
      .order("order_number", { ascending: true }),

    supabase
      .from("test_sections")
      .select("id, exam_type_id, title, order_number")
      .order("order_number", { ascending: true }),

    supabase
      .from("test_topics")
      .select("id, section_id, title, order_number")
      .order("order_number", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (examTypesResult.error || sectionsResult.error || topicsResult.error) {
    throw new Error(
      `Mavzular yuklanmadi: ${
        examTypesResult.error?.message ??
        sectionsResult.error?.message ??
        topicsResult.error?.message
      }`,
    );
  }

  const examTypes = (examTypesResult.data ?? []) as ExamTypeRow[];
  const sections = (sectionsResult.data ?? []) as SectionRow[];
  const topics = (topicsResult.data ?? []) as TopicRow[];

  const examTitleById = new Map(
    examTypes.map((exam) => [exam.id, exam.title]),
  );

  const sectionById = new Map(sections.map((section) => [section.id, section]));

  const options: TopicOption[] = topics.map((topic) => {
    const section = sectionById.get(topic.section_id);
    const examTitle = section
      ? examTitleById.get(section.exam_type_id) ?? "Boşqa"
      : "Boşqa";

    return {
      id: topic.id,
      title: topic.title,
      groupTitle: `${examTitle} · ${section?.title ?? "Bölimsiz"}`,
    };
  });

  /*
   * Ikkitadan biri yetarli: Gemini (bepul tarif bor) yoki Claude.
   *
   * DIQQAT: `.env.local` da `GEMINI_API_KEY=` deb yozib qiymatini
   * qo'ymaslik oson. Bunda `process.env` bo'sh satr qaytaradi —
   * u `undefined` emas, shuning uchun oddiy tekshiruv "kalit bor"
   * deb aldanib qolardi. Probel va tirnoqni olib tashlab qaraymiz.
   */
  const hasKey = (name: string) =>
    (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "").trim()
      .length > 0;

  const keyMissing = !hasKey("GEMINI_API_KEY") && !hasKey("ANTHROPIC_API_KEY");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
        <Link
          href="/admin/tests"
          className="inline-flex min-h-8 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
        >
          ← Testlarga qaytiş
        </Link>

        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <FileUp className="h-6 w-6 text-mb-muted" strokeWidth={2} aria-hidden="true" />
          PDF’dan test yaratiş
        </h1>

        <p className="mt-2 text-sm leading-6 text-mb-muted">
          PDF’ni yuklaysiz, tizim savollarni, javob kalitini va yeçimlarni
          ajratib beradi. Saqlaşdan oldin har birini körib çiqasiz va
          kerak bölsa tuzatasiz. Test har doim qoralama holida saqlanadi.
        </p>

        {keyMissing && (
          <AppAlert
            variant="warning"
            title="AI kaliti qöyilmagan — şuning uçun işlamayapti"
            className="mt-5"
          >
            <span className="block">
              PDF’ni öqiş uçun kalit kerak. Bepul yöl bor:
            </span>

            <span className="mt-2 block">
              1. <b>aistudio.google.com/apikey</b> ga kiring, Google hisobi
              bilan kirib <b>“Create API key”</b> ni bosing. Karta
              söralmaydi, kuniga ~1500 sörov bepul — bizga
              yetib ortadi.
            </span>

            <span className="mt-1.5 block">
              2. Kalitni <b>GEMINI_API_KEY</b> nomi bilan ikki joyga
              qöying: loyihadagi <b>.env.local</b> fayliga va{" "}
              <b>Vercel → Settings → Environment Variables</b> ga.
            </span>

            <span className="mt-1.5 block">
              3. Vercel’da qayta deploy qiling, kompyuterda esa{" "}
              <b>npm run dev</b> ni qaytadan işga tuşiring.
            </span>

            <span className="mt-2 block text-[13px]">
              Kalit qöygandan keyin{" "}
              <a
                href="/api/admin/ai-status"
                className="font-bold underline"
              >
                şu yerni bosib
              </a>{" "}
              tekşirib körsangiz böladi — u kalit
              işlayaptimi va qaysi model tanlanganini aytadi.
            </span>
          </AppAlert>
        )}

        {options.length === 0 ? (
          <AppAlert variant="info" title="Avval mavzu yarating" className="mt-5">
            Test qöşiş uçun kamida bitta mavzu bölişi kerak.
          </AppAlert>
        ) : (
          <PdfImportForm
            topics={options}
            saveDraft={saveDraft}
            disabled={keyMissing}
          />
        )}
      </section>
    </main>
  );
}
