-- =====================================================================
--  40-fayl: "faqat uy vazifasi" tekşiruvi tuzatildi
--
--  MUAMMO
--
--  26-faylda `is_group_only_test()` ning ma'nosi özgartirilgan edi:
--  "bu testni vazifa qilib berib böladimi" (nashr qilingan va dars
--  testi emas). Lekin funksiya nomi va uni çaqiradigan joylar eski
--  ma'noda — "bu test FAQAT uy vazifasi sifatida oçiladi" — qolgan.
--  Natijada:
--
--    · sayt Testlar bölimidagi har bir testni "faqat uy vazifasi"
--      deb hisoblab, oçmasdan /homework ga qaytarardi;
--    · `math_booster_is_test_free()` "uy vazifasi testi bepul" degan
--      qoida orqali hamma katalog testini BEPUL deb hisoblardi —
--      ya'ni Premium himoyasi bazada işlamay qolgan edi.
--
--  YEÇIM
--
--    1. `is_group_only_test()` yana asl ma'nosiga qaytadi: test
--       "Guruhlar uçun maxsus testlar" yönalişida.
--    2. "Vazifaga berib böladimi" savoli uçun alohida funksiya:
--       `is_assignable_test()` (admin panel şuni çaqiradi).
--    3. Bepullik qoidasiga yangi band: öquvçining öz guruhiga vazifa
--       qilib berilgan test unga oçiq (Premium bölmasa ham).
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tuşiriş xavfsiz.
--  39-fayldan keyin işlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Faqat uy vazifasi sifatida oçiladigan test
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
      and not exists (
        select 1 from public.lesson_tests lt where lt.test_id = t.id
      )
  );
$$;

grant execute on function public.is_group_only_test(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Vazifa qilib berib böladigan test (26-fayldagi ma'no)
-- ---------------------------------------------------------------------
create or replace function public.is_assignable_test(p_test_id bigint)
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

grant execute on function public.is_assignable_test(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Menga vazifa qilib berilganmi
--
--    Katalogdagi Premium test guruhga vazifa qilib berilsa, bepul
--    tarifdagi öquvçi ham uni işlay olişi kerak.
-- ---------------------------------------------------------------------
create or replace function public.is_assigned_to_me(p_test_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    join public.study_group_members m on m.group_id = a.group_id
    where a.test_id = p_test_id
      and a.is_active = true
      and m.user_id = auth.uid()
  );
$$;

grant execute on function public.is_assigned_to_me(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Bepullik qoidasi (35-fayldagi bilan bir xil + 5-band)
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
        -- 1) guruh (uy vazifasi) testi
        public.is_group_only_test(%1$I)
        -- 2) testning özi qölda bepul qilingan
        or exists (
          select 1
          from public.tests t
          where t.id = %1$I
            and t.is_free
        )
        -- 3) mavzusi qölda bepul qilingan
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
        )
        -- 5) öquvçining guruhiga vazifa qilib berilgan
        or public.is_assigned_to_me(%1$I),
        false
      );
    $body$;
  $fmt$, coalesce(v_arg, 'p_test_id'));

  begin
    execute v_sql;
  exception
    when others then
      execute 'drop function if exists public.math_booster_is_test_free(bigint)';
      execute v_sql;
  end;
end
$do$;

grant execute on function public.math_booster_is_test_free(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Tekşiriş
--
--    Katalog testlari endi "faqat vazifa" emas va Premium qoidasiga
--    böysunadi:
--
--    select t.id, t.title,
--           public.is_group_only_test(t.id)       as faqat_vazifa,
--           public.is_assignable_test(t.id)       as vazifaga_bolar,
--           public.math_booster_is_test_free(t.id) as bepul
--    from public.tests t
--    where t.is_published
--    order by t.id
--    limit 30;
-- ---------------------------------------------------------------------
