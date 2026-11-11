import katex from "katex";

import { cn } from "@/lib/utils";

/**
 * Bosh sahifadagi "daftar varağı": bitta masala va uning yeçimi,
 * ustozning qizil ruçkasi bilan "5" baho.
 *
 * Bu bezak emas, mahsulotning özi: platformada aynan şunday
 * qadam-baqadam yeçimlar bor. Formulalar KaTeX bilan serverda
 * çiziladi — brauzerga JavaScript ketmaydi.
 */
const tex = (formula: string) =>
  katex.renderToString(formula, { throwOnError: false, output: "html" });

const steps = [
  { label: "Masala", formula: "x^2 - 5x + 6 = 0" },
  { label: "Diskriminant", formula: "D = 25 - 24 = 1" },
  { label: "Ildizlar", formula: "x_{1,2} = \\dfrac{5 \\pm 1}{2}" },
];

export default function WorkedExample({ className }: { className?: string }) {
  return (
    <figure
      aria-label="Namuna: kvadrat tenglama yeçimi"
      className={cn(
        "paper-grid paper-margin relative overflow-hidden rounded-2xl border border-slate-300/70 shadow-lg",
        className,
      )}
    >
      <div className="relative py-5 pl-10 pr-5 sm:py-7 sm:pl-14 sm:pr-7">
        <p className="eyebrow">Yeçim namunasi</p>

        <ol className="mt-3 grid gap-3 text-mb-ink">
          {steps.map((step, index) => (
            <li key={step.label} className="grid gap-0.5">
              <span className="text-xs font-semibold text-mb-muted">
                {index + 1}. {step.label}
              </span>
              <span
                className="text-[17px] sm:text-[19px]"
                dangerouslySetInnerHTML={{ __html: tex(step.formula) }}
              />
            </li>
          ))}

          <li className="grid gap-0.5">
            <span className="text-xs font-semibold text-mb-muted">4. Javob</span>
            <span className="inline-flex items-center gap-2 text-[17px] sm:text-[19px]">
              <span
                className="rounded-md border-2 border-mb-brand/70 px-2 py-0.5"
                dangerouslySetInnerHTML={{ __html: tex("x_1 = 2,\\; x_2 = 3") }}
              />
            </span>
          </li>
        </ol>
      </div>

      {/* Ustozning bahosi */}
      <figcaption
        aria-label="Baho: 5"
        className="pointer-events-none absolute right-4 top-3 rotate-[-10deg] text-pen sm:right-6 sm:top-4"
      >
        <svg viewBox="0 0 64 64" className="h-14 w-14 sm:h-16 sm:w-16" aria-hidden="true">
          {/* Qöl bilan yozilgan "5" va uning atrofidagi doira */}
          <path
            d="M40 15 L25 15 L22 31 C 28 27, 41 28, 41 39 C 41 50, 28 53, 21 47"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M47 10 C 60 19, 61 45, 45 55 C 29 63, 8 56, 6 37 C 5 21, 17 9, 34 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      </figcaption>
    </figure>
  );
}
