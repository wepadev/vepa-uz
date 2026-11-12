# Dizayn qoidalari

Sayt ham, admin panel ham bitta körinişda böliş kerak. Yangi sahifa
yozganda şu qoidalarga amal qiling — şunda heç narsani "moslaştirib"
ötiriş kerak bölmaydi.

## Ğoya (2026-11, ikkinçi nashr)

Öquvçi telefonni oçganda bitta savolga javob oladi: **"hozir nima
qilaman?"** Har sahifa şu tartibda quriladi:

1. **Holat** — men qayerdaman (foiz halqasi, örin, nechta işlangan).
2. **Keyingi qadam** — bitta asosiy tugma.
3. **Röyxat** — qolgan hamma narsa, bir xil qatorlarda.

Bezak emas, tuzilma: şablon "SaaS" körinişi (kök gradient blok, pastel
plitkalar, har xil rangli ikonkalar) ataylab olib taşlangan.

## Ranglar — bitta formuladan

Hamma rang `scripts/build-palette.mjs` da OKLCH fazosida yasaladi:
yoruğlik pogonasi hamma rangda bir xil, töyinganlik egri çizigi bir
xil, faqat tus farq qiladi. Şuning uçun yonma-yon turganda bir oila
bölib körinadi.

| Rang | Tus | Vazifa | 600-pogona |
| --- | --- | --- | --- |
| `slate` | 264° | matn, çegara, fon (kulrang ham kök tusida) | `#5b6374` |
| `blue` | 264° | brend: tugma, havola, faol holat | `#285ee7` |
| `amber` | 78° | **yagona iliq urğu**: Premium, tanga, rekord | `#c38903` |
| `emerald` | 158° | faqat **töğri javob / bajarildi** | `#018250` |
| `red` | 24° | faqat **xato / öçiriş** | `#c71f2d` |
| `violet`, `teal` | 296°, 200° | faqat admin grafiklari | — |

Qoidalar:

- Sahifada **bitta** iliq (sariq) element böladi. Ikki joyda sariq
  bölsa — biri ortiqça.
- Yaşil va qizil — holat. Ular bezak yoki bölim rangi sifatida
  işlatilmaydi.
- Tugma va havola doim brend kökida (`mb-brand`).
- **Gradient yöq.** Tugma va plitka tekis rangda.

Rangni özgartiriş:

```
node scripts/build-palette.mjs      # design-system/palette.json va tokenlar
node scripts/build-dark-theme.mjs   # app/dark-theme.css
```

Klasslarda ikki xil nom bor:

- `vp-*` (`bg-vp-surface`, `text-vp-muted`, `border-vp-line`,
  `text-vp-success` …) — CSS özgaruvçilari, tun rejimida özi almaşadi.
  **Yangi kodda şularni işlating.**
- `mb-*` va `slate-*` / `blue-*` — eski nomlar, yangi palitraga
  bağlangan; tun qiymatini generator beradi.

## Şrift

Bitta oila — **Geologica** (kirill va lotinni, `ö ğ ş ç` ni töliq
qöllaydi). Sarlavha `font-extrabold`, matn `font-medium`/oddiy.
Raqamlar `.num` klassi bilan (bir xil enli raqamlar) — jadval va
hisoblagiçlar sakramaydi.

Kiçik bölim yorliği — `.eyebrow` (bosh harflar, siyrak).

## Belgilar

Ikki qatlam, ikkalasida ham bitta qoida:

- **Bölim belgilari** — `components/ui/glyph.tsx`. Özimiz çizgan:
  tör 48×48, çiziq 2.5, uçlari yumaloq; kök çiziq, oçiq kök iç va
  **bitta sariq nuqta** (eng muhim joy). `<GlyphTile name="tests" />`.
  Yangi bölim qöşilsa — şu faylga yangi belgi çiziladi, tayyor ikonka
  qöyilmaydi.
- **Mayda amal ikonkalari** — lucide, hammasi 1.75 qalinlikda
  (`app/globals.css` da bir joyda berilgan). Qalinlikni qölda
  özgartirmang.

