/**
 * Yozma yeçimlar fayli (`content/yechimlar/NN.md`).
 *
 * TUZILIŞI:
 *
 *     # 25. Çiziqli tenglamalar
 *
 *     ## 1-test
 *
 *     ### 1 [A]
 *     Ikkala tomonni 8 ga bölamiz: $x = -4$.
 *
 *     Javob: $-4$.
 *
 * `### 1 [A]` — testdagi savol raqami (faqat variantli savollar
 * sanaladi, kalitdagi raqam bilan bir xil) va kalitdagi töğri javob.
 * Harf faqat tekşiruv uçun: nashr qilişda bazadagi töğri javob bilan
 * solişiriladi, mos kelmasa yeçim yozilmaydi. Yeçim matnining
 * özida harf yozilmaydi — saytda variantlar aralaştirib körsatiladi.
 *
 * Bu fayl ATAYLAB hech narsa import qilmaydi — `tests/` dagi
 * testlar uni töğridan-töğri çaqiradi.
 */

export type Letter = "A" | "B" | "C" | "D";

export type SolutionItem = {
  /** Testdagi savol raqami (1 dan) */
  number: number;
  /** Kalitdagi töğri javob — tekşiruv uçun */
  answer: Letter;
  text: string;
};

export type SolutionFile = {
  /** Mavzu raqami (1-89) */
  topic: number;
  title: string;
  /** test raqami -> savollar (raqam bö'yiça tartiblangan) */
  tests: Map<number, SolutionItem[]>;
  errors: string[];
};

const TOPIC_HEAD = /^#\s+(\d+)\.\s*(.+?)\s*$/;
const TEST_HEAD = /^##\s+(\d+)-test\s*$/i;
const ITEM_HEAD = /^###\s+(\d+)\s*\[([A-D])\]\s*$/;

export function parseSolutionFile(source: string): SolutionFile {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const tests = new Map<number, SolutionItem[]>();
  const errors: string[] = [];

  let topic = 0;
  let title = "";
  let currentTest: number | null = null;
  let current: { number: number; answer: Letter; lines: string[] } | null =
    null;

  const flush = () => {
    if (!current || currentTest === null) return;

    const text = current.lines.join("\n").trim();

    if (!text) {
      errors.push(`${currentTest}-test, ${current.number}-savol: yeçim böş.`);
    } else {
      tests.get(currentTest)!.push({
        number: current.number,
        answer: current.answer,
        text,
      });
    }

    current = null;
  };

  for (const line of lines) {
    const topicHead = line.match(TOPIC_HEAD);

    if (topicHead && topic === 0 && currentTest === null) {
      topic = Number(topicHead[1]);
      title = topicHead[2];
      continue;
    }

    const testHead = line.match(TEST_HEAD);

    if (testHead) {
      flush();
      currentTest = Number(testHead[1]);

      if (tests.has(currentTest)) {
        errors.push(`${currentTest}-test ikki marta yozilgan.`);
      } else {
        tests.set(currentTest, []);
      }

      continue;
    }

    const itemHead = line.match(ITEM_HEAD);

    if (itemHead) {
      flush();

      if (currentTest === null) {
        errors.push(`${itemHead[1]}-savol test sarlavhasidan oldin turibdi.`);
        continue;
      }

      current = {
        number: Number(itemHead[1]),
        answer: itemHead[2] as Letter,
        lines: [],
      };
      continue;
    }

    if (current) current.lines.push(line);
  }

  flush();

  for (const [testNumber, items] of tests) {
    items.sort((a, b) => a.number - b.number);

    items.forEach((item, index) => {
      if (item.number !== index + 1) {
        errors.push(
          `${testNumber}-test: ${index + 1}-öringa ${item.number}-savol tuşdi (raqam tuşib qolgan yoki takrorlangan).`,
        );
      }
    });
  }

  if (topic === 0) errors.push("Fayl boşida `# N. Mavzu nomi` qatori yöq.");

  return { topic, title, tests, errors };
}

/* ------------------------------------------------------------------ */
/* Bazadagi mavzuni topiş                                              */
/* ------------------------------------------------------------------ */

/**
 * Sarlavhani solişiriş uçun soddalaştiradi: eski va yangi alifbo,
 * qavslar, tinish belgilari farq qilmaydi.
 *   "Kasrlar (1-qism)" == "Kasrlar 1-qism" == "kasrlar, 1 qism"
 */
export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ʻʼ‘’'`]/g, "")
    .replace(/ö/g, "o")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "sh")
    .replace(/ç/g, "ch")
    .replace(/[^a-z0-9]+/g, "");
}

/** "2-test" -> 2; raqam bölmasa null */
export function testNumberFromTitle(title: string): number | null {
  const match = title.match(/(\d+)\s*-\s*test/i);

  return match ? Number(match[1]) : null;
}

export type DbQuestion = {
  id: number;
  order_number: number;
  correct_answer: string | null;
  solution_text: string | null;
};

export type MatchedQuestion = {
  questionId: number;
  number: number;
  /** Yozilgan bölsa — saytdagi yeçim bilan bir xilmi */
  status: "new" | "same" | "changed" | "wrong-answer" | "missing";
  text: string | null;
  fileAnswer: Letter | null;
  dbAnswer: string | null;
};

/**
 * Bitta testning savollarini yeçimlar bilan juftlaydi.
 *
 * Juftlaş tartib bö'yiça: bazadagi variantli savollar `order_number`
 * bö'yiça tartiblanadi, k-savolga fayldagi k-yeçim tuşadi. Kalit
 * harfi bazadagi töğri javobga mos kelmasa — "wrong-answer", bunday
 * savolga yeçim yozilmaydi.
 */
export function matchQuestions(
  dbQuestions: DbQuestion[],
  items: SolutionItem[],
): MatchedQuestion[] {
  const sorted = [...dbQuestions].sort(
    (a, b) => a.order_number - b.order_number || a.id - b.id,
  );

  return sorted.map((question, index) => {
    const item = items[index] ?? null;
    const dbAnswer = question.correct_answer?.trim().toUpperCase() ?? null;

    if (!item) {
      return {
        questionId: question.id,
        number: index + 1,
        status: "missing",
        text: null,
        fileAnswer: null,
        dbAnswer,
      };
    }

    const base = {
      questionId: question.id,
      number: index + 1,
      text: item.text,
      fileAnswer: item.answer,
      dbAnswer,
    };

    if (dbAnswer !== item.answer) return { ...base, status: "wrong-answer" };

    const existing = question.solution_text?.trim() ?? "";

    if (!existing) return { ...base, status: "new" };

    return {
      ...base,
      status: existing === item.text ? "same" : "changed",
    };
  });
}
