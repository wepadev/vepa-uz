-- =====================================================================
--  5-fayl: vazifani qayta ochish, savol tahlili, SAT uslubidagi javoblar
--  Supabase → SQL Editor → Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vazifani bitta o'quvchi uchun qayta ochish
--
--    Urinish o'chirilmaydi — u o'quvchining natijalar tarixida qoladi,
--    faqat vazifadan uziladi. Shu tufayli o'quvchi qayta ishlay oladi,
--    lekin eski natija ham yo'qolmaydi.
-- ---------------------------------------------------------------------
create or replace function public.reopen_assignment_for_student(
  p_assignment_id bigint,
  p_user_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_teacher() then
    raise exception 'Bu amal faqat o''qituvchi uchun.';
  end if;

  update public.attempts
  set assignment_id = null
  where assignment_id = p_assignment_id
    and user_id = p_user_id;

  -- Ochiq qolgan sessiyani ham tozalaymiz
  update public.test_sessions s
  set submitted_at = coalesce(s.submitted_at, now())
  where s.user_id = p_user_id
    and s.submitted_at is null
    and s.test_id = (
      select test_id from public.assignments where id = p_assignment_id
    );
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Guruh bo'yicha savol tahlili
--
--    Har bir savol uchun: nechta o'quvchi to'g'ri javob bergani va foizi.
--    Eng ko'p xato qilingan savollar tepada chiqadi.
-- ---------------------------------------------------------------------
create or replace function public.assignment_question_stats(
  p_assignment_id bigint
)
returns table (
  question_id     bigint,
  order_number    integer,
  question_text   text,
  part_label      text,
  correct_answer  text,
  answered_count  integer,
  correct_count   integer,
  correct_percent numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id::bigint,
    q.order_number::integer,
    q.question_text::text,
    q.part_label::text,
    ak.correct_answer::text,
    count(ua.id)::int,
    count(ua.id) filter (where ua.is_correct)::int,
    case
      when count(ua.id) > 0
        then round(
          count(ua.id) filter (where ua.is_correct)::numeric
          / count(ua.id)::numeric * 100,
          0
        )
      else 0
    end
  from public.assignments a
  join public.questions q       on q.test_id = a.test_id
  left join public.answer_keys ak on ak.question_id = q.id
  left join public.attempts att on att.assignment_id = a.id
  left join public.user_answers ua
         on ua.question_id = q.id
        and ua.attempt_id = att.id
  where a.id = p_assignment_id
    and public.is_teacher()
  group by q.id, q.order_number, q.question_text, q.part_label, ak.correct_answer
  order by
    case when count(ua.id) > 0
      then count(ua.id) filter (where ua.is_correct)::numeric / count(ua.id)::numeric
      else 1
    end asc,
    q.order_number asc;
$$;

-- ---------------------------------------------------------------------
-- 3. SAT uslubidagi javob qabul qilish
--
--    SAT da yozma javob turli ko'rinishda yozilishi mumkin:
--      0.5  ·  0,5  ·  .5  ·  1/2
--    Bu funksiya bitta javobdan shunday muqobillarni yasab,
--    javob kalitiga qo'shadi.
-- ---------------------------------------------------------------------
create or replace function public.answer_variants(p_answer text)
returns text[]
language plpgsql
immutable
as $$
declare
  v_clean text;
  v_dot   text;
  v_num   numeric;
  v_out   text[] := '{}';
begin
  if p_answer is null then
    return v_out;
  end if;

  -- Bo'shliqlarni olib tashlaymiz
  v_clean := regexp_replace(btrim(p_answer), '\s+', '', 'g');

  if v_clean = '' then
    return v_out;
  end if;

  v_out := array[v_clean];

  -- Vergul ↔ nuqta
  v_dot := replace(v_clean, ',', '.');
  v_out := v_out || v_dot;
  v_out := v_out || replace(v_clean, '.', ',');

  -- Son bo'lsa: 0.5 / .5 / 0,5 / ,5
  begin
    v_num := v_dot::numeric;

    v_out := v_out || trim(trailing '.' from trim(trailing '0' from v_dot));
    v_out := v_out || v_num::text;
    v_out := v_out || replace(v_num::text, '.', ',');

    -- 0.5 → .5
    if v_dot like '0.%' then
      v_out := v_out || substring(v_dot from 2);
      v_out := v_out || replace(substring(v_dot from 2), '.', ',');
    end if;

    -- .5 → 0.5
    if v_dot like '.%' then
      v_out := v_out || ('0' || v_dot);
      v_out := v_out || replace('0' || v_dot, '.', ',');
    end if;
  exception when others then
    null;  -- son emas, muammo yo'q
  end;

  -- Takrorlarni va bo'shlarni olib tashlaymiz
  return array(
    select distinct value
    from unnest(v_out) as value
    where value is not null and btrim(value) <> ''
  );
end;
$$;

-- Kalitga javobni SAT uslubida (barcha muqobillari bilan) qo'shadi
create or replace function public.add_accepted_answer_smart(
  p_question_id bigint,
  p_answer text
)
returns text[]
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_result text[];
begin
  if not public.is_teacher() then
    raise exception 'Bu amal faqat o''qituvchi uchun.';
  end if;

  update public.answer_keys
  set accepted_answers = array(
    select distinct value
    from unnest(
      coalesce(accepted_answers, '{}'::text[])
      || public.answer_variants(p_answer)
    ) as value
  )
  where question_id = p_question_id
  returning accepted_answers into v_result;

  if v_result is null then
    raise exception 'Bu savol uchun javob kaliti topilmadi.';
  end if;

  return v_result;
end;
$$;

grant execute on function public.reopen_assignment_for_student(bigint, uuid) to authenticated;
grant execute on function public.assignment_question_stats(bigint)           to authenticated;
grant execute on function public.answer_variants(text)                       to authenticated;
grant execute on function public.add_accepted_answer_smart(bigint, text)     to authenticated;