Emoji interfeysda işlatilmaydi (medal, tanga, olov — belgi yoki
raqam bilan).

## Sirt va tugmalar

`app/globals.css`, "VEPA TIZIMI" bloki; tayyor klasslar `lib/ui.ts` da.

| Narsa | Klass | Qoida |
| --- | --- | --- |
| Karta | `card` | oq, `rounded-2xl`, ingiçka çegara, soya yöq |
| Bosiladigan karta / ikkinçi tugma | `edge`, `btnGhost` | pastki qirrasi bor, bosganda tuşadi |
| Asosiy tugma | `btnPrimary` (`.btn-solid`) | kök, `rounded-xl`, kamida `min-h-11` |
| Premium tugmasi | `btnAccent` (`.btn-accent`) | sariq; sahifada bitta |
| Şaxsiy holat bloki | `.spotlight` | kök blok: "sizning örningiz", "keyingi qadam". **Sahifada köpi bilan bitta** |
| Sahifa boşidagi fon | `.grid-plane` | nozik katak — faqat sarlavha plitkasida |

## Tayyor qismlar

| Qism | Fayl | Qaçon |
| --- | --- | --- |
| `PageHeader` | `components/ui/page-header.tsx` | har sahifa boşida: orqaga, belgi, sarlavha, bitta amal |
| `RowList`, `RowLink`, `RowIndex`, `Tag`, `RowLock` | `components/ui/row.tsx` | har qanday röyxat (mavzular, testlar, bölimlar) |
| `ProgressRing` | `components/ui/progress-ring.tsx` | foiz — doim halqada, alohida "katak"da emas |
| `EmptyState` | `components/ui/empty-state.tsx` | böş holat: belgi, bitta gap, bitta tugma |
| `PremiumNote` | `components/ui/premium-note.tsx` | yopiq narsalar izohi — sahifada **bir marta**, har qatorda emas |
| `AuthShell` | `components/auth-shell.tsx` | kiriş / parol sahifalari |

Yopiq (Premium) qator: kulrang qulf (`RowLock`) va oddiy "Oçiş"
tugmasi. Sariq tugma faqat `PremiumNote` içida.

## Sarlavha

```tsx
<PageHeader
  backHref="/tests"
  backLabel="Testlar"
  glyph="certificate"
  title="Milliy sertifikat"
  subtitle="Bölimni tanlang"
  action={<Link …>Natijalarim</Link>}
/>
```

- **Bitta** orqaga havolasi.
- Izoh bitta qator. Ikki qator kerak bölsa — matn uzun.
- Öngda faqat **bitta** amal.

## Matn

- Yangi alifbo: `ö ğ ş ç` (o', g', sh, ch emas).
- Sahifada nima qiliş kerakligi **bir marta** yoziladi.
- Uzun izohlar `details` içiga yiğiladi.
- Raqam bor joyda söz kam: "12 ta test".

## Tun rejimi

Ranglarni qölda `dark:` bilan yozmang.

- `vp-*` klasslari özi almaşadi.
- Qolgan klasslar uçun `node scripts/build-dark-theme.mjs` —
  `app/dark-theme.css` ni qaytadan yozadi (palitra
  `design-system/palette.json` dan). Generatorni istalgan payt qayta
  işga tuşiriş mumkin.
- Generator bera olmaydigan qöl qoidalari
  `scripts/dark-theme-extras.css` da turadi va har safar oxiriga
  qöşiladi. `app/dark-theme.css` ni qölda tahrirlamang.

Yangi rang klassi qöşsangiz generatorni işga tuşiring.

## Admin

Admin panel şu palitra va qismlardan foydalanadi. Bölim guruhlari
ohangi (`components/ui/section-visual.ts`) faqat admin boş sahifasida
ikonka plitkasida körinadi; öquvçi tomonida bölimlar belgi
(`Glyph`) bilan ajraladi, rang bilan emas.
