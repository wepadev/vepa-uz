-- =====================================================================
--  34-fayl: test katalogiga "mavzu" qatlami
--
--  ILGARI:  yo'nalish -> bo'lim -> test
--  ENDI:    yo'nalish -> bo'lim -> mavzu -> test
--
--  Sabab: bo'lim katta birlik ("Algebra", "Geometriya"). Uning ichida
--  o'nlab test turardi va o'quvchi kerakli mavzuni topolmasdi. Endi
--  bo'lim ichida mavzular, mavzu ichida testlar bo'ladi.
--
--  BEPUL / PREMIUM qoidasi ham shu yerda o'zgaradi:
--    - eski qoida: har bir yo'nalishning birinchi bo'limidagi
--      DASTLABKI 3 TA test bepul edi;
--    - yangi qoida: birinchi bo'limning BIRINCHI MAVZUSIDAGI hamma
--      test bepul, qolgan mavzular ham, qolgan bo'limlar ham Premium.
--
--  O'zgarmaydigan narsalar:
--    - uy vazifasi (guruh) testlari doim bepul (10-fayl);
--    - admin bitta testni qo'lda bepul qilib qo'ysa, u bepul qoladi
--      (`tests.is_free`);
--    - mavjud testlar o'chirilmaydi — har bir bo'limda "Umumiy"
--      nomli mavzu yaratilib, ichiga solinadi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  33-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mavzular jadvali
--
--    Tuzilishi `test_sections` bilan ataylab bir xil: sarlavha,
--    tavsif, tartib raqami, nashr holati. Admin panel ikkalasini
--    bir xil boshqaradi, o'rganish kerak bo'lmaydi.
-- ---------------------------------------------------------------------
create table if not exists public.test_topics (
  id           bigint generated always as identity primary key,
  section_id   bigint  not null references public.test_sections(id) on delete cascade,
  title        text    not null,
  description  text,
  order_number integer not null default 1,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.test_topics is
  'Bo''lim ichidagi mavzu. Testlar shu mavzuga biriktiriladi.';

create index if not exists test_topics_section_idx
  on public.test_topics (section_id, order_number, id);

-- ---------------------------------------------------------------------
-- 2. Test endi mavzuga biriktiriladi
--
--    `section_id` ataylab joyida qoldirildi va o'chirilmadi:
--    - uy vazifasi testlari mavzusiz ishlaydi;
--    - mavjud so'rovlar, hisobotlar va `is_group_only_test()`
--      buzilmaydi.
--    Mavzu o'chirilsa test yo'qolmaydi, shunchaki mavzusiz qoladi —
--    shuning uchun `set null`, `cascade` emas.
-- ---------------------------------------------------------------------
alter table public.tests
  add column if not exists topic_id bigint
  references public.test_topics(id) on delete set null;

create index if not exists tests_topic_idx
  on public.tests (topic_id, order_number, id);

-- ---------------------------------------------------------------------
-- 3. Mavjud testlarni "Umumiy" mavzusiga ko'chirish
--
--    Hech narsa o'chirilmaydi va hech narsa yo'qolmaydi. Testi bor
--    har bir bo'limda bitta "Umumiy" mavzu paydo bo'ladi. Keyin admin
--    panelda yangi mavzular ochib, testlarni ko'chirib chiqasiz.
--
--    Ikki marta Run qilinsa ikkinchi "Umumiy" yaratilmaydi: avval
--    shu nomli mavzu bor-yo'qligi tekshiriladi.
-- ---------------------------------------------------------------------
insert into public.test_topics (section_id, title, description, order_number, is_published)
select
  s.id,
  'Umumiy',
  'Mavzular bo''lingunicha barcha testlar shu yerda turadi.',
  1,
  true
from public.test_sections s
where exists (
    select 1 from public.tests t
    where t.section_id = s.id and t.topic_id is null
  )
  and not exists (
    select 1 from public.test_topics tp
    where tp.section_id = s.id and tp.title = 'Umumiy'
  );

update public.tests t
set topic_id = tp.id
from public.test_topics tp
where tp.section_id = t.section_id
  and tp.title = 'Umumiy'
  and t.topic_id is null;

-- ---------------------------------------------------------------------
-- 4. Ruxsatlar
--
--    O'qish: nashr qilingan mavzuni hamma ko'radi, qoralamani faqat
--    o'qituvchi. Yozish: faqat o'qituvchi.
-- ---------------------------------------------------------------------
alter table public.test_topics enable row level security;

drop policy if exists test_topics_read    on public.test_topics;
drop policy if exists test_topics_teacher on public.test_topics;

create policy test_topics_read
  on public.test_topics
  for select
  to authenticated
  using (is_published or public.is_teacher());

create policy test_topics_teacher
  on public.test_topics
  for all
  to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

grant select on public.test_topics to authenticated;
grant insert, update, delete on public.test_topics to authenticated;

-- ---------------------------------------------------------------------
-- 5. Bepul mavzu qaysi
--
--    Yo'nalishning birinchi nashr qilingan bo'limi, uning birinchi
--    nashr qilingan mavzusi. Tartib `order_number`, teng bo'lsa `id`
--    bo'yicha — sayt ham xuddi shunday saralaydi.
--
--    Funksiya alohida ajratildi: admin paneli ham, o'quvchi sahifasi
--    ham, testga kirish tekshiruvi ham shu bitta manbadan o'qiydi.
--    Qoida ikki joyda ikki xil bo'lib qolmaydi.
-- ---------------------------------------------------------------------
create or replace function public.free_topic_id(p_exam_type_id bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select tp.id
  from public.test_sections s
  join public.test_topics tp on tp.section_id = s.id
  where s.exam_type_id = p_exam_type_id
    and s.is_published
    and tp.is_published
    and s.id = (
      select s2.id
      from public.test_sections s2
      where s2.exam_type_id = p_exam_type_id
        and s2.is_published
      order by s2.order_number, s2.id
      limit 1
    )
  order by tp.order_number, tp.id
  limit 1;
$$;

grant execute on function public.free_topic_id(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Test bepulmi — yagona manba
--
--    Testga kirish huquqi `math_booster_can_access_test()` da hal
--    bo'ladi va u bepullikni aynan `math_booster_is_test_free()` dan
--    so'raydi. Demak qoidani almashtirish uchun shu bitta funksiyani
--    qayta yozish kifoya — kirish tekshiruviga, test boshlash
--    funksiyasiga va RLS siyosatlariga tegilmaydi.
--
--    Yangi qoida bo'yicha test uch sabab bilan bepul bo'ladi:
--      1) uy vazifasi (guruh) testi — doim bepul, 10-fayl;
--      2) admin qo'lda bepul qilib qo'ygan — `tests.is_free`;
--      3) bepul mavzuga tegishli — 5-qadamdagi qoida.
--    Eski "dastlabki 3 ta test" qoidasi shu bilan yo'qoladi.
--
--    Argument nomi `format()` orqali bazadagi hozirgi nomdan olinadi.
--    `create or replace` argument nomini o'zgartirishga ruxsat
--    bermaydi, shuning uchun uni taxmin qilib yozmaymiz.
-- ---------------------------------------------------------------------
do $do$
declare
  v_arg text;
  v_sql text;
