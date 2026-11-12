/*
 * KaTeX yangi alifbo harflarini (ö, ğ, ş, ç) özi çizmaydi: ularni
 * "harf + ustidagi belgi" qilib ikki qatlamga böladi — `o` va `¨`,
 * `g` va `˘`, `s` va `¸`. Natijada sedil (ş, ç dagi ilgak) harf
 * tepasiga çiqib qoladi, matematik rejimda esa `\c` degan yozuv
 * körinadi.
 *
 * Bu funksiya KaTeX bergan HTML dagi şunday ikki qatlamli bölaklarni
 * topib, ularni bitta tayyor harfga qaytaradi: `<span class="mord
 * vp-harf">ş</span>`. Harf CMU Serif bilan çiziladi (globals.css,
 * `.katex .vp-harf`) — u ham Computer Modern, formula bilan bir xil.
 *
 * Faqat oddiy holat almaştiriladi: tagida bitta harf, ustida bitta
 * belgi. `\hat{x+y}` kabi murakkab bölaklarga tegilmaydi.
 */

/** KaTeX ustki belgisi → Unicode birikuvçi belgi */
const ACCENT_TO_COMBINING: Record<string, string> = {
  "¨": "\u0308", // ö
  "˘": "\u0306", // ğ
  "¸": "\u0327", // ş ç (matn rejimi)
  "\\c": "\u0327", // ş ç (matematik rejim)
};

/*
 * Faqat yangi alifbo harflari. `\ddot{x}`, `\breve{a}` kabi
 * matematik belgilar KaTeX'ning özida qoladi.
 */
const LETTERS = new Set(["ö", "Ö", "ğ", "Ğ", "ş", "Ş", "ç", "Ç"]);

const OPEN = '<span class="mord katex-accent';

/*
 * Ikki qatlamli bölakning boşi. Uslublar (balandlik, siljiş) har xil
 * bölişi mumkin, şuning uçun `style` qiymatlari erkin qoldirilgan.
 */
const ACCENT_HEAD =
  /^<span class="mord katex-accent( mtight)?"><span class="vlist-t(?: vlist-t2)?"><span class="vlist-r"><span class="vlist" style="[^"]*"><span style="[^"]*"><span class="pstrut" style="[^"]*"><\/span><span class="mord( mathnormal)?(?: mtight)?"(?: style="[^"]*")?>([A-Za-z])<\/span><\/span><span style="[^"]*"><span class="pstrut" style="[^"]*"><\/span><span class="accent-body" style="[^"]*"><span class="mord(?: mtight)?">([^<]{1,2})<\/span><\/span><\/span><\/span>/;

/** `start` dagi `<span` ning yopiluvçi `</span>` i qayerda tugaydi */
function spanEnd(html: string, start: number): number {
  let depth = 0;
  let i = start;

  while (i < html.length) {
    const nextOpen = html.indexOf("<span", i);
    const nextClose = html.indexOf("</span>", i);

    if (nextClose === -1) {
      return -1;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 5;
      continue;
    }

    depth -= 1;
    i = nextClose + 7;

    if (depth === 0) {
      return i;
    }
  }

  return -1;
}

/*
 * Ekran öqiydigan dasturlar uçun MathML qismi ham: `<mover>` içidagi
 * `s` + `\c` örniga bitta `ş`.
 */
const MATHML_ACCENT =
  /<mover accent="true"><(mi|mtext)>([A-Za-z])<\/\1><mo>([^<]{1,2})<\/mo><\/mover>/g;

function fixMathml(html: string): string {
  return html.replace(MATHML_ACCENT, (whole, tag, base, accent) => {
    const combining = ACCENT_TO_COMBINING[accent];
    const letter = combining ? (base + combining).normalize("NFC") : "";

    return LETTERS.has(letter) ? `<${tag}>${letter}</${tag}>` : whole;
  });
}

export function fixKatexLetters(rawHtml: string): string {
  if (!rawHtml.includes(OPEN)) {
    return rawHtml;
  }

  const html = fixMathml(rawHtml);

  let out = "";
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf(OPEN, cursor);

    if (start === -1) {
      out += html.slice(cursor);
      break;
    }

    out += html.slice(cursor, start);

    const end = spanEnd(html, start);
    const block = end === -1 ? "" : html.slice(start, end);
    const match = block ? ACCENT_HEAD.exec(block) : null;
    const combining = match ? ACCENT_TO_COMBINING[match[4]] : undefined;
    const letter =
      match && combining ? (match[3] + combining).normalize("NFC") : "";

    if (!match || !LETTERS.has(letter)) {
      // Murakkab bölak — özgarişsiz qoldiramiz, içini keyin köramiz
      out += OPEN;
      cursor = start + OPEN.length;
      continue;
    }

    const italic = match[2] ? " mathnormal" : "";
    const tight = match[1] ? " mtight" : "";

    out += `<span class="mord vp-harf${italic}${tight}">${letter}</span>`;
    cursor = end;
  }

  return out;
}
