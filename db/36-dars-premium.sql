-- =====================================================================
--  36-fayl: videodarslar sukut bo'yicha Premium
--
--  QOIDA: har bir videodars Premium. Faqat admin qo'lda belgilagan
--  darslar bepul (`lessons.is_free = true`). Sayt ham shunday
--  tekshiradi: `is_free` aniq true bo'lmasa, dars Premium.
--
--  Bu fayl qoidani bazada ham qulflaydi: yangi dars `is_free`siz
--  qo'shilsa ham o'z-o'zidan bepul bo'lib qolmaydi. Mavjud bepul
--  darslarga tegilmaydi — faqat bo'sh (null) qiymat false bo'ladi,
--  sayt uni avval ham Premium deb ko'rardi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

alter table public.lessons
  add column if not exists is_free boolean not null default false;

update public.lessons
set is_free = false
where is_free is null;

alter table public.lessons
  alter column is_free set default false,
  alter column is_free set not null;

comment on column public.lessons.is_free is
  'Qo''lda qo''yilgan bepullik. Sukut bo''yicha false — dars Premium.';

-- ---------------------------------------------------------------------
--  Tekshirish (ixtiyoriy): qaysi darslar hozir bepul?
--
--  select c.title as bolim, l.order_number, l.title, l.is_free
--  from public.lessons l
--  join public.lesson_categories c on c.id = l.category_id
--  order by c.id, l.order_number;
-- ---------------------------------------------------------------------
