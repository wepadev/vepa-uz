# Claude uchun 5 ta skill — o'rnatish to'plami

Bu papka vepa.uz loyihasiga Claude'ning qo'shimcha skill'larini o'rnatish
uchun. Fayllarning o'zi hech narsa o'rnatmaydi — ular sizning
laptopingizda ishga tushiradigan **buyruqlarni** tayyorlab beradi.

## Eng muhim shart

Beshala skill ham **Claude Code** (terminal CLI) uchun yozilgan. Agar
laptopingizda Claude Code o'rnatilmagan bo'lsa, ular ishlamaydi. Tekshirish:

```
claude --version
```

Chiqmasa, avval Claude Code'ni o'rnating, keyin bu to'plamga qayting.

## Ishga tushirish

PowerShell'ni `C:\math-booster` papkasida oching va:

```
powershell -ExecutionPolicy Bypass -File tools\claude-skills\setup-skills.ps1
```

Skript har bir skill uchun "h/y" deb so'raydi — kerakmaslarini `n` bilan
o'tkazib yuborasiz. Bittalab, birin-ketin o'rnatgan ma'qul.

## Nima o'rnatiladi

| # | Skill | Nima qiladi | Qanday |
|---|---|---|---|
| 1 | **claude-mem** | Sessiyalar orasida xotira (SQLite) | `npx claude-mem install` |
| 2 | **impeccable** | Frontend dizayn tekshiruvi, 59 qoida | `npx impeccable install` + `/impeccable init` |
| 3 | **find-skills** | Skill qidirish CLI'si | `npx skills add vercel-labs/skills --skill find-skills` |
| 4 | **task-observer** | Skill'laringizni kuzatib yaxshilash takliflari | `npx skills add ... -g` + CLAUDE.md bloki |
| 5 | **superpowers** | Dizayn→reja→TDD ish jarayoni | Claude Code ichida `/plugin install superpowers@claude-plugins-official` |

5-raqam (superpowers) skript orqali o'rnatilmaydi — u faqat Claude Code
ichidan `/plugin` buyrug'i bilan o'rnatiladi. Skript buni eslatadi.

## task-observer activation

task-observer o'rnatilgach, uning ishlashi uchun `~/.claude/CLAUDE.md` ga
maxsus matn qo'shilishi kerak (shunchaki o'rnatish yetarli emas). Skript
buni o'zi qiladi: `activation-template.txt` ni oladi, yo'llarni sizning
laptopingizga moslab to'ldiradi va `CLAUDE.md` oxiriga BOM'siz qo'shadi.
Ikki marta ishlatsangiz takrorlamaydi.

Workspace (kuzatuv yozuvlari saqlanadigan joy):
`C:\Users\<siz>\.claude\task-observer`

## Diqqat — xavfsizlik

Bu skill'lar uchinchi tomon kodi. Ko'pchiligi **har sessiyada avtomatik**
ishga tushadigan hook o'rnatadi va loyiha kodingizni o'qiydi. claude-mem'da
bundan tashqari onlayn qism bor — skript uni login so'ramaydigan qilib
(`CLAUDE_MEM_ONLINE_OPTIN=false`) ishga tushiradi.

vepa.uz'da o'quvchilar ma'lumoti bor. Shuning uchun:

- hammasini birdan emas, bittalab o'rnating;
- har birini o'rnatgach yangi sessiyada sinab ko'ring;
- keraksizini keyin o'chirib tashlang.

## Tekshirish

Har bir skill o'rnatilgandan keyin **yangi** Claude Code sessiyasini oching
(o'rnatgan sessiya o'zini tekshira olmaydi). task-observer ishlayotgan
bo'lsa, bir necha sessiyadan keyin
`C:\Users\<siz>\.claude\task-observer\skill-observations\observation-log\`
papkasi paydo bo'ladi.
