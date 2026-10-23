# Testlar

Ikki xil test bor: sayt mantiqi va baza qoidalari.

## Sayt mantiqi

```
npm test
```

Node'ning o'z test tizimi ishlatiladi — qo'shimcha paket kerak emas.
Tekshiriladigan joylar:

- **Variantlarni aralashtirish** — bir xil o'quvchida tartib
  o'zgarmasligi, variantlar yo'qolmasligi, "Barchasi to'g'ri" kabi
  variantlar joyida qolishi
- **PDF tahlili natijasi** — sun'iy intellekt xato javob qaytarsa,
  nuqsonli savol bazaga tushmasligi
- **Bir nechta variant** — bitta PDF'dagi variantlarning alohida
  testga bo'linishi, nuqsonli variant qolganlarini yo'qotmasligi,
  eski (o'ramsiz) javob shakli ham tushunilishi
- **Videoyechim havolasi** — faqat YouTube qabul qilinishi
- **Sinf oralig'i** — 5 dan 11 gacha
- **Qidiruv matni** — bazaga yuborishdan oldin xavfli belgilar
  tozalanishi, o'zbekcha "oʻ", "gʻ" harflari saqlanishi
- **Xato xabarnomasi** — sozlanmagan holatda jim turishi, bir xil
  xatoni takror yubormasligi, Telegram ishlamasa ham xato tashlamasligi
- **Dars progressi** — bir nechta testning o'rtachasi, ishlanmagan
  testning nolga tenglashishi, testsiz darsning keyingisini
  to'smasligi

## Baza qoidalari

```
npm run test:sql
```

Haqiqiy PostgreSQL ishga tushiriladi va `db/` papkasidagi
migratsiyalar unga qo'llanadi. Shundan keyin tekshiriladi:

- **Uy vazifasi qoidalari** — bir marta ishlash, muddat, guruh
  a'zoligi, guruh o'chirilganda natijalar saqlanishi
- **Javob qoralamasi** — javob saqlanishi, begona o'quvchi ko'ra
  olmasligi, test yuborilgach tozalanishi, yopilgan yoki muddati
  o'tgan sessiyaga yozilmasligi
- **Haftalik takrorlash** — xato va javobsiz savollar ro'yxatga
  tushishi, ular o'sha kuni emas keyingi dushanbaga belgilanishi,
  to'g'ri yechilgan savol butunlay yopilishi, xato qilinsa keyingi
  haftaga qolishi, to'g'ri javob vaqtidan oldin oshkor bo'lmasligi
- **Guruh hisoboti** — o'quvchi guruhga qo'shilishidan oldingi
  vazifalar unga yozilmasligi, o'quvchi hisobotni ko'ra olmasligi
- **Offline guruhlar CRM** — ball qoidaga ko'ra hisoblanishi, qoida
  o'zgarganda o'tgan kunlar qayta hisoblanmasligi, tanga sarflanganda
  ball kamaymasligi, zaxira va balans tekshiruvlari
- **Umumiy tanga hamyoni** — kod bilan qo'shilish, onlayn vazifadan
  tanga bir marta yozilishi, offline va onlayn tanganing birlashishi,
  so'rov yuborilganda tanga ushlab qolinishi, dublikat yozuvlarni
  birlashtirish
- **Guruhlarni birlashtirish** — har bir guruhning ikkala yarmi
  bog'lanishi va bitta kodga ega bo'lishi, istalgan kod bilan ikkala
  ro'yxatga qo'shilish, nomning birga o'zgarishi, ballning "jami
  berilgan" dan mustaqilligi
- **O'quvchi ko'rinishi** — o'z ballari va tarixi, guruhdagi o'rni,
  reytingda davomat va xulqning yashirin qolishi, begona guruh
  ma'lumotining umuman qaytmasligi
- **Vazifa balli** — onlayn vazifa ball berishi, ball aynan o'sha
  guruhga tushishi, vazifaga guruh testi ham katalog testi ham
  tanlanishi, dars testining ro'yxatga tushmasligi
- **Kunni ikki marta saqlash** — ball qo'shilib ketmasligi, bitta
  kun uchun bitta dars yozuvi qolishi
- **Tanga hisobi** — jami balldan hisoblanishi (152 ball → 15 tanga),
  hamyon balansining ham shu qoidada bo'lishi, guruhning o'z
  qoidasi qo'llanishi
- **Bazani tozalash** — tugallangan urinish va javoblarining
  saqlanishi, tashlab ketilgan urinishning o'chishi, ochiq
  sessiyaga tegilmasligi, o'quvchiga ruxsat berilmasligi
- **Do'kon guruh uchun** — guruhga qo'shilmagan o'quvchiga sovg'alar
  ro'yxatining bo'sh qaytishi va so'rovining to'silishi
- **Darsga bir nechta test** — dars testining vazifa ro'yxatida
  chiqmasligi, bitta darsga bir nechta test biriktirilishi, test
  o'chirilganda bog'lamning ham o'chishi
- **Testni o'chirish** — urinish, javob, sessiya, qoralama va
  takrorlash yozuvining birga ketishi, boshqa testlarga tegilmasligi,
  o'quvchiga ruxsat berilmasligi, tangasi sovg'aga sarflangan
  testning o'chirilmasligi

Buning uchun bir marta o'rnatish kerak:

```
npm i -D @electric-sql/pglite
```

O'rnatilmagan bo'lsa test xatosiz o'tkazib yuboriladi.

## Hammasini birdan

```
npm run check
```

Tiplar, lint va testlar ketma-ket ishga tushadi. O'zgarish
kiritgandan keyin shu buyruqni ishlatish odat bo'lsa yaxshi.
