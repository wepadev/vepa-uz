import json, re, subprocess, os, sys, argparse
from collections import Counter

ap = argparse.ArgumentParser(description="Javoblar PDF'laridan lib/answer-keys.ts yasaydi")
ap.add_argument("--root", required=True, help='"Matematika 0 dan" papkasi')
ap.add_argument("--out", default="lib/answer-keys.ts")
args = ap.parse_args()

ROOT = args.root

def discover(root):
    """Har mavzu papkasidan bitta javoblar PDF'ini topadi."""
    out = []
    for name in sorted(os.listdir(root)):
        folder = os.path.join(root, name)
        if not os.path.isdir(folder):
            continue
        if name.startswith("_") or name == "Claude outputs":
            continue
        cands = [f for f in os.listdir(folder)
                 if "javob" in f.lower() and f.lower().endswith(".pdf")]
        if not cands:
            continue
        m = re.match(r"\s*(\d+)", name)
        out.append({"n": int(m.group(1)) if m else 9999,
                    "folder": name,
                    "file": sorted(cands, key=len)[0]})
    return sorted(out, key=lambda x: x["n"])

topics = discover(ROOT)

HDR_RE=re.compile(r"(\d)\s*[-–]\s*(?:variant|TEST)\b",re.I)
ANS_RE=re.compile(r"\b(\d{1,2})\s*[.)]\s*([A-D])\b")
NUMS_RE=re.compile(r"\b\d{1,2}\b")
LETT_RE=re.compile(r"\b([A-D])\b")

def inline_pairs(block):
    p={}
    for q,a in ANS_RE.findall(block):
        q=int(q)
        if 1<=q<=60 and q not in p: p[q]=a
    return p

def table_pairs(block):
    """'Test 1 2 3' / 'Javob A C B' juft qatorlari"""
    p={}; lines=block.split("\n")
    for i,ln in enumerate(lines):
        if re.search(r"^\s*Test\b",ln,re.I):
            nums=[int(x) for x in NUMS_RE.findall(ln)]
            for j in range(i+1,min(i+3,len(lines))):
                if re.search(r"^\s*Javob\b",lines[j],re.I):
                    letts=LETT_RE.findall(lines[j].upper())
                    for q,a in zip(nums,letts):
                        if 1<=q<=60 and q not in p: p[q]=a
                    break
    return p

out,problems=[],[]
for t in topics:
    pdf=os.path.join(ROOT,t["folder"],t["file"])
    txt=subprocess.run(["pdftotext","-layout",pdf,"-"],capture_output=True,text=True).stdout

    raw=[(m.start(),m.end(),m.group(0)) for m in HDR_RE.finditer(txt)]
    marks=[]                      # "2-variant / 1-TEST" -> bitta sarlavha
    for m in raw:
        if marks and m[0]-marks[-1][1] <= 30: marks[-1]=(marks[-1][0],m[1],marks[-1][2]+" / "+m[2])
        else: marks.append(list(m))
    marks=[tuple(x) for x in marks]
    if not marks:
        problems.append((t["n"],"sarlavha yo'q")); out.append({"n":t["n"],"title":"","variants":[]}); continue

    secs=[]
    for i,(s,e,label) in enumerate(marks):
        end=marks[i+1][0] if i+1<len(marks) else len(txt)
        block=txt[e:end]
        p=inline_pairs(block) or table_pairs(block)
        if p: secs.append((label.strip(),p))

    variants=[]
    for idx,(label,p) in enumerate(secs):
        n=max(p)
        variants.append({"slot":idx,"label":label,"count":n,
            "answers":"".join(p.get(q,"?") for q in range(1,n+1)),
            "missing":[q for q in range(1,n+1) if q not in p]})

    title=re.sub(r"[-—]\s*javoblar.*$","",txt.strip().split("\n")[0],flags=re.I).strip(" -—")
    title=HDR_RE.sub("",title).strip(" -—/")
    out.append({"n":t["n"],"folder":t["folder"],"title":title,"variants":variants})

    if len(variants)!=4: problems.append((t["n"],f"{len(variants)} ta bo'lim"))
    for v in variants:
        if v["missing"]: problems.append((t["n"],f"slot{v['slot']} yetishmaydi {v['missing']}"))


print("mavzu:",len(out))
print("bo'lim soni:",Counter(len(x["variants"]) for x in out))
print("savol soni:",Counter(v["count"] for x in out for v in x["variants"]).most_common())
print("\nmuammoli:",sorted({p[0] for p in problems}))
for p in problems: print("  ",p)


# ---------- TypeScript faylini yozish ----------

data=out
data.sort(key=lambda x:x["n"])

# sanity
assert len(data)>0
for t in data:
    assert len(t["variants"])==4, t["n"]

def esc(s): return s.replace("\\","\\\\").replace('"','\\"')

lines=[]
lines.append("""/**
 * Test javoblari kaliti — "Matematika 0 dan" to'plamidan.
 *
 * Har mavzuda 4 ta variant: 0 = nazariya + test, 1 = 1-test,
 * 2 = 2-test, 3 = 3-test. `answers` — har bir savolning javobi
 * ketma-ket: "A", "B", "C" yoki "D". "?" belgisi — o'sha savolning
 * kaliti PDF'da yo'q (masalan javobi yozma yoki grafik), u tekshirishda
 * hisobga olinmaydi.
 *
 * Bu fayl `scripts/answer-keys/build.py` orqali "Matematika 0 dan"
 * papkasidagi javoblar PDF'laridan yasalgan. Qo'lda tahrirlasangiz
 * ham bo'ladi, lekin PDF o'zgarsa skriptni qayta ishga tushirgan ma'qul.
 */

export type AnswerVariant = {
  /** PDF'dagi sarlavha: "1-variant", "2-variant / 1-TEST" */
  label: string;
  /** Har savolning javobi ketma-ket, masalan "CDCBDAADBCBDCBA" */
  answers: string;
};

export type AnswerTopic = {
  /** Mavzu raqami (1..89) */
  n: number;
  title: string;
  /** Doim 4 ta: nazariya, 1-test, 2-test, 3-test */
  variants: AnswerVariant[];
};

/** Test turlari — `variants` massividagi tartib bilan bir xil */
export const TEST_LABELS = [
  "Nazariya",
  "1-test",
  "2-test",
  "3-test",
] as const;

export const ANSWER_TOPICS: AnswerTopic[] = [""")

for t in data:
    lines.append("  {")
    lines.append(f'    n: {t["n"]},')
    lines.append(f'    title: "{esc(t["title"])}",')
    lines.append("    variants: [")
    for v in t["variants"]:
        lines.append(f'      {{ label: "{esc(v["label"])}", answers: "{v["answers"]}" }},')
    lines.append("    ],")
    lines.append("  },")
lines.append("];")
lines.append("")
lines.append("""/** Mavzuni raqami bo'yicha topish */
export function findAnswerTopic(n: number): AnswerTopic | null {
  return ANSWER_TOPICS.find((topic) => topic.n === n) ?? null;
}
""")

open(args.out,"w",encoding="utf-8").write("\n".join(lines))
print("yozildi:", args.out)
print("mavzu:", len(data))
tot=sum(len(v["answers"]) for t in data for v in t["variants"])
unk=sum(v["answers"].count("?") for t in data for v in t["variants"])
print("jami javob:", tot, "| kaliti yo'q:", unk)

