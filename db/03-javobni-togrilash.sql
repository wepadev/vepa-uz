-- =====================================================================
--  Javobni qo'lda to'g'rilash — o'qituvchi uchun
--
--  Supabase → SQL Editor → to'liq nusxalab Run bosing.
--  Qayta ishga tushirish xavfsiz.
--
--  Nima uchun kerak: o'quvchi yozma javobni "0,5" deb yozsa, kalitda
--  "0.5" tursa — tizim uni xato deb belgilaydi. Bu funksiya o'qituvchiga
--  bitta javobni to'g'ri (yoki xato) deb belgilash va ball, foizni
--  avtomatik qayta hisoblash imkonini beradi.
-- =====================================================================

create or replace function public.set_answer_correctness(
  p_attempt_id  uuid,
  p_question_id bigint,
  p_is_correct  boolean
)
returns table (
  score           integer,
  total_questions integer,
  percentage      numeric
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_score integer;
begin
  -- Faqat o'qituvchi
  if not public.is_teacher() then
    raise exception 'Bu amal faqat o''qituvchi uchun.';
  end if;

  -- Javob shu urinishga tegishlimi
  if not exists (
    select 1 from public.user_answers
    where attempt_id = p_attempt_id
      and question_id = p_question_id
  ) then
    raise exception 'Bu urinishda bunday savol topilmadi.';
  end if;

  update public.user_answers
  set is_correct = p_is_correct
  where attempt_id = p_attempt_id
    and question_id = p_question_id;

  -- Ball va foizni qayta hisoblaymiz
  select count(*) filter (where is_correct),
         count(*)
  into v_score, v_total
  from public.user_answers
  where attempt_id = p_attempt_id;

  -- total_questions urinishda saqlangan qiymatdan olinadi:
  -- o'quvchi javobsiz qoldirgan savollar ham hisobga kirishi kerak
  select coalesce(a.total_questions, v_total)
  into v_total
  from public.attempts a
  where a.id = p_attempt_id;

  update public.attempts
  set
    score = v_score,
    percentage = case
      when v_total > 0
        then round((v_score::numeric / v_total::numeric) * 100, 2)
      else 0
    end
  where id = p_attempt_id;

  return query
  select a.score, a.total_questions, a.percentage
  from public.attempts a
  where a.id = p_attempt_id;
end;
$$;

-- ---------------------------------------------------------------------
--  Javobni kalitga doimiy qo'shish
--
--  "0,5" ni shu savol uchun qabul qilinadigan javoblar ro'yxatiga
--  qo'shadi — keyingi o'quvchilarda avtomatik to'g'ri hisoblanadi.
-- ---------------------------------------------------------------------
create or replace function public.add_accepted_answer(
  p_question_id bigint,
  p_answer      text
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

  if p_answer is null or length(btrim(p_answer)) = 0 then
    raise exception 'Javob bo''sh bo''lishi mumkin emas.';
  end if;

  update public.answer_keys
  set accepted_answers = (
    select array_agg(distinct value)
    from unnest(
      coalesce(accepted_answers, '{}'::text[]) || btrim(p_answer)
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

grant execute on function public.set_answer_correctness(uuid, bigint, boolean) to authenticated;
grant execute on function public.add_accepted_answer(bigint, text)             to authenticated;
