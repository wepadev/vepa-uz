import MathText from "@/components/math-text";

/**
 * Yeçim matni va içidagi çizmalar.
 *
 * Mock test yeçimlarida çizma matn içida `[[img:<havola>]]` bölib
 * turadi (bazada `[[rasm:<bucket yöli>]]`, natijalar sahifasi uni
 * vaqtinçalik havolaga almaştiradi). Qolgan matn — odatdagidek
 * formula bilan.
 */
const IMAGE_TOKEN = /\[\[img:([^\]\s]+)\]\]/g;

export default function SolutionText({ value }: { value: string | null | undefined }) {
  if (!value) return null;

  if (!value.includes("[[img:")) return <MathText content={value} />;

  const pieces = value.split(IMAGE_TOKEN);

  return (
    <div className="space-y-2">
      {pieces.map((piece, index) => {
        if (index % 2 === 1) {
          return (
            <img
              key={`img-${index}`}
              src={piece}
              alt="Yeçim çizmasi"
              loading="lazy"
              className="mx-auto block h-auto max-h-80 max-w-full rounded-lg bg-white p-2"
            />
          );
        }

        const text = piece.trim();
        return text ? <MathText key={`text-${index}`} content={text} /> : null;
      })}
    </div>
  );
}
