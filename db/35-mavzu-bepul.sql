-- =====================================================================
--  35-fayl: mavzuni qo'lda bepul qilish
--
--  34-faylda bepullik ikki yo'l bilan kelardi: avtomatik qoida
--  (birinchi bo'limning birinchi mavzusi) va bitta testni qo'lda
--  bepul qilish (`tests.is_free`).
--
--  Orada bitta bo'shliq qoldi: butun mavzuni bepul qilish. Masalan
--  "Geometriya" bo'limi Premium bo'lsa ham, undagi bitta tanishtiruv
--  mavzusini ochiq qo'ymoqchi bo'lsangiz, har bir testni alohida
--  belgilash kerak edi.
--
--  QOIDA ENDI SHUNDAY (muhim):
--  Bepullik HAR DOIM TEST DARAJASIDA hal bo'ladi. Bo'lim yoki mavzu
--  "Premium" ko'rinishi uning ichidagi bepul testni YOPMAYDI.
--  Test ochiq bo'ladi, agar quyidagilardan BIRORTASI rost bo'lsa:
--      1) uy vazifasi (guruh) testi;
--      2) testning o'zi bepul   — `tests.is_free`;
--      3) mavzusi bepul         — `test_topics.is_free`  (yangi);
--      4) mavzusi avtomatik bepul mavzu — `free_topic_id()`.
--  Ya'ni Premium bo'lim ichidagi bepul mavzu ham, Premium mavzu
--  ichidagi bepul test ham o'quvchiga ochiq bo'ladi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  34-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mavzuga "bepul" belgisi
--
--    `tests.is_free` bilan bir xil ma'noda: avtomatik qoidadan
--    tashqaridagi istisno. Standart qiymati false — hech narsa
--    o'z-o'zidan bepul bo'lib qolmaydi.
-- ---------------------------------------------------------------------
alter table public.test_topics
  add column if not exists is_free boolean not null default false;

comment on column public.test_topics.is_free is
  'Qo''lda qo''yilgan bepullik: mavzudagi barcha testlar ochiq bo''ladi.';

-- ---------------------------------------------------------------------
-- 2. Bepullik qoidasini yangilaymiz
--
--    Testga kirish huquqi `math_booster_can_access_test()` da hal
--    bo'ladi va u bepullikni shu funksiyadan so'raydi. Shuning uchun
--    qoidani faqat shu yerda o'zgartiramiz — kirish tekshiruviga,
--    test boshlash funksiyasiga va RLS siyosatlariga tegilmaydi.
--
--    Argument nomi bazadagi hozirgi nomdan olinadi: `create or replace`
--    argument nomini o'zgartirishga ruxsat bermaydi.
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
        -- 1) uy vazifasi testi
        public.is_group_only_test(%1$I)
        -- 2) testning o'zi qo'lda bepul qilingan
        or exists (
          select 1
          from public.tests t
          where t.id = %1$I
            and t.is_free
        )
        -- 3) mavzusi qo'lda bepul qilingan
        or exists (
          select 1
          from public.tests t
          join public.test_topics tp on tp.id = t.topic_id
          where t.id = %1$I
            and tp.is_free
        )
        -- 4) mavzusi avtomatik bepul mavzu
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
       */
      execute 'drop function if exists public.math_booster_is_test_free(bigint)';
      execute v_sql;
  end;
end
$do$;

grant execute on function public.math_booster_is_test_free(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Tekshirish
--
--    Qaysi test bepul va NEGA bepul ekanini ko'rsatadi.
--
--    select e.title as yonalish,
--           s.title as bolim,
--           tp.title as mavzu,
--           t.title as test,
--           case
--             when t.is_free then 'test qo''lda bepul'
--             when tp.is_free then 'mavzu qo''lda bepul'
--             when t.topic_id = public.free_topic_id(s.exam_type_id)
--               then 'avtomatik birinchi mavzu'
--             else 'Premium'
--           end as sabab,
--           public.math_booster_is_test_free(t.id) as bepul
--    from public.tests t
--    join public.test_sections s on s.id = t.section_id
--    join public.test_exam_types e on e.id = s.exam_type_id
--    left join public.test_topics tp on tp.id = t.topic_id
--    where e.code <> 'guruh-testlari'
--    order by e.order_number, s.order_number, tp.order_number, t.order_number;
-- ---------------------------------------------------------------------
