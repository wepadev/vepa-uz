# Vepa Ustoz — dizayn tizimi tokenlari

Bu papka dizayn tizimining kod tomoni. Ranglar qölda yozilmaydi —
`scripts/build-palette.mjs` ularni bitta OKLCH formulasidan yasaydi.

| Fayl | Nima |
|---|---|
| `palette.json` | Generator natijasi: `slate`, `blue`, `amber`, `emerald`, `red`, `violet`, `teal` pogonalari va `night` (tun sirtlari). Tailwind va tun rejimi generatori şundan öqiydi |
| `tokens.json` | Ranglar (yoruğ/qoronği), tipografiya, böşliq, burçak — töliq röyxat |
| `vepa-tokens.css` | `--vp-*` CSS özgaruvçilari: `:root` — yoruğ, `.dark` — qoronği |
| `tailwind-preset.ts` | Tailwind 3.4 preset: `mb-*` va `vp-*` ranglar |

**Ulangan:** `app/globals.css` boşida `@import "../design-system/vepa-tokens.css";`, `tailwind.config.ts` da `presets: [vepaPreset]` va `palette.json`.

- `vp-*` — temaga qarab özi almaşadi. Yangi kodda şularni işlating.
- `mb-*` — eski nomlar, yangi palitraga bağlangan; tun qiymati `app/dark-theme.css` da.

Rangni özgartiriş:

```
node scripts/build-palette.mjs      # palette.json + tokenlardagi ranglar
node scripts/build-dark-theme.mjs   # app/dark-theme.css
```

Qoidalar va tayyor qismlar: `docs/dizayn.md`.
