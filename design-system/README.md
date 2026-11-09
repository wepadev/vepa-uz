# Vepa Ustoz — dizayn tizimi tokenlari

Bu papka Vepa Ustoz dizayn tizimining kod tomoni. Manba — `tokens.json`; qolgan ikkala fayl undan avtomatik yaratiladi.

| Fayl | Nima |
|---|---|
| `tokens.json` | Ranglar (yoruğ/qoronği), tipografiya, böşliq, burçak, soya — yagona manba |
| `vepa-tokens.css` | `--vp-*` CSS özgaruvçilari: `:root` — yoruğ, `.dark` — qoronği |
| `tailwind-preset.ts` | Tailwind 3.4 preset: `mb-*` (eski nomlar) va `vp-*` ranglar özgaruvçilarga bağlangan |

**Ulangan:** `app/globals.css` boşida `@import "../design-system/vepa-tokens.css";`, `tailwind.config.ts` da `presets: [vepaPreset]`.

- `mb-*` — yangi yoruğ qiymatlar (brend #1667e0, muted #5e6b82 — WCAG AA), tun rejimini avvalgidek `app/dark-theme.css` boşqaradi.
- `vp-*` — temaga qarab özi almaşadi (`--vp-*` özgaruvçilar). Yangi kodda şularni işlating.

Tokenni özgartiriş: `tokens.json` → `vepa-tokens.css` va `tailwind-preset.ts` qayta yaratiladi (dizayn tizimidagi generator). Batafsil: dizayn tizimidagi "Kodga ulaş" bölimi.
