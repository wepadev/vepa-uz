-- =====================================================================
--  6-fayl: "Guruhlar uchun maxsus testlar" yo'nalishi
--
--  Maqsad: guruhlarga uy vazifasi qilib beriladigan testlar alohida
--  yo'nalishda tursin. Ular test katalogida o'quvchiga ko'rinmaydi —
--  faqat vazifa berilganda ochiladi.
--
--  Supabase → SQL Editor → Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. `code` ustunidagi CHECK cheklovini bo'shatamiz
--
--    Jadval yaratilganda code faqat 'attestatsiya' | 'milliy-sertifikat'
--    | 'sat' bo'lishi mumkin deb belgilangan. Yangi yo'nalish qo'shish
--    uchun cheklovni olib turamiz — 5-qadamda yana tiklanadi.
-- ---------------------------------------------------------------------
alter table public.test_exam_types
  drop constraint if exists test_exam_types_code_check;

-- ---------------------------------------------------------------------
-- 1. Yo'nalishning o'zi
--
--    is_published = false — bu yerda ataylab. Foydalanuvchi tomonidagi
--    barcha sahifalar (/tests, /tests/sections, /tests/list) yo'nalishni
--    aynan shu ustun bo'yicha filtrlaydi. Demak yo'nalish yopiq turganda
--    o'quvchi uni ko'rmaydi, admin panelda esa hammasi ochiq ishlaydi.
--
--    DIQQAT: bu qatorni nashr qilmang. Nashr qilinsa, guruh testlari
--    umumiy katalogda paydo bo'ladi.
-- ---------------------------------------------------------------------
insert into public.test_exam_types (
  code,
  title,
  description,
  order_number,
  is_published
)
select
  'guruh-testlari',
  'Guruhlar uchun maxsus testlar',
  'Faqat uy vazifasi sifatida beriladigan testlar. Katalogda ko''rinmaydi.',
  coalesce(
    (select max(order_number) from public.test_exam_types),
    0
  ) + 1,
  false
where not exists (
  select 1
  from public.test_exam_types
  where code = 'guruh-testlari'
);

-- Nom va tavsif har doim to'g'ri tursin, nashr holati esa doim yopiq
update public.test_exam_types
set
  title       = 'Guruhlar uchun maxsus testlar',
  description = 'Faqat uy vazifasi sifatida beriladigan testlar. Katalogda ko''rinmaydi.',
  is_published = false
where code = 'guruh-testlari';

-- ---------------------------------------------------------------------
-- 1b. CHECK cheklovini qaytaramiz
--
--     Ro'yxatni qo'lda yozmaymiz — jadvalda hozir turgan kodlardan
--     yig'amiz. Shu tufayli sizda qanday yo'nalishlar bo'lsa,
--     hammasi saqlanib qoladi.
-- ---------------------------------------------------------------------
do $$
declare
  v_list text;
begin
  select string_agg(quote_literal(code), ', ' order by code)
  into v_list
  from (
    select distinct code
    from public.test_exam_types
    where code is not null
  ) s;

  if v_list is null then
    return;  -- jadval bo'sh, cheklov kerak emas
  end if;

  execute format(
    'alter table public.test_exam_types
       add constraint test_exam_types_code_check
       check (code in (%s))',
    v_list
  );
end $$;

-- ---------------------------------------------------------------------
-- 2. O'qituvchi yopiq yo'nalishni ko'ra olsin
--
--    Agar test_exam_types jadvalida RLS yoqilgan bo'lsa va faqat
--    nashr qilinganlarni o'qishga ruxsat bergan bo'lsa, admin panel
--    yangi yo'nalishni ko'ra olmaydi. Quyidagi siyosat shuni ochadi.
--    Siyosat allaqachon bo'lsa — hech narsa o'zgarmaydi.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'test_exam_types'
      and policyname = 'test_exam_types_teacher_read'
  ) then
    create policy test_exam_types_teacher_read
      on public.test_exam_types
      for select
      to authenticated
      using (public.is_teacher());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Test shu yopiq yo'nalishga tegishlimi?
--
--    Test yechish sahifasi shu funksiya orqali tekshiradi: agar test
--    guruh yo'nalishiga tegishli bo'lsa, uni faqat vazifa havolasi
--    bilan ochish mumkin. To'g'ridan-to'g'ri manzil yozib kirib
--    bo'lmaydi.
--
--    security definer — chunki o'quvchi yopiq yo'nalish qatorini
--    o'qiy olmasligi mumkin, lekin tekshiruv baribir ishlashi shart.
-- ---------------------------------------------------------------------
create or replace function public.is_group_only_test(p_test_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tests t
    join public.test_sections   s on s.id = t.section_id
    join public.test_exam_types e on e.id = s.exam_type_id
    where t.id = p_test_id
      and e.code = 'guruh-testlari'
  );
$$;

-- ---------------------------------------------------------------------
-- 4. Guruhga vazifa berish uchun testlar ro'yxati
--
--    Guruh sahifasidagi "Test" ro'yxati shu funksiyadan to'ladi —
--    ya'ni faqat guruh yo'nalishidagi nashr qilingan testlar.
-- ---------------------------------------------------------------------
create or replace function public.group_test_options()
returns table (
  test_id        bigint,
  test_title     text,
  section_title  text,
  question_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id::bigint,
    t.title::text,
    s.title::text,
    (
      select count(*)::int
      from public.questions q
      where q.test_id = t.id
    )
  from public.tests t
  join public.test_sections   s on s.id = t.section_id
  join public.test_exam_types e on e.id = s.exam_type_id
  where e.code = 'guruh-testlari'
    and t.is_published = true
    and public.is_teacher()
  order by
    s.order_number asc,
    s.id asc,
    t.order_number asc,
    t.id asc;
$$;

grant execute on function public.is_group_only_test(bigint) to authenticated;
grant execute on function public.group_test_options()       to authenticated;
