-- =====================================================================
--  28-fayl: bitta darsga bir nechta test
--
--  ILGARI: darsga faqat bitta test biriktirilardi (`lessons.test_id`)
--  va keyingi dars o'sha bitta testdan 90% olinganda ochilardi.
--  Testsiz darslarda esa videoning 90% ini ko'rish talab qilinardi —
--  bu qoida chalg'itardi va tekshirib ham bo'lmasdi.
--
--  ENDI: darsga xohlagancha test biriktiriladi. Keyingi dars
--  ularning O'RTACHA natijasi 90% ga yetganda ochiladi. Ishlanmagan
--  test 0 deb hisoblanadi, ya'ni uchtadan ikkitasini a'lo ishlab
--  qo'yib yuborib bo'lmaydi.
--
--  `lessons.test_id` ustuni jadvalda qoladi, lekin endi
--  ishlatilmaydi: mavjud bog'lamlar yangi jadvalga ko'chiriladi va
--  ustun bo'shatiladi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  27-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Dars va test bog'lami
-- ---------------------------------------------------------------------
create table if not exists public.lesson_tests (
  lesson_id    bigint  not null references public.lessons(id) on delete cascade,
  test_id      bigint  not null references public.tests(id)   on delete cascade,
  order_number integer not null default 1,
  created_at   timestamptz not null default now(),
  primary key (lesson_id, test_id)
);

create index if not exists lesson_tests_test_idx
  on public.lesson_tests (test_id);

/*
 * O'qish hamma uchun ochiq: o'quvchi darsga qaysi testlar
 * biriktirilganini ko'rishi kerak. Yozish faqat o'qituvchiga.
 */
alter table public.lesson_tests enable row level security;

drop policy if exists lesson_tests_read    on public.lesson_tests;
drop policy if exists lesson_tests_teacher on public.lesson_tests;

create policy lesson_tests_read
  on public.lesson_tests
  for select
  to anon, authenticated
  using (true);

create policy lesson_tests_teacher
  on public.lesson_tests
  for all
  to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

grant select on public.lesson_tests to anon, authenticated;
grant insert, update, delete on public.lesson_tests to authenticated;

-- ---------------------------------------------------------------------
-- 2. Eski bog'lamlarni ko'chiramiz
-- ---------------------------------------------------------------------
insert into public.lesson_tests (lesson_id, test_id)
select l.id, l.test_id
from public.lessons l
where l.test_id is not null
on conflict do nothing;

update public.lessons
set test_id = null
where test_id is not null;

-- ---------------------------------------------------------------------
-- 3. "Dars testi" tekshiruvlari yangi jadvalga o'tadi
--
--    Darsga biriktirilgan test uy vazifasi ro'yxatida chiqmasligi
--    kerak — u dars ichida ishlanadi.
-- ---------------------------------------------------------------------
create or replace function public.assignable_tests()
returns table (
  test_id       bigint,
  test_title    text,
  section_title text,
  question_count integer,
  source        text
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
    (select count(*)::int from public.questions q where q.test_id = t.id),
    (case when e.code = 'guruh-testlari' then 'guruh' else 'katalog' end)::text
  from public.tests t
  join public.test_sections   s on s.id = t.section_id
  join public.test_exam_types e on e.id = s.exam_type_id
  where t.is_published = true
    and public.is_teacher()
    and (
      e.code = 'guruh-testlari'
      or (s.is_published = true and e.is_published = true)
    )
    and not exists (
      select 1 from public.lesson_tests lt where lt.test_id = t.id
    )
  order by
    (case when e.code = 'guruh-testlari' then 0 else 1 end),
    s.order_number asc,
    s.id asc,
    t.order_number asc,
    t.id asc;
$$;

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
    where t.id = p_test_id
      and t.is_published = true
      and not exists (
        select 1 from public.lesson_tests lt where lt.test_id = t.id
      )
  );
$$;

grant execute on function public.assignable_tests()          to authenticated;
grant execute on function public.is_group_only_test(bigint)  to authenticated;
