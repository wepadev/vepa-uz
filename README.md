# Vepa Ustoz — vepa.uz

Vepa Kurbanklichevning matematika platformasi: onlayn testlar,
videodarslar, darslik yechimlari, guruh va uy vazifasi tizimi.

**Texnologiya:** Next.js (App Router) + Supabase, Vercel'da
(`math-booster` loyihasi). `main` ga push qilinsa Vercel o'zi
deploy qiladi.

## Ishga tushirish

```bash
npm ci
npm run dev        # http://localhost:3000
npm run check      # tsc + eslint + testlar (GitHub ham shuni tekshiradi)
npm run test:sql   # baza funksiyalari testlari (PGlite, internet kerak emas)
```

`.env.local` da kerak bo'ladi: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Papkalar

| Papka | Nima bor |
| --- | --- |
| `app/` | Sahifalar. `app/admin/` — admin panel |
| `components/` | Umumiy komponentlar, `components/ui/` — asosiy bloklar |
| `lib/` | Mantiq: javob tekshirish, kirish ruxsatlari, Supabase mijozlari |
| `db/` | Supabase'da qo'lda ishga tushiriladigan SQL fayllar ([db/README.md](db/README.md)) |
| `scripts/` | Test import qilish va baza xizmati ([scripts/README.md](scripts/README.md)) |
| `tests/` | Avtomatik testlar |
| `docs/dizayn.md` | Dizayn qoidalari |
