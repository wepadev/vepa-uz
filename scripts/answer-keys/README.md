# Javoblar kalitini yasash

`lib/answer-keys.ts` fayli shu skript orqali "Matematika 0 dan"
papkasidagi `*javoblar*.pdf` fayllaridan yasalgan.

## Talab

PDF'dan matn olish uchun `pdftotext` kerak (Poppler to'plamidan).
Windows'da: <https://github.com/oschwartz10612/poppler-windows/releases>
yuklab, `bin` papkasini PATH ga qo'shing.

## Ishlatish

```
python scripts/answer-keys/build.py --root "D:\Matematika 0 dan" --out lib/answer-keys.ts
```

## Nimani biladi

Javoblar PDF'lari bir necha xil ko'rinishda yozilgan, skript hammasini
tushunadi:

- `1-variant (nazariya + test)` / `2-variant (1-TEST)` ...
- `1-variant` / `1-TEST (videoyechim va zich fayllar)` ...
- qavssiz `2-variant`, javoblar `1)` ko'rinishida
- `Test / Javob` jadvali (63-mavzu)
- sarlavha nom bilan bir qatorda (64-mavzu)

Har mavzuda 4 ta bo'lim bo'lishi kerak. Agar biror mavzuda boshqacha
chiqsa, skript oxirida ogohlantirib yozadi.

Kalitda yo'q savol `?` bilan belgilanadi — 29 va 43-mavzularda
ayrim savollarning javobi PDF'da berilmagan (javobi yozma yoki grafik).
Ular tekshirishda baholanmaydi.
