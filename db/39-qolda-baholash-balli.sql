-- =====================================================================
--  39-fayl: qo'lda baholaganda ball 2 baravar kam chiqardi
--
--  MUAMMO: har savol 2 ball (submit_timed_test, close_abandoned_sessions),
--  `attempts.total_questions` da esa MAKSIMAL BALL turadi (12 savol → 24).
--  `set_answer_correctness` (03-fayl) ballni qayta hisoblaganda
--  to'g'ri javoblar SONINI yozardi: 12 ta to'g'ri → 12 / 24 = 50%.
--  Ya'ni o'qituvchi bitta javobni qo'lda o'zgartirsa ham, butun
--  urinishning bali ikki baravar kamayib qolardi.
--
--  YECHIM:
--    1. set_answer_correctness: ball = to'g'ri javoblar × 2.
--       Vazifa bali (online_coin_awards.points) ham yangi foizga
--       moslanadi. Tangaga tegilmaydi — o'quvchi sarflagan bo'lishi
--       mumkin (26-fayldagi qoida bilan bir xil).
--    2. Shu xato bilan buzilgan eski urinishlar qayta hisoblanadi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
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
  v_total   integer;
  v_correct integer;
  v_count   integer;
  v_score   integer;
begin
  -- Faqat o'qituvchi
  if not public.is_teacher() then
    raise exception 'Bu amal faqat o''qituvchi uchun.';
  end if;

  -- Javob shu urinishga tegishlimi
  if not exists (
    select 1 from public.user_answers ua
    where ua.attempt_id = p_attempt_id
      and ua.question_id = p_question_id
  ) then
    raise exception 'Bu urinishda bunday savol topilmadi.';
  end if;

  update public.user_answers ua
  set is_correct = p_is_correct
  where ua.attempt_id = p_attempt_id
    and ua.question_id = p_question_id;

  select count(*) filter (where ua.is_correct), count(*)
  into v_correct, v_count
  from public.user_answers ua
  where ua.attempt_id = p_attempt_id;

  -- Har savol 2 ball — submit_timed_test bilan bir xil hisob
  v_score := v_correct * 2;

  -- Maksimal ball urinishda saqlangan (javobsiz savollar ham kiradi)
  select coalesce(a.total_questions, v_count * 2)
  into v_total
  from public.attempts a
  where a.id = p_attempt_id;

  update public.attempts a
  set
    score = v_score,
    percentage = case
      when v_total > 0
        then least(round((v_score::numeric / v_total::numeric) * 100, 2), 100)
      else 0
    end
  where a.id = p_attempt_id;

  perform public.refresh_award_points(p_attempt_id);

  return query
  select a.score, a.total_questions, a.percentage
  from public.attempts a
  where a.id = p_attempt_id;
end;
$$;

-- ---------------------------------------------------------------------
--  Vazifa balini urinish foiziga moslash (faqat points, tanga emas)
-- ---------------------------------------------------------------------
create or replace function public.refresh_award_points(p_attempt_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_homework integer := 20;
  v_bonus    integer := 5;
begin
  select r.homework_points, r.ontime_bonus_points
  into v_homework, v_bonus
  from public.online_coin_rules r
  where r.id = true;

  v_homework := coalesce(v_homework, 20);
  v_bonus    := coalesce(v_bonus, 5);

  update public.online_coin_awards w
  set points = greatest(
    0,
    round(coalesce(att.percentage, 0) * v_homework / 100.0)::int
    + case when att.completed_at <= a.due_at then v_bonus else 0 end
  )
  from public.attempts att
  join public.assignments a on a.id = att.assignment_id
  where att.id = p_attempt_id
    and w.user_id = att.user_id
    and w.assignment_id = att.assignment_id;
end;
$$;

revoke all on function public.refresh_award_points(uuid) from public, anon, authenticated;
grant execute on function public.set_answer_correctness(uuid, bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------
--  Buzilgan urinishlarni qayta hisoblash
--
--  Belgisi: maksimal ball = javoblar soni × 2 (ya'ni 2 ballik tizim),
--  lekin saqlangan ball ≠ to'g'ri javoblar × 2. To'g'ri hisoblangan
--  urinishlarga tegilmaydi.
--
--  Avval nima o'zgarishini ko'rish uchun shu SELECT ni alohida
--  ishga tushirish mumkin:
--
--    select a.id, a.score, a.total_questions, a.percentage,
--           s.correct * 2 as new_score
--    from public.attempts a
--    join (select attempt_id,
--                 count(*) filter (where is_correct) as correct,
--                 count(*) as answers
--          from public.user_answers group by attempt_id) s
--      on s.attempt_id = a.id
--    where a.total_questions > 0
--      and a.score <> s.correct * 2
--      and (a.total_questions = s.answers * 2
--           or a.total_questions = 2 * (select count(*)
--                from public.questions q where q.test_id = a.test_id));
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_fixed integer := 0;
begin
  for r in
    select a.id, s.correct
    from public.attempts a
    join (
      select ua.attempt_id,
             count(*) filter (where ua.is_correct) as correct,
             count(*) as answers
      from public.user_answers ua
      group by ua.attempt_id
    ) s on s.attempt_id = a.id
    where a.total_questions > 0
      and a.score <> s.correct * 2
      and (
        a.total_questions = s.answers * 2
        or a.total_questions = 2 * (
          select count(*) from public.questions q where q.test_id = a.test_id
        )
      )
  loop
    update public.attempts a
    set
      score = r.correct * 2,
      percentage = least(
        round((r.correct * 2)::numeric / a.total_questions * 100, 2),
        100
      )
    where a.id = r.id;

    perform public.refresh_award_points(r.id);
    v_fixed := v_fixed + 1;
  end loop;

  raise notice 'Qayta hisoblangan urinishlar: %', v_fixed;
end;
$$;
