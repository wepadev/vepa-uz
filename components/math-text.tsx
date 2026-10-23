import katex from "katex";

type MathTextProps = {
  content: string | null | undefined;
  className?: string;
};

const mathPattern =
  /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;

function getFormula(part: string): {
  formula: string;
  displayMode: boolean;
} | null {
  if (part.startsWith("$$") && part.endsWith("$$")) {
    return {
      formula: part.slice(2, -2),
      displayMode: true,
    };
  }

  if (part.startsWith("\\[") && part.endsWith("\\]")) {
    return {
      formula: part.slice(2, -2),
      displayMode: true,
    };
  }

  if (part.startsWith("\\(") && part.endsWith("\\)")) {
    return {
      formula: part.slice(2, -2),
      displayMode: false,
    };
  }

  if (part.startsWith("$") && part.endsWith("$")) {
    return {
      formula: part.slice(1, -1),
      displayMode: false,
    };
  }

  return null;
}

function renderFormula(
  formula: string,
  displayMode: boolean,
): string {
  /*
   * Inline formula qatorda qoladi, lekin display uslubidagi
   * katta kasr, integral, yig‘indi va darajalar bilan chiqadi.
   * Alohida formulaga hech qanday o‘zgarish kiritilmaydi.
   */
  const preparedFormula = displayMode
    ? formula.trim()
    : String.raw`\displaystyle ${formula.trim()}`;

  return katex.renderToString(preparedFormula, {
    displayMode,
    throwOnError: false,
    strict: false,
    trust: false,
    output: "htmlAndMathml",
    errorColor: "#dc2626",
  });
}

export default function MathText({
  content,
  className = "",
}: MathTextProps) {
  if (!content) {
    return null;
  }

  const parts = content
    .split(mathPattern)
    .filter((part) => part.length > 0);

  return (
    <div className={`math-content ${className}`}>
      {parts.map((part, index) => {
        const math = getFormula(part);

        if (!math) {
          return (
            <span
              key={`text-${index}`}
              className="math-content__text"
            >
              {part}
            </span>
          );
        }

        const html = renderFormula(
          math.formula,
          math.displayMode,
        );

        if (math.displayMode) {
          return (
            <div
              key={`formula-${index}`}
              className="math-content__display"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        return (
          <span
            key={`formula-${index}`}
            className="math-content__inline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}