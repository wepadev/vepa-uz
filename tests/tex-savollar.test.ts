import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTests,
  cleanTex,
  figureDocument,
  parseTex,
  parseTexAnswers,
} from "../lib/tex-savollar.ts";

test("testboshi ko'rinishi: test va savollar ajraladi", () => {
  const result = parseTex(String.raw`
\testboshi{Mavzu nomi}{1}
\begin{testlar}
  \item $[25;55]$ kesmada nechta tub son bor?
  \begin{variantlar}
    \item $8$
    \item $5$
    \item $7$
    \item $6$
  \end{variantlar}
\end{testlar}
\testboshi{Mavzu nomi}{2}
\begin{testlar}
  \item Ikkinchi testning savoli.
  \begin{variantlar}
    \item $1$
    \item $2$
    \item $3$
    \item $4$
  \end{variantlar}
\end{testlar}
`);

  assert.deepEqual(result.tests.map((item) => item.number), [1, 2]);
  assert.equal(result.tests[0].title, "Mavzu nomi");
  assert.equal(result.tests[0].questions[0].text, "$[25;55]$ kesmada nechta tub son bor?");
  assert.equal(result.tests[0].questions[0].options.c, "$7$");
  assert.deepEqual(result.tests[0].questions[0].flags, []);
});

test("optsauto ko'rinishi: variantdan keyingi chizma savolga tegishli", () => {
  const result = parseTex(String.raw`
\renewcommand{\variant}{1-TEST}
\textbf{1-test.} Chizmada qaysi funksiya?
\optsauto{$y=\sin x$}{$y=\cos x$}{$y=\tan x$}{$y=\cot x$}
\begin{tikzpicture}\draw (0,0) -- (1,1);\end{tikzpicture}
\textbf{2-test.} Oddiy savol.
\optsfour{$1$}{$2$}{$3$}{$4$}
`);

  assert.equal(result.tests.length, 1);
  assert.equal(result.tests[0].questions.length, 2);
  assert.equal(result.tests[0].questions[0].options.a, "$y=\\sin x$");
  assert.equal(result.tests[0].questions[0].figures.length, 1);
  assert.match(result.tests[0].questions[0].figures[0], /^\\begin\{tikzpicture\}/);
  assert.deepEqual(result.tests[0].questions[1].figures, []);
  assert.deepEqual(result.tests[0].questions[1].flags, []);
});

test("variant soni 4 ta bo'lmasa belgilanadi", () => {
  const result = parseTex(String.raw`
\testboshi{Nom}{1}
\begin{testlar}
  \item Savol?
  \begin{variantlar}
    \item $1$
    \item $2$
  \end{variantlar}
\end{testlar}
`);

  assert.ok(result.tests[0].questions[0].flags.some((f) => f.includes("variantlar soni 2")));
});

test("bezaklar tozalanadi, matematika qoladi", () => {
  assert.equal(cleanTex(String.raw`\textbf{Diqqat} $x^2$\vspace{3pt}`), "Diqqat $x^2$");
  assert.equal(cleanTex(String.raw`\( \dfrac{1}{2} \) ni toping`), "$ \\dfrac{1}{2} $ ni toping");
  /* Nuqtali vergul amal belgisi emas — yo'qolmasin */
  assert.equal(cleanTex("$[25;55]$"), "$[25;55]$");
});

test("tanish buyruq topilmasa aniq xato beradi", () => {
  const result = parseTex("\\section{Oddiy matn}");
  assert.equal(result.tests.length, 0);
  assert.match(result.errors[0], /testboshi/);
});

test("javoblar kaliti o'qiladi", () => {
  const key = parseTexAnswers(`Mavzu nomi — javoblar

1-TEST: 1-C, 2-A, 3-B
2-TEST: 1-B, 2-D, 3-C
`);

  assert.equal(key.tests.size, 2);
  assert.equal(key.tests.get(1)?.get(1), "C");
  assert.equal(key.tests.get(2)?.get(3), "C");
  assert.deepEqual(key.errors, []);
});

test("savol va javob birlashtiriladi, javobsizi tashlanadi", () => {
  const questions = parseTex(String.raw`
\testboshi{Nom}{1}
\begin{testlar}
  \item Birinchi?
  \begin{variantlar}
    \item $1$
    \item $2$
    \item $3$
    \item $4$
  \end{variantlar}
  \item Ikkinchi?
  \begin{variantlar}
    \item $5$
    \item $6$
    \item $7$
    \item $8$
  \end{variantlar}
\end{testlar}
`);

  /* Kalitda faqat birinchi savol bor */
  const ready = buildTests(questions, parseTexAnswers("1-TEST: 1-C"));

  assert.equal(ready.total, 2);
  assert.equal(ready.ready, 1);
  assert.equal(ready.tests[0].questions[0].correct, "C");
  assert.ok(ready.tests[0].notes.some((n) => n.includes("javobi yöq")));
});

test("kalit topilmasa aniq xato beradi", () => {
  const ready = buildTests(
    parseTex(String.raw`\testboshi{Nom}{1}
\begin{testlar}
  \item Savol?
  \begin{variantlar}\item $1$\item $2$\item $3$\item $4$\end{variantlar}
\end{testlar}`),
    parseTexAnswers("hech narsa"),
  );

  assert.equal(ready.tests.length, 0);
  assert.ok(ready.errors.some((e) => e.includes("javoblar kaliti topilmadi")));
});

