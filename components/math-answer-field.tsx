"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Matematik javob maydoni — mock testdagi a) b) savollar uçun.
 *
 * MathLive (https://mathlive.io) maydoni va öz klaviaturamiz:
 * kasr, ildiz, daraja, π, logarifm, trigonometriya... Öquvçi kasrni
 * kitobdagidek körib yozadi, telefonning harf klaviaturasi çiqmaydi.
 *
 * MathLive katta kutubxona, şuning uçun u faqat şu maydon ekranga
 * çiqqanda yuklanadi. Shriftlari `public/mathlive/fonts` da
 * (scripts/copy-pdf-worker.mjs nusxalaydi).
 *
 * Javob `$...$` içida saqlanadi: natijalar sahifasi uni formula
 * sifatida çizadi, tekşiruv esa ma'nosi böyiça solişti radi
 * (lib/javob-tengligi.ts).
 */

type MathfieldLike = HTMLElement & {
  value: string;
  mathVirtualKeyboardPolicy: string;
  smartFence: boolean;
  smartSuperscript: boolean;
  popoverPolicy: string;
  menuItems: unknown[];
  inlineShortcuts: Record<string, string>;
  executeCommand: (command: string | string[]) => boolean;
};

type MathliveModule = typeof import("mathlive");

let mathlivePromise: Promise<MathliveModule> | null = null;

/** Kutubxona va klaviatura bir marta sozlanadi */
function loadMathlive(): Promise<MathliveModule> {
  if (!mathlivePromise) {
    mathlivePromise = import("mathlive").then((module) => {
      const { MathfieldElement } = module;

      MathfieldElement.fontsDirectory = "/mathlive/fonts";
      MathfieldElement.soundsDirectory = null;
      MathfieldElement.decimalSeparator = ",";

      const keyboard = (window as unknown as {
        mathVirtualKeyboard?: {
          layouts: unknown;
          editToolbar: string;
        };
      }).mathVirtualKeyboard;

      if (keyboard) {
        keyboard.editToolbar = "none";
        keyboard.layouts = [
          {
            label: "123",
            displayShiftedKeycaps: false,
            displayEditToolbar: false,
            rows: [
              [
                "[7]",
                "[8]",
                "[9]",
                { latex: "\\frac{#@}{#?}", class: "small" },
                { latex: "\\sqrt{#0}", class: "small" },
                { latex: "\\sqrt[#?]{#0}", class: "small" },
                { latex: "\\pi" },
                "[(]",
                "[)]",
              ],
              [
                "[4]",
                "[5]",
                "[6]",
                { latex: "\\times", insert: "\\times" },
                { latex: "#@^{#?}", class: "small" },
                { label: "°", insert: "^{\\circ}" },
                { label: "[", insert: "\\lbrack" },
                { label: "]", insert: "\\rbrack" },
                { label: ";", insert: ";" },
              ],
              [
                "[1]",
                "[2]",
                "[3]",
                "[-]",
                "[+]",
                { label: "%", insert: "\\%" },
                { latex: "\\log_{#?}{#0}", label: "log<sub>a</sub>", insert: "\\log_{#?}{#0}" },
                { latex: "\\ln", insert: "\\ln(#0)" },
                { latex: "\\infty" },
              ],
              [
                "[0]",
                { label: ",", insert: "{,}" },
                { label: "sin", insert: "\\sin(#0)" },
                { label: "cos", insert: "\\cos(#0)" },
                { label: "tg", insert: "\\operatorname{tg}(#0)" },
                "[left]",
                "[right]",
                "[backspace]",
                {
                  label: "✓",
                  class: "action",
                  command: ["hideVirtualKeyboard"],
                },
              ],
            ],
          },
        ];
      }

      return module;
    });
  }

  return mathlivePromise;
}

/** Saqlangan `$...$` javobdan LaTeX */
function toLatex(stored: string): string {
  return stored.replace(/^\$+|\$+$/g, "").trim();
}

type MathAnswerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  onFocusChange?: (focused: boolean) => void;
};

export default function MathAnswerField({
  value,
  onChange,
  label,
  onFocusChange,
}: MathAnswerFieldProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldLike | null>(null);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocusChange);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  onChangeRef.current = onChange;
  onFocusRef.current = onFocusChange;

  useEffect(() => {
    let cancelled = false;
    let field: MathfieldLike | null = null;

    loadMathlive()
      .then(({ MathfieldElement }) => {
        if (cancelled || !holderRef.current) return;

        field = new MathfieldElement() as unknown as MathfieldLike;
        field.mathVirtualKeyboardPolicy = "manual";
        field.smartFence = true;
        field.popoverPolicy = "off";
        field.menuItems = [];
        field.setAttribute("aria-label", label);
        field.className = "math-answer-field__input";
        field.value = toLatex(value);

        field.addEventListener("input", () => {
          const latex = (field?.value ?? "").trim();
          onChangeRef.current(latex ? `$${latex}$` : "");
        });

        field.addEventListener("focusin", () => {
          field?.executeCommand("showVirtualKeyboard");
          onFocusRef.current?.(true);
        });

        field.addEventListener("focusout", () => {
          field?.executeCommand("hideVirtualKeyboard");
          onFocusRef.current?.(false);
        });

        holderRef.current.appendChild(field);
        fieldRef.current = field;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      field?.remove();
      fieldRef.current = null;
    };
    // Maydon bir marta yaratiladi; qiymat pastdagi effektda yangilanadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Taşqaridan kelgan qiymat (qoralama tiklanişi) */
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const latex = toLatex(value);
    if (field.value !== latex) field.value = latex;
  }, [value, ready]);

  if (failed) {
    /* Kutubxona yuklanmasa — oddiy maydon, test töxtab qolmaydi */
    return (
      <input
        type="text"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-base outline-none focus:border-mb-brand focus:ring-2 focus:ring-blue-100 sm:text-lg"
      />
    );
  }

  return (
    <div className="math-answer-field mt-2">
      <div
        ref={holderRef}
        className="min-h-14 rounded-xl border border-slate-300 bg-white px-3 py-2 transition focus-within:border-mb-brand focus-within:ring-2 focus-within:ring-blue-100"
      >
        {!ready && (
          <span className="block py-2 text-sm text-slate-400">
            Klaviatura yuklanmoqda...
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => fieldRef.current?.focus()}
        disabled={!ready}
        className="mt-2 text-sm font-semibold text-mb-brand disabled:opacity-50"
      >
        Klaviaturani oçiş
      </button>
    </div>
  );
}
