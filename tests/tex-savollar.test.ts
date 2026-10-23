import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTests,
  cleanTex,
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

test("optsauto ko'rinishi va chizma belgisi", () => {
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
  assert.ok(result.tests[0].questions[0].flags.some((f) => f.includes("chizma")));
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
  assert.ok(ready.tests[0].notes.some((n) => n.includes("javobi yo'q")));
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
