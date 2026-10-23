/**
 * Qoida bilan ajratib bo'lmagan savollarni Claude bilan tiklash.
 *
 * NIMA UCHUN SHU YO'L TANLANGAN — token hisobi:
 *
 * | Yo'l | Bitta testga ketadigan token |
 * | --- | --- |
 * | Butun PDF'ni rasm sifatida yuborish | ~10 000+ |
 * | Butun PDF matnini yuborish | ~3 000 |
 * | FAQAT ajratilmagan savol qatorlarini yuborish | ~300 |
 *
 * Qoida bilan ajratish 60 savoldan 54 tasini to'g'ri oladi, demak
 * modelga faqat 6 tasi boradi. Shuning uchun bu yerda PDF ham,
 * rasm ham yuborilmaydi — faqat o'sha savolning bir necha xom
 * qatori. Javob kaliti ham yuborilmaydi: u allaqachon ma'lum,
 * modeldan faqat matn va variantlar so'raladi.
 */
import type { PendingQuestion } from "@/lib/pdf-offline-import";

export type AiFix = {
  number: number;
  test: number;
  text: string;
  options: { a: string; b: string; c: string; d: string };
};

export type AiResult = {
  fixed: AiFix[];
  notes: string[];
  /** Sarflangan token — foydalanuvchiga ko'rsatiladi */
  usage: { input: number; output: number };
};

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

/*
 * MODEL NOMINI KODGA YOZIB QO'YMAYMIZ.
 *
 * Model nomlari eskiradi va eskisiga murojaat qilsa 400 qaytadi.
 * Shuning uchun kalit ko'radigan modellar ro'yxati olinadi
 * (bu so'rov bepul) va afzal ko'rilganlardan birinchi mosi
 * tanlanadi. Ro'yxat bir marta olinib, eslab qolinadi.
 *
 * Tartib: arzoni oldinda. Bu yerdagi ish og'ir emas — bir necha
 * qator matnni tartibga solish, shuning uchun eng kichik model
 * ham yetadi.
 */
const PREFERRED = ["haiku", "sonnet", "opus"];

let chosenModel: string | null = null;

async function pickModel(key: string): Promise<string> {
  const forced = process.env.ANTHROPIC_MODEL?.trim();
  if (forced) return forced;

  if (chosenModel) return chosenModel;

  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=50", {
      headers: { "x-api-key": key, "anthropic-version": VERSION },
      signal: AbortSignal.timeout(8000),
    });

    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = (data.data ?? []).map((row) => row.id ?? "").filter(Boolean);

    for (const want of PREFERRED) {
      /* Eng yangisi ro'yxatning boshida keladi */
      const found = ids.find((id) => id.includes(want));
      if (found) return (chosenModel = found);
    }

    if (ids.length > 0) return (chosenModel = ids[0]);
  } catch {
    /* Ro'yxat olinmasa pastdagi nom bilan sinab ko'ramiz */
  }

  return "claude-haiku-4-5";
}

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 45000;