/* ------------------------------------------------------------------ */
/* Chizmalar                                                           */
/* ------------------------------------------------------------------ */

const SONOQI = String.raw`
\newcommand{\sonoqi}[1]{%
  \begin{center}
    \begin{tikzpicture}
      \draw[->] (-6.5,0) -- (6.8,0);
      \node[kitobKok] at (#1,0) {A};
    \end{tikzpicture}
  \end{center}
}
\newcommand{\chizma}[1]{\par\noindent\makebox[\linewidth]{#1}\par}
\newcommand{\nuqta}[2]{\fill (#1,#2) circle (2pt);}
`;

test("fayldagi chizma buyrug'i matnda xom qolmaydi", () => {
  const result = parseTex(SONOQI + String.raw`
\testboshi{Ratsional sonlar}{1}
\begin{testlar}
  \item Çizmada $A$ nuqta berilgan. $C$ nuqta qaysi songa mos keladi?

  \sonoqi{2}

  \begin{variantlar}
    \item $4$
    \item $-5$
    \item $6$
    \item $5$
  \end{variantlar}
\end{testlar}`);

  const question = result.tests[0].questions[0];

  assert.equal(
    question.text,
    "Çizmada $A$ nuqta berilgan. $C$ nuqta qaysi songa mos keladi?",
  );
  assert.deepEqual(question.figures, ["\\sonoqi{2}"]);
  assert.ok(result.figures?.macros.sonoqi.figure);
  assert.equal(result.figures?.macros.chizma.figure, false);
});

test("qobiq ichidagi bir nechta chizma bitta rasm bo'ladi", () => {
  const result = parseTex(SONOQI + String.raw`
\testboshi{Nom}{1}
\begin{testlar}
  \item Grafiklarni moslang.
  \chizma{\begin{tikzpicture}\nuqta{1}{1}\end{tikzpicture}\hspace{2mm}\begin{tikzpicture}\nuqta{2}{2}\end{tikzpicture}}
  \begin{variantlar}\item $1$\item $2$\item $3$\item $4$\end{variantlar}
\end{testlar}`);

  const question = result.tests[0].questions[0];

  assert.equal(question.text, "Grafiklarni moslang.");
  assert.equal(question.figures.length, 1);
  assert.match(question.figures[0], /\\hspace\{2mm\}/);
  assert.doesNotMatch(question.figures[0], /\\chizma/);
});

test("chizma hujjati: kerakli buyruq va ranglar qo'shiladi, keraksizi yo'q", () => {
  const result = parseTex(SONOQI + String.raw`
\newcommand{\trow}[2]{\begin{tcolorbox}#1 #2\end{tcolorbox}}
\testboshi{Nom}{1}
\begin{testlar}
  \item Savol. \sonoqi{-2}
  \begin{variantlar}\item $1$\item $2$\item $3$\item $4$\end{variantlar}
\end{testlar}`);

  const ready = buildTests(result, parseTexAnswers("1-TEST: 1-B"));
  const document = ready.tests[0].questions[0].figure ?? "";

  assert.match(document, /\\definecolor\{kitobKok\}/);
  assert.match(document, /\\newcommand\{\\sonoqi\}\[1\]/);
  assert.doesNotMatch(document, /\\trow/);
  assert.match(document, /\\begin\{document\}\n\\sonoqi\{-2\}\n\\end\{document\}/);
});

test("variantlar jadvalda chizilgan bo'lsa butun jadval rasm bo'ladi", () => {
  const result = parseTex(SONOQI + String.raw`
\testboshi{Nom}{1}
\begin{testlar}
  \item Qaysi grafik?
  \chizma{\begin{tabular}{ll}A)~\begin{tikzpicture}\nuqta{0}{0}\end{tikzpicture} & B)~\begin{tikzpicture}\nuqta{1}{0}\end{tikzpicture}\end{tabular}}
  \begin{variantlar}\item A\item B\item C\item D\end{variantlar}
\end{testlar}`);

  const question = result.tests[0].questions[0];

  assert.equal(question.text, "Qaysi grafik?");
  assert.equal(question.figures.length, 1);
  assert.match(question.figures[0], /^\\begin\{tabular\}/);
});

test("uzun qatorli chizma bo'linadi, bir nechta chizma ustma-ust", () => {
  const points = Array.from({ length: 300 }, (_, i) => `(${i},${i})`).join(" ");
  const document = figureDocument(
    [
      String.raw`\begin{tikzpicture}\draw plot coordinates {${points}};\end{tikzpicture}`,
      String.raw`\begin{tikzpicture}\draw (0,0) -- (1,1);\end{tikzpicture}`,
    ],
    undefined,
  );

  for (const line of document.split("\n")) {
    assert.ok(line.length <= 400, `qator juda uzun: ${line.length}`);
  }

  assert.match(document, /\\begin\{tabular\}\{@\{\}c@\{\}\}/);
});

test("bo'g'in ishorasi va qator buyruqlari matndan olinadi", () => {
  assert.equal(
    cleanTex(String.raw`Şaklning peri\-met\-rini toping.\newline\nobreak Javob`),
    "Şaklning perimetrini toping. Javob",
  );
});
