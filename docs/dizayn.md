# Dizayn qoidalari

## Ğoya: katakli daftar (2026-11)

Sayt — matematikani qoğoz va ruçka bilan işlaydigan öquvçining
daftari. Şablon "SaaS" körinişi (kök blok, ustida oq doiralar,
pastel plitkalar) ataylab olib taşlandi.

| Element | Qiymat | Qayerda |
| --- | --- | --- |
| Qoğoz (fon) | `#f7f5f0` = `slate-50`, `mb-page` | `body`, sahifa foni |
| Varaq (karta) | oq, çegara `mb-line` (`#e3dfd6`), soyasiz | `card` |
| Siyoh (matn) | `#161b28` = `slate-900`, `mb-ink` | matn, sarlavha |
| Logo köki | `#1d47c9` = `blue-600`, `mb-brand` | tugma, havola, faol tab |
| Ustoz ruçkasi | `#d7362a` = `text-pen` | faqat bezak: baho, belgi. **Holat emas** |
| Marker | `#ffe27a` = `.marker` | sarlavhadagi bitta muhim söz |
| Doska | `.hero-board` (töq, nozik katak) | sahifa boşidagi katta blok |

`slate-*` va `blue-*` Tailwind ranglari `tailwind.config.ts` da shu
palitraga qayta belgilangan — eski klasslar özi yangi körinişga ötadi.

**Şriftlar:** sarlavhalar (`h1`, `h2`) — Literata (`font-serif`),
formulalar bilan bir oila; interfeys — Golos Text; qöl yozuvi —
Caveat (`font-hand`), faqat imzo kabi 1–2 joyda.

**Naqşlar** (`app/globals.css`, "KATAKLI DAFTAR" bloki):
`.paper-grid` — katakli varaq, `.paper-margin` — qizil hoşiya,
`.ruler` — çizğiç belgili ajratgiç, `.eyebrow` — kiçik yorliq,
`.btn-solid` — tugmaning pastki qalinligi (kök `a/button` larda
avtomatik).


Sayt ham, admin panel ham bitta ko'rinishda bo'lishi kerak. Yangi
sahifa yozganda shu qoidalarga amal qiling — shunda hech narsani
"moslashtirib" o'tirish kerak bo'lmaydi.

## Sarlavha

Har bir sahifa `components/ui/page-header.tsx` bilan boshlanadi:

```tsx
<PageHeader
  backHref="/tests"
  backLabel="Testlar"
  title="Milliy sertifikat"
  subtitle="Bo‘limni tanlang"
  chips={["12 ta test"]}
  action={<Link …>Natijalarim</Link>}
/>
```

Qoidalar:

- **Bitta** orqaga havolasi, brend rangida.
- Sarlavha `text-xl`, qalinligi `font-bold` (qora emas).
- Izoh bitta qator. Ikki qator kerak bo'lsa — demak matn uzun.
- O'ngda faqat **bitta** asosiy amal.
- Brend nomi, "Salom, ism" va foydalanuvchi roli sarlavhada
  yozilmaydi — ular profil sahifasida.

## Ranglar

Rang ikki xil ish qiladi va ular hech qachon aralashmaydi.

### 1. Ohang — "bu qayer"

Bo'limlar **guruhlarga** bo'lingan, har guruhning bitta ohangi bor.
Ohang faqat **ikonka ostidagi yumshoq plitkada** va guruh
sarlavhasida ko'rinadi.

| Guruh | Ohang | Bo'limlar |
| --- | --- | --- |
| O'quvchilar va guruhlar | yashil (`emerald`) | Guruhlar, Foydalanuvchilar, Guruhim |
| Testlar va imtihon | ko'k (`blue`) | Testlar, Test tekshirish, Taymer, Premium |
| O'quv materiallari | sariq (`amber`) | Darslik yechimlari, Videodarslar, Takrorlash, Do'kon |
| Natija va tahlil | binafsha (`violet`) | Natijalar, Analitika, Reyting |
| Tizim | kulrang (`slate`) | Texnik xizmat |

Ro'yxat bitta joyda: `components/ui/section-visual.ts`. Yangi bo'lim
qo'shsangiz uni mavjud guruhlardan biriga qo'shing — **beshinchi
ohang o'ylab topmang**.

Ranglar ko'zga emas, o'lchab tanlangan (OKLab ΔE): eng yaqin juft
oddiy ko'rishda 27, rang ko'rmaslikda 25 birlik uzoqlikda. Hammasi
600-pog'onada, shuning uchun bir oila bo'lib ko'rinadi.

### 2. Holat — "bu qanday"

Holat **matnli yumaloq yorliqda** ko'rsatiladi, plitkada emas:

| Holat | Rang |
| --- | --- |
| bepul, nashr qilingan, to'g'ri javob | `emerald` |
| qoralama, ogohlantirish, tanga | `amber` |
| o'chirish, xato, noto'g'ri javob | `red` |

Yashil va sariq ikkala ro'yxatda ham bor — bu xato emas: ohang
plitkada, holat yorliqda turadi, ular bitta elementda uchrashmaydi.

### Nima rang OLMAYDI

- **Tugma va havola** — doim brend ko'kida (`mb-brand`). Rang
  "bu qayer" deydi, "bu muhim" demaydi.
- **Bo'lim ichidagi ish yuzasi** — mavzu ro'yxati, savol varianti,
  jadval: ko'k va kulrang. Ohang faqat bo'limga **kiraverishda**.
- **Matn** — `mb-ink` va `mb-muted`, chegara `mb-line`.

**Gradient ishlatilmaydi.** Tugma va plitka tekis rangda:
`bg-mb-brand`, `bg-amber-500`, `bg-emerald-600`. Katta blok —
`.hero-board`, bezak doiralari qöşilmaydi. Ikki rangli
o'tish ko'zni charchatadi va tun rejimida buziladi.

## Shakl

- Karta: `rounded-2xl` (14px), oq fon, `border-mb-line`, soya yöq;
  ustiga kelganda çegara töqlaşadi (`sm:hover:border-slate-300`), sakramaydi.
- Katta e'lon kartasi (hero): `rounded-3xl` (20px), `.hero-board`.
- Tugma: `rounded-xl`, balandligi kamida `min-h-11`.
- Ikonka plitkasi: `rounded-2xl`, o'lchami 40–56 px.

Tayyor klasslar `lib/ui.ts` da: `card`, `btnPrimary`, `btnGhost`,
`chip`, `field`, `pageSection`.

## Matn

- Sahifada nima qilish kerakligi **bir marta** yoziladi.
- Uzun izohlar `details` ichiga yig'iladi.
- Raqam bor joyda so'z kam: "12 ta test" — "Bu bo'limda 12 ta test
  mavjud" emas.

## Tun rejimi

Ranglarni qo'lda `dark:` bilan yozmang. Yangi klass uçun
`app/dark-theme.css` oxiridagi "Katakli daftar" blokiga qator qöşing.
`scripts/build-dark-theme.mjs` ni qayta işga tuşirmang — u qöl bilan
yozilgan qatorlarni öçiradi. Generator:

```
node scripts/build-dark-theme.mjs
```

Yangi rang klassi qo'shsangiz shu buyruqni ishga tushiring.