/** Bo'sh satr ham, tirnoq ham kalit emas */
function readKey(): string | null {
  const raw = process.env.ANTHROPIC_API_KEY;
  const value = raw?.trim().replace(/^["']|["']$/g, "");
  return value ? value : null;
}

/*
 * Ko'rsatma ataylab ingliz tilida va qisqa — har bir so'z token.
 * Uzbek matni tegilmasligi alohida ta'kidlangan.
 */
const SYSTEM = [
  "You repair multiple-choice maths questions extracted from a PDF text layer.",
  "The layer is mangled: exponents, fractions and roots may be split or misplaced.",
  "Rules:",
  "- Keep the Uzbek wording exactly as given. Fix only the mathematics.",
  "- Never solve, never change any number, never invent content.",
  "- Write maths in KaTeX between $...$ using \\frac, \\sqrt, \\overline, \\left( \\right), ^{} and _{}.",
  "- Each question has exactly four options A-D.",
  "- If a line is unreadable, copy it as plain text rather than guessing.",
  'Reply with JSON only: [{"n":1,"text":"...","a":"...","b":"...","c":"...","d":"..."}]',
].join("\n");

/** Javobdagi JSON'ni ajratib olish */
function parseReply(raw: string): Array<Record<string, unknown>> {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");

  if (start === -1 || end <= start) return [];

  try {
    const value = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Kalit ishlayaptimi — bir soniyalik tekshiruv.
 *
 * Nega kerak: PDF yuklab, kutib, so'ng "kalit noto'g'ri" degan
 * xabarni ko'rish vaqt isrofi. Bu yo'l modellar ro'yxatini
 * so'raydi (bepul so'rov) va darhol javob beradi.
 *
 * Kalitning o'zi hech qachon javobga qo'shilmaydi.
 */
export async function checkClaudeKey(): Promise<{
  ok: boolean;
  message: string;
  model?: string;
}> {
  const key = readKey();

  if (!key) {
    return {
      ok: false,
      message:
        "ANTHROPIC_API_KEY topilmadi. U faqat PDF'dagi qiyin " +
        "savollarni tiklash uchun kerak; `.tex` dan o'qishda ishlatilmaydi.",
    };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": key, "anthropic-version": VERSION },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401) {
      return { ok: false, message: "ANTHROPIC_API_KEY noto'g'ri yoki eskirgan." };
    }

    if (!res.ok) {
      return { ok: false, message: `Model xizmati javob bermadi (HTTP ${res.status}).` };
    }

    const model = await pickModel(key);

    return { ok: true, message: "Kalit ishlayapti.", model };
  } catch (error) {
    return {
      ok: false,
      message: `Ulanilmadi: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function fixWithClaude(
  pending: PendingQuestion[],
): Promise<AiResult> {
  const empty: AiResult = {
    fixed: [],
    notes: [],
    usage: { input: 0, output: 0 },
  };

  if (pending.length === 0) return empty;

  const key = readKey();

  if (!key) {
    return {
      ...empty,
      notes: [
        "ANTHROPIC_API_KEY topilmadi — ajratilmagan savollar qo'lda kiritiladi.",
      ],
    };
  }

  /*
   * Bitta so'rovda hammasi. Har savol uchun alohida so'rov
   * yuborish ko'rsatmani har safar qayta yuborish degani.
   */
  const items = pending.map((item, index) => ({
    n: index + 1,
    lines: item.source,
  }));

  const model = await pickModel(key);

  const body = {
    model,
    /* Har savolga ~200 token yetadi, ortiqchasi pul */
    max_tokens: Math.min(4000, 200 + pending.length * 200),
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(items) }],
  };

  let reply: Response;

  try {
    reply = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": VERSION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ...empty,
      notes: [
        `Modelga ulanilmadi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }

  const payload = (await reply.json().catch(() => null)) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  } | null;

  if (!reply.ok || !payload) {
    const message = payload?.error?.message ?? `HTTP ${reply.status}`;

    return {
      ...empty,
      notes: [
        reply.status === 401
          ? "ANTHROPIC_API_KEY noto'g'ri."
          : reply.status === 400 && /model/i.test(message)
            ? `Model nomi yaramadi (${model}). .env.local ga ANTHROPIC_MODEL=... yozing.`
            : `Model xatosi: ${message}`,
      ],
    };
  }

  const usage = {
    input: payload.usage?.input_tokens ?? 0,
    output: payload.usage?.output_tokens ?? 0,
  };

  const answer = (payload.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");

  const rows = parseReply(answer);
  const fixed: AiFix[] = [];
  const notes: string[] = [];

  for (const row of rows) {
    const index = Number(row.n) - 1;
    const item = pending[index];

    if (!item) continue;

    const options = {
      a: text(row.a),
      b: text(row.b),
      c: text(row.c),
      d: text(row.d),
    };

    const filled = Object.values(options).filter(Boolean).length;

    if (!text(row.text) || filled !== 4) {
      notes.push(`${item.number}-savol: model to'liq javob bermadi.`);
      continue;
    }

    fixed.push({
      number: item.number,
      test: item.test,
      text: text(row.text),
      options,
    });
  }

  const missed = pending.length - fixed.length;

  if (missed > 0) {
    notes.push(`${missed} ta savolni model ham tiklay olmadi.`);
  }

  return { fixed, notes, usage };
}
