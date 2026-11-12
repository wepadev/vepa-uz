import katex from "katex";

import SampleQuizClient, {
  type SampleQuestion,
} from "@/components/home/sample-quiz-client";

/**
 * Bosh sahifadagi jonli namuna: mehmon röyxatdan ötmasdan uçta
 * savolga javob beradi va darrov izohini köradi.
 *
 * Nega: "onlayn testlar bor" degan gap hech narsa his qildirmaydi.
 * Bitta savolni bosib körgan odam mahsulotni tatib köradi.
 *
 * Formulalar şu yerda — serverda — KaTeX bilan çiziladi va tayyor
 * HTML sifatida uzatiladi: brauzerga KaTeX kutubxonasi yuklanmaydi
 * (zaif internetda bosh sahifa yengil qoladi).
 */
const tex = (formula: string) =>
  katex.renderToString(formula, { throwOnError: false, output: "html" });

/** `$...$` içidagi formulalarni HTML ga aylantiradi */
function render(text: string) {
  return text
    .split(/(\$[^$]+\$)/g)
    .map((part) =>
      part.startsWith("$") && part.endsWith("$")
        ? tex(part.slice(1, -1))
        : part.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    )
    .join("");
}

const QUESTIONS = [
  {
    topic: "Çiziqli tenglama",
    text: "Tenglamani yeçing: $2x + 6 = 18$",
    options: ["$x = 4$", "$x = 6$", "$x = 8$", "$x = 12$"],
    correct: 1,
    hint: "$2x = 18 - 6 = 12$, demak $x = 12 : 2 = 6$.",
  },
  {
    topic: "Ildiz va daraja",
    text: "Ifodaning qiymatini toping: $\\sqrt{144} - 3^2$",
    options: ["$3$", "$5$", "$6$", "$9$"],
    correct: 0,
    hint: "$\\sqrt{144} = 12$ va $3^2 = 9$, demak $12 - 9 = 3$.",
  },
  {
    topic: "Uçburçak burçaklari",
    text: "Uçburçakning ikki burçagi $50^\\circ$ va $60^\\circ$. Uçinçi burçagini toping.",
    options: ["$60^\\circ$", "$70^\\circ$", "$80^\\circ$", "$90^\\circ$"],
    correct: 1,
    hint: "Burçaklar yiğindisi $180^\\circ$: $180^\\circ - 50^\\circ - 60^\\circ = 70^\\circ$.",
  },
];

export default function SampleQuiz({ className }: { className?: string }) {
  const questions: SampleQuestion[] = QUESTIONS.map((question) => ({
    topic: question.topic,
    textHtml: render(question.text),
    optionsHtml: question.options.map(render),
    correct: question.correct,
    hintHtml: render(question.hint),
  }));

  return <SampleQuizClient questions={questions} className={className} />;
}
