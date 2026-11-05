# Baza fayllari

Bu papkadagi `.sql` fayllar Supabase'da qo'lda ishga tushiriladi:
**Supabase → SQL Editor → faylni yopishtiring → Run**.

Hammasi qayta ishga tushirishga bardoshli (`create or replace`,
`if not exists`), ya'ni ikki marta bossangiz ham hech narsa buzilmaydi.
Tartib bilan yuring — keyingi fayl oldingisiga tayanishi mumkin.

| Fayl | Nima qiladi |
| --- | --- |
| `01-uy-vazifasi.sql` | Guruhlar, a'zolik, vazifa berish asoslari |
| `02-vazifa-berish.sql` | Vazifa yaratish va o'quvchi ro'yxati |
| `03-javobni-togrilash.sql` | Yozma javobni qo'lda to'g'rilash, kalitga qo'shish |
| `04-tashlab-ketilgan-sessiyalar.sql` | Boshlab tashlab ketilgan testlarni yopish |
| `05-qayta-ochish-va-tahlil.sql` | Vazifani bitta o'quvchiga qayta ochish, savol tahlili |
| `06-guruh-testlari.sql` | "Guruhlar uchun maxsus testlar" yo'nalishi (o'quvchiga ko'rinmaydi) |
| `07-faol-sessiya.sql` | Ochiq sessiyani topish — sahifa GET'da yangi sessiya yaratmasin |
| `08-test-ruxsati.sql` | Testga kirish huquqini tekshirish |
| `09-mavzu-videosi.sql` | Videoyechim mavzu darajasiga ko'chdi; maktab bepul / TOP premium |
| `10-guruh-testlari-bepul.sql` | Guruh testlari doim bepul (trigger bilan qulflangan) |
| `11-yuborish-muhlati.sql` | Javob yuborish muhlati 15 s → 60 s |
| `12-guruh-hisoboti.sql` | Guruh bo'yicha o'quvchi va qiyin vazifalar hisoboti |
| `13-platforma-korsatkichlari.sql` | Admin bosh sahifasidagi o'rtacha foiz (bazada hisoblanadi) |
| `14-javob-qoralamasi.sql` | Test ishlashda javoblar fonda saqlanadi — telefon o'chsa yo'qolmaydi |
| `15-takrorlash.sql` | Xato qilingan savollar 1-3-7-30 kun oralig'ida qaytadi |
| `16-hisobot-tafsiloti.sql` | Ota-onalar yig'ilishiga chiqariladigan varaq uchun ma'lumot |
| `17-crm.sql` | Offline guruhlar: o'quvchilar, darslar, davomat va kunlik ball |
| `18-crm-dokon.sql` | Sovg'a do'koni: tangani sovg'aga almashtirish |
| `19-sovga-ikonkasi.sql` | Har bir sovg'aga ikonka tanlash |
| `20-umumiy-hamyon.sql` | Bitta tanga hamyoni, kod bilan qo'shilish, o'quvchi do'koni |
| `21-guruhlarni-birlashtirish.sql` | Onlayn va offline guruh bitta bo'ldi; ball qoidasi soddalashdi |
| `22-oquvchi-guruhi.sql` | O'quvchi o'z ballari, tarixi, o'rni va guruh reytingini ko'radi |
| `23-haftalik-takrorlash.sql` | Takrorlash haftada bir marta; to'g'ri yechilgan savol yopiladi |
| `24-bitta-kod.sql` | Guruhning ikkala yarmi bitta qo'shilish kodiga ega bo'ldi |
| `25-uy-vazifasi-reytingsiz.sql` | Uy vazifasi urinishi umumiy reytingga kirmaydi |
| `26-vazifa-balli.sql` | Onlayn vazifa guruh balliga qo'shiladi; vazifaga katalog testi ham beriladi |
| `27-testni-ochirish.sql` | Test o'chirilsa natijasi, reyting balli va takrorlashdagi savoli ham ketadi |
| `28-dars-testlari.sql` | Bitta darsga bir nechta test; keyingi dars ularning o'rtachasi 90% da ochiladi |
| `29-dokon-guruh-uchun.sql` | Do'kon va tanga faqat guruh o'quvchilari uchun |
| `30-tozalash.sql` | Bazani chiqindidan tozalash va hajm hisoboti (admin panelda tugmasi bor) |
| `31-muqova-rasmlari.sql` | Darslik muqovasini admin paneldan fayl sifatida yuklash |
| `32-tanga-hisobi.sql` | Tanga har bir darsdan emas, jami balldan hisoblanadi |
| `33-misol-videolari.sql` | TOP kitobda har bir misolning o'z videoyechimi |
| `34-test-mavzulari.sql` | Katalogga mavzu qatlami: yo'nalish → bo'lim → mavzu → test. Bepul qoidasi: birinchi bo'limning birinchi mavzusi |
| `35-mavzu-bepul.sql` | Mavzuni qo'lda bepul qilish. Bepullik har doim test darajasida hal bo'ladi — Premium bo'lim ichidagi bepul mavzu ham ochiq |
| `36-videodars-bepul.sql` | Videodarsni qo'lda bepul qilish (`lessons.is_free`). Admin panelda "Bepul qilish" tugmasi paydo bo'ldi |
| `37-mustaqil-ish.sql` | Ballsiz "Mustaqil ishlang" savoli (`question_blocks.block_type = self_study`) va uning videoyechimi (`question_blocks.solution_video_url`) |

## Alohida: tozalash

`tozalash-guruhlar.sql` — migratsiya **emas**. U barcha guruhlarni,
o'quvchilarni, darslarni, ballarni, uy vazifalarini va sovg'alarni
o'chiradi. Faqat noldan boshlamoqchi bo'lganingizda, bilib turib
ishga tushiring. Test natijalari (`attempts`) saqlanadi.

## Vaqti-vaqti bilan

Oyda bir marta **Admin panel → Texnik xizmat** bo'limiga kirib
"Tozalash" tugmasini bosing. U bazadagi chiqindini yig'ishtiradi
va nima o'chirilganini ko'rsatadi. O'sha yerda qaysi jadval
qancha joy egallayotgani ham chiqadi.

Xohlasangiz SQL Editor'dan ham chaqirsa bo'ladi:

```sql
select * from public.platform_cleanup(90);   -- 90 kundan eskisi
select * from public.platform_storage_report();
```

Natijalar, testlar, darslar, guruh ballari va sovg'a tarixiga
tegilmaydi — faqat qoralama, yopilgan sessiya, tashlab ketilgan
urinish va yopilgan takrorlash yozuvlari o'chadi.

## Tekshirish

```
npm run test:sql
```

Haqiqiy PostgreSQL (PGlite) ishga tushiriladi va shu fayllar unga
qo'llanadi. PGlite o'rnatilmagan bo'lsa test xatosiz o'tkazib
yuboriladi:

```
npm i -D @electric-sql/pglite
```
