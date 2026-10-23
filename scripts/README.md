# Test import qilish

PDF'dan saytga test qo'shish uchun skriptlar.

## Ish tartibi

1. Menga PDF va javob kalitlarini yuborasiz, test nomi va bo'limini aytasiz
2. Men `tests-data/<nom>.json` faylini tayyorlayman
3. Siz JSON'ni ko'rib chiqasiz — savollar va javoblar to'g'rimi
4. Skriptni ishga tushirasiz, test saytda paydo bo'ladi (yopiq holda)
5. Admin panelda ko'rib chiqib nashr qilasiz

## Buyruqlar

Avval bo'limlar ro'yxatini ko'ring — `sectionId` shu yerdan olinadi:

```bash
node scripts/list-sections.mjs
```

Testni tekshirish (bazaga hech narsa yozilmaydi):

```bash
node scripts/import-test.mjs tests-data/namuna.json --dry-run
```

Testni haqiqatan qo'shish:

```bash
node scripts/import-test.mjs tests-data/namuna.json
```

Darrov nashr qilish kerak bo'lsa (tavsiya etilmaydi):

```bash
node scripts/import-test.mjs tests-data/namuna.json --publish
```

## JSON tuzilishi

`tests-data/namuna.json` faylini namuna sifatida oling.

### Test darajasidagi maydonlar

| Maydon | Majburiy | Izoh |
|---|---|---|
| `title` | ha | Test nomi |
| `sectionId` | ha | `list-sections.mjs` dan olinadi |
| `description` | yo'q | Qisqa tavsif |
| `timeLimitMinutes` | yo'q | Default: 60 |
| `isFree` | yo'q | Default: false |

### Variantli savol

```json
{
  "type": "choice",
  "text": "Savol matni",
  "options": { "a": "…", "b": "…", "c": "…", "d": "…" },
  "correct": "B",
  "solution": "Yechim matni",
  "image": "rasmlar/1-savol.png",
  "solutionVideo": "https://youtu.be/…"
}
```

### Yozma savol

```json
{
  "type": "written",
  "text": "Umumiy shart (ixtiyoriy)",
  "parts": [
    { "label": "a", "text": "…", "answer": "39", "solution": "…" },
    { "label": "b", "text": "…", "answer": "210", "accepted": ["210.0"] }
  ]
}
```

`accepted` — qabul qilinadigan muqobil yozuvlar (masalan `0.5` va `1/2`).

## Formulalar

Formulalar KaTeX bilan yoziladi: `$x^2 + 1$` yoki alohida qatorda `$$…$$`.

JSON'da teskari chiziq ikki marta yoziladi: `\\frac{1}{2}`, `\\sqrt{5}`.

## Rasmlar

Rasm fayllarini JSON yonidagi papkaga qo'ying va nisbiy yo'l bilan ko'rsating:

```
tests-data/
  attestatsiya-1.json
  rasmlar/
    1-savol.png
```

Skript ularni `question-images` bucket'iga o'zi yuklaydi.

## Xavfsizlik

Skript `.env.local` dagi `SUPABASE_SECRET_KEY` dan foydalanadi. Bu kalit
RLS ni chetlab o'tadi, shuning uchun skriptlar faqat sizning
kompyuteringizda ishlaydi va kalit hech qachon brauzerga tushmaydi.

Xato bo'lsa skript o'zi orqaga qaytaradi — yarim qo'shilgan test
bazada qolmaydi.
