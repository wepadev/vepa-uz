-- =====================================================================
--  36-fayl: videodarsni qo'lda bepul qilish
--
--  Sayt kodi `lessons.is_free` ustuniga allaqachon tayanadi
--  (/lessons/category va /lessons/view shu ustunni o'qiydi), lekin
--  ustunni yaratadigan migratsiya `db/` papkasida yo'q edi — u
--  boshlang'ich sxemadan kelgan. Shu fayl bo'shliqni yopadi:
--  ustun bor bo'lsa hech narsa o'zgarmaydi, yo'q bo'lsa qo'shiladi.
--
--  QOIDA:
--  Videodars ochiq bo'ladi, agar quyidagilardan BIRORTASI rost bo'lsa:
--      1) foydalanuvchida amaldagi Premium obuna bor;
--      2) foydalanuvchi admin;
--      3) darsning o'zi qo'lda bepul qilingan — `lessons.is_free`.
--
--  KETMA-KETLIK: odatda keyingi dars oldingisining testi 90% ga
--  yetgandagina ochiladi. Qo'lda bepul qilingan dars esa bu
--  navbatdan TASHQARIDA turadi va hamisha ochiq bo'ladi — aks holda
--  unga yetib borish uchun avval Premium darslarni o'tish kerak
--  bo'lardi va bepulligining ma'nosi qolmasdi. Bepul darsni ochish
--  keyingi PULLIK darsni ochib yubormaydi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Darsga "bepul" belgisi
--
--    `tests.is_free` va `test_topics.is_free` bilan bir xil ma'noda:
--    qo'lda qo'yiladigan istisno. Standart qiymati false — hech bir
--    dars o'z-o'zidan bepul bo'lib qolmaydi.
-- ---------------------------------------------------------------------
alter table public.lessons
  add column if not exists is_free boolean not null default false;

comment on column public.lessons.is_free is
  'Qo''lda qo''yilgan bepullik: dars Premium obunasiz ham ochiq bo''ladi.';

-- ---------------------------------------------------------------------
-- 2. Eski yozuvlarda null qolmasin
--
--    Ustun ilgari null'ga ruxsat bilan yaratilgan bo'lsa, uni
--    to'g'rilaymiz. Ustun yo'q bo'lgan holatda 1-qadam uni allaqachon
--    "not null default false" qilib yaratgan, bu yer bekorga ishlaydi.
-- ---------------------------------------------------------------------
update public.lessons
set is_free = false
where is_free is null;

alter table public.lessons
  alter column is_free set default false;

alter table public.lessons
  alter column is_free set not null;

-- ---------------------------------------------------------------------
-- 3. Tezroq sanash uchun indeks
--
--    Admin paneldagi "Bepul: N ta" hisobi va o'quvchi sahifasidagi
--    filtrlar uchun. Darslar soni kam bo'lgani uchun bu majburiy emas,
--    lekin zarari ham yo'q.
-- ---------------------------------------------------------------------
create index if not exists lessons_is_free_idx
  on public.lessons (is_free)
  where is_free;

-- ---------------------------------------------------------------------
-- 4. Tekshirish
--
--    Qaysi dars bepul ekanini ko'rsatadi:
--
--    select c.order_number as bolim_raqami,
--           c.title        as bolim,
--           l.order_number as dars_raqami,
--           l.title        as dars,
--           l.is_published as nashr,
--           l.is_free      as bepul
--    from public.lessons l
--    join public.lesson_categories c on c.id = l.category_id
--    order by c.order_number, c.id, l.order_number, l.id;
-- ---------------------------------------------------------------------
