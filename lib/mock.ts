/**
 * "Mock testlar" bölimi (db/43).
 *
 * Mock test — oddiy test, faqat kodi `mock-` bilan boşlanadigan
 * yönalişda turadi. Bunday yönaliş /tests katalogida körinmaydi,
 * /mock sahifasida çiqadi.
 */

export const MOCK_PREFIX = "mock-";

export function isMockExamCode(code: string | null | undefined): boolean {
  return typeof code === "string" && code.startsWith(MOCK_PREFIX);
}

/** /mock dagi kartoçkalar tartibi va qisqa izohi */
export const MOCK_EXAMS: Array<{
  code: string;
  title: string;
  hint: string;
}> = [
  {
    code: "mock-milliy-sertifikat",
    title: "Milliy sertifikat",
    hint: "45 topşiriq · original va namunaviy variantlar",
  },
  {
    code: "mock-attestatsiya",
    title: "Attestatsiya",
    hint: "Pedagoglar attestatsiyasi formatida",
  },
  {
    code: "mock-sat",
    title: "SAT",
    hint: "SAT Math formatida",
  },
];

type SupabaseLike = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/** Test mock yönalişidami */
export async function isMockTest(
  supabase: SupabaseLike,
  testId: number,
): Promise<boolean> {
  const { data } = await supabase
    .from("tests")
    .select("test_sections(test_exam_types(code))")
    .eq("id", testId)
    .maybeSingle();

  const section = (data as { test_sections?: unknown } | null)?.test_sections;
  const sectionRow = (Array.isArray(section) ? section[0] : section) as
    | { test_exam_types?: unknown }
    | null
    | undefined;
  const exam = sectionRow?.test_exam_types;
  const examRow = (Array.isArray(exam) ? exam[0] : exam) as
    | { code?: string }
    | null
    | undefined;

  return isMockExamCode(examRow?.code);
}