begin
  select p.proargnames[1]
  into v_arg
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'math_booster_is_test_free'
  limit 1;

  v_sql := format($fmt$
    create or replace function public.math_booster_is_test_free(%1$I bigint)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $body$
      select coalesce(
        public.is_group_only_test(%1$I)
        or exists (
          select 1
          from public.tests t
          where t.id = %1$I
            and t.is_free
        )
        or exists (
          select 1
          from public.tests t
          join public.test_sections s on s.id = t.section_id
          where t.id = %1$I
            and t.topic_id is not null
            and t.topic_id = public.free_topic_id(s.exam_type_id)
        ),
        false
      );
    $body$;
  $fmt$, coalesce(v_arg, 'p_test_id'));

  begin
    execute v_sql;
  exception
    when others then
      /*
       * Eski funksiyaning argument nomi boshqacha bo'lsa
       * `create or replace` ruxsat bermaydi. Bunday holda eskisini
       * olib tashlab, yangisini yozamiz.
       *
       * Agar bu qadam ham xato bersa ("cannot drop ... other objects
       * depend on it"), demak funksiyaga RLS siyosati bog'langan —
       * xato matnini menga ko'rsating, qo'lda yechamiz.
       */
      execute 'drop function if exists public.math_booster_is_test_free(bigint)';
      execute v_sql;
  end;
end
$do$;

grant execute on function public.math_booster_is_test_free(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Tekshirish
--
--    Migratsiyadan keyin shuni Run qilsangiz, qaysi test bepul
--    bo'lib qolganini ko'rasiz. Ro'yxatda faqat birinchi bo'limning
--    birinchi mavzusidagi testlar va qo'lda bepul qilinganlar
--    turishi kerak (guruh testlari bundan tashqari).
--
--    select e.title as yonalish,
--           s.title as bolim,
--           tp.title as mavzu,
--           t.title as test,
--           t.is_free as qolda_bepul,
--           public.math_booster_is_test_free(t.id) as bepul
--    from public.tests t
--    join public.test_sections s on s.id = t.section_id
--    join public.test_exam_types e on e.id = s.exam_type_id
--    left join public.test_topics tp on tp.id = t.topic_id
--    where e.code <> 'guruh-testlari'
--    order by e.order_number, s.order_number, tp.order_number, t.order_number;
-- ---------------------------------------------------------------------
