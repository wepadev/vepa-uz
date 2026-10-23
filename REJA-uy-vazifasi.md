# Uy vazifasi tizimi — reja

vepa.uz ga guruh (sinf) va uy vazifasi funksiyasini qo'shish.
Eski Netlify sayti shundan keyin yopiladi.

## Nima uchun vepa.uz ichida

Eski sayt boshqa Supabase loyihasida ishlaydi. Havola bersak, o'quvchi
ikkinchi marta ro'yxatdan o'tishi kerak bo'ladi — ko'pchilik shu yerda
to'xtaydi. Bundan tashqari ikkita admin panel, ikkita natijalar tarixi
va ikkiga bo'lingan reyting paydo bo'ladi.

vepa.uz da kerakli mexanizmning katta qismi tayyor: savollar, javob
kalitlari, urinishlar (`attempts`), har bir javob (`user_answers`),
natija tahlili sahifasi, taymer. Yetishmayotgani — **guruh** va
**topshiriq** tushunchalari.

---

## 1. Ma'lumotlar bazasi

Uchta yangi jadval va mavjud jadvalga bitta ustun.

### `groups` — guruh yoki sinf

| Ustun | Izoh |
|---|---|
| `id` | |
| `title` | "7-A sinf", "Kechki to'garak" |
| `join_code` | 6 belgili kod, o'quvchi shu bilan qo'shiladi |
| `created_by` | o'qituvchi |
| `is_active` | |
| `created_at` | |

### `group_members` — kim qaysi guruhda

| Ustun | Izoh |
|---|---|
| `group_id` | |
| `user_id` | |
| `joined_at` | |

### `assignments` — uy vazifasi

| Ustun | Izoh |
|---|---|
| `id` | |
| `group_id` | qaysi guruhga |
| `test_id` | mavjud testlardan biri |
| `due_at` | muddat |
| `is_active` | |
| `created_at` | |

### `attempts` jadvaliga

`assignment_id` ustuni qo'shiladi (bo'sh bo'lishi mumkin). Shu orqali
"bu urinish qaysi vazifaga tegishli" degan savolga javob beriladi.
Mavjud natijalarga ta'sir qilmaydi.

**Xavfsizlik:** o'quvchi faqat o'zi a'zo bo'lgan guruhning vazifasini
ko'radi va faqat o'z natijasini oladi. Bu RLS qoidalari bilan
ta'minlanadi — hozirgi testlar tizimidagi kabi.

---

## 2. Sizning ekranlaringiz

### `/admin/groups`

Guruhlar ro'yxati. Har birida: nomi, a'zolar soni, faol vazifalar soni.
"Yangi guruh" tugmasi — nom yozasiz, tizim qo'shilish kodini yaratadi.

### `/admin/groups/view?groupId=...`

- **Qo'shilish kodi** katta qilib ko'rsatiladi — doskaga yozasiz yoki
  Telegram guruhga tashlaysiz
- **A'zolar** ro'yxati, kerak bo'lsa chiqarib yuborish
- **Vazifa berish** — mavjud testlardan birini tanlaysiz, muddat
  qo'yasiz, tamom
- Guruhning oldingi vazifalari ro'yxati

### `/admin/assignments/view?id=...`

Bu — eng qimmatli ekran.

**Kim ishladi, kim ishlamadi.** Har bir o'quvchi qatorida: ishladimi,
qachon, necha foiz. Ishlamaganlar alohida ajratib ko'rsatiladi.

**Sinf bo'yicha savol tahlili.** Har bir savol uchun necha foiz sinf
to'g'ri javob bergani. Eng ko'p xato qilingan savollar tepada.
Keyingi darsda nimani takrorlash kerakligi shu yerdan ko'rinadi.

---

## 3. O'quvchi ekranlari

### `/homework` — "Uy vazifalarim"

Guruhga a'zo bo'lmagan o'quvchi: **kod kiritish** oynasi.

A'zo bo'lgan o'quvchi:
- **Faol vazifalar** — nomi, muddati, "qoldi: 2 kun". Muddat yaqin
  bo'lsa sariq, o'tib ketgan bo'lsa qizil
- **Bajarilganlar** — natijasi bilan, "Tahlilni ko'rish" havolasi

Vazifani ochganda oddiy test ekrani ishlaydi — hozirgi test tizimi,
hech narsa yangidan yozilmaydi.

### Navigatsiya

Pastki tab bar'dagi "Menyu" ichiga "Uy vazifalarim" qo'shiladi.
Faol vazifa bo'lsa, yonida raqamli belgi chiqadi.

---

## 4. Bosqichlar

| Bosqich | Nima bo'ladi |
|---|---|
| 1 | Baza (SQL), guruh yaratish, kod bilan qo'shilish |
| 2 | Vazifa berish va o'quvchidagi "Uy vazifalarim" |
| 3 | Natijalar jadvali va sinf bo'yicha savol tahlili |
| 4 | Eski saytdagi testlarni ko'chirish, saytni yopish |

Har bosqichdan keyin sinab ko'rasiz, keyin keyingisiga o'tamiz.

---

## 5. Eski saytni yopish

Undagi testlarni import skripti orqali vepa.uz ga o'tkazamiz.
Keyin Netlify saytini vepa.uz ga yo'naltirasiz — eski havolani
biladigan o'quvchilar avtomatik yangi joyga tushadi.

Eski Supabase loyihasini darhol o'chirmang. Bir-ikki oy tursin,
kerakli ma'lumot qolib ketmaganiga ishonch hosil qilgach o'chirasiz.

---

## Hal qilinmagan savollar

**O'quvchi bir vazifani necha marta ishlay oladi?** Eski saytda bir
marta edi. Uy vazifasi uchun ham bitta urinish mantiqiy, lekin
mashq uchun cheksiz ham bo'lishi mumkin.

**Muddat o'tgach nima bo'ladi?** Vazifa yopiladimi yoki kech
topshirish mumkinmi (kech deb belgilanib)?

**Premium bilan bog'liqmi?** Uy vazifasi sizning o'quvchilaringiz
uchun — Premium talab qilinmasligi mantiqiy.
