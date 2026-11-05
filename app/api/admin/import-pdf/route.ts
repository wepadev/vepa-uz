import { NextResponse, type NextRequest } from "next/server";

import { fixWithClaude } from "@/lib/pdf-ai-tuzatish";
import {
  answerKeyFromPdf,
  mergeFixes,
  parsePdfOffline,
} from "@/lib/pdf-offline-import";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { buildTests, parseTex, parseTexAnswers } from "@/lib/tex-savollar";

/*
 * Testni fayldan ajratish.
 *
 * IKKI XIL MANBA QABUL QILINADI:
 *
 * 1. `.tex` — LaTeX manba. Eng yaxshisi: matematika allaqachon
 *    LaTeX ko'rinishida yozilgan, uni tiklash kerak emas,
 *    ko'chirib olinadi. 861 savolda sinalgan: 861 tasi tayyor,
 *    0 xato, model umuman chaqirilmaydi.
 *
 * 2. `.pdf` — chizma qatlamidan tiklanadi. Yaxshi ishlaydi,
 *    lekin ba'zi savol (aralash son, chuqur ichma-ich ifoda)
 *    tiklanmaydi — o'shanda Claude chaqiriladi.
 *
 * Javoblar fayli ikkala ko'rinishda ham bo'lishi mumkin: savol
 * `.tex`, javob `.pdf` bo'lsa ham ishlaydi.
 *
 * PDF yo'li — IKKI BOSQICH.
 *
 * 1. Qoidalar bilan ajratish (tekin, bir soniya). Koordinata va
 *    chizma qatlami o'qiladi, matematika KaTeX qilib tiklanadi.
 *    Haqiqiy fayllarda 177 savoldan 171 tasi shu bosqichda
 *    to'liq chiqadi.
 * 2. Qolganini Claude tiklaydi — BUTUN PDF EMAS, faqat o'sha
 *    savolning bir necha xom qatori yuboriladi.
 *
 * Token hisobi shundan: butun PDF ~10 000 token, butun matn
 * ~3 000, faqat ajratilmagan savollar ~300. Hech narsa
 * ajratilmasa model ham chaqirilmaydi.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/*
 * Vercel serverless funksiyasiga kelayotgan so'rov tanasi 4.5 MB
 * bilan chegaralangan — undan kattasi funksiyagacha yetib
 * bormaydi va platformaning HTML xato sahifasi qaytadi.
 */
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(request: NextRequest) {
  // 1. Faqat admin
  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { errors: ["Tizimga kirmagansiz."] },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.is_active !== true) {
    return NextResponse.json(
      { errors: ["Bu amal faqat administrator uçun."] },
      { status: 403 },
    );
  }

  // 2. Ikkala fayl
  let file: File | null = null;
  let answersFile: File | null = null;

  try {
    const form = await request.formData();

    const value = form.get("file");
    file = value instanceof File ? value : null;

    const answers = form.get("answers");
    answersFile = answers instanceof File && answers.size > 0 ? answers : null;
  } catch {
    return NextResponse.json({ errors: ["Fayl öqilmadi."] }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json(
      { errors: ["PDF fayl tanlanmadi."] },
      { status: 400 },
    );
  }

  if (file.type !== "application/pdf" && !/\.tex$/i.test(file.name)) {
    return NextResponse.json(
      { errors: ["Faqat `.tex` yoki `.pdf` fayl qabul qilinadi."] },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        errors: [
          `Fayl juda katta (${(file.size / 1024 / 1024).toFixed(1)} MB). Çegara — 4 MB.`,
        ],
      },
      { status: 400 },
    );
  }

  if (!answersFile) {
    return NextResponse.json(
      {
        errors: [
          "Javoblar fayli berilmadi. Savol faylining içida töğri " +
            "javob yöq, şuning uçun ikkala fayl ham kerak.",
        ],
      },
      { status: 400 },
    );
  }

  /*
   * Fayl turini NOMI bo'yicha aniqlaymiz. Brauzer `.tex` uchun
   * turg'un MIME turi bermaydi: ba'zida `text/x-tex`, ba'zida
   * `application/octet-stream`, ba'zida umuman bo'sh.
   */
  const isTex = (item: File) => /\.tex$/i.test(item.name);

  try {
    // 3a. `.tex` yo'li — model kerak emas
    if (isTex(file)) {
      const questions = parseTex(await file.text());

      const key = isTex(answersFile)
        ? parseTexAnswers(await answersFile.text())
        : await answerKeyFromPdf(Buffer.from(await answersFile.arrayBuffer()));

      const ready = buildTests(questions, key);

      if (ready.tests.length === 0) {
        return NextResponse.json(
          {
            errors:
              ready.errors.length > 0
                ? ready.errors
                : ["`.tex` fayldan savol ajratilmadi."],
          },
          { status: 422 },
        );
      }

      const errors = [...ready.errors];

      if (ready.ready < ready.total) {
        errors.unshift(
          `${ready.total} ta savoldan ${ready.ready} tasi tayyor. ` +
            `Qolgani javobsiz yoki variantlari töliq emas.`,
        );
      }

      return NextResponse.json({
        tests: ready.tests.map((test) => ({
          title: `${test.number}-test`,
          description: null,
          notes: test.notes,
          questions: test.questions.map((question) => ({
            type: "choice" as const,
            text: question.text,
            options: question.options,
            correct: question.correct,
            solution: null,
            solutionVideo: null,
            /* Rasmni brauzer alohida so'raydi — bitta so'rov vaqtga sig'masligi mumkin */
            figure: question.figure,
          })),
        })),
        errors,
        source: "tex",
        repaired: 0,
        usage: { input: 0, output: 0 },
      });
    }

    // 3b. PDF yo'li — qoidalar bilan
    const buffer = Buffer.from(await file.arrayBuffer());
    const answersBuffer = Buffer.from(await answersFile.arrayBuffer());

    const offline = await parsePdfOffline(buffer, answersBuffer);

    if (offline.tests.length === 0) {
      return NextResponse.json(
        {
          errors:
            offline.errors.length > 0
              ? offline.errors
              : ["PDF'dan savol ajratilmadi."],
        },
        { status: 422 },
      );
    }

    const errors = [...offline.errors];
    const parsed = offline.tests.reduce(
      (sum, test) => sum + test.questions.length,
      0,
    );

    // 4. Qolganini Claude tiklaydi
    let repaired = 0;
    let usage = { input: 0, output: 0 };

    if (offline.pending.length > 0) {
      const result = await fixWithClaude(offline.pending);

      usage = result.usage;
      errors.push(...result.notes);

      /*
       * To'g'ri javob modeldan so'ralmaydi — u javoblar
       * faylidan allaqachon ma'lum. Shu bilan ham token
       * tejaladi, ham model javobni o'zgartira olmaydi.
       */
      const answers = new Map(
        offline.pending.map((item) => [
          `${item.test}:${item.number}`,
          item.correct,
        ]),
      );

      repaired = mergeFixes(
        offline,
        result.fixed,
        (test, number) => answers.get(`${test}:${number}`) ?? null,
      );
    }

    // 5. Hisobot
    const saved = parsed + repaired;

    if (saved < offline.total) {
      errors.unshift(
        `${offline.total} ta savoldan ${saved} tasi tayyor` +
          (repaired > 0 ? ` (${repaired} tasini model tikladi)` : "") +
          `. Qolgan ${offline.total - saved} tasi qölda kiritiladi.`,
      );
    } else if (repaired > 0) {
      errors.unshift(
        `${offline.total} ta savol tayyor, ${repaired} tasini model tikladi.`,
      );
    }

    if (usage.input > 0 || usage.output > 0) {
      errors.push(
        `Model sarfi: ${usage.input} kiriş + ${usage.output} çiqiş token.`,
      );
    }

    return NextResponse.json({
      tests: offline.tests,
      errors,
      repaired,
      usage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        errors: [
          `Ajratişda xato: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      },
      { status: 500 },
    );
  }
}
