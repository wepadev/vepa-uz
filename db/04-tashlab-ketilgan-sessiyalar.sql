-- =====================================================================
--  Tashlab ketilgan test sessiyalarini yopish
--
--  Supabase → SQL Editor → to'liq nusxalab Run bosing.
--  Qayta ishga tushirish xavfsiz.
--
--  MUAMMO
--  O'quvchi testni boshlaydi, keyin internetni uzadi yoki brauzerni
--  yopadi. Vaqt tugaydi, lekin hech qanday urinish yozilmaydi.
--  Natijada:
--    1. O'qituvchi "ishlamadi" deb ko'radi, aslida boshlagan edi;
--    2. Uy vazifasida "bir marta" qoidasi chetlab o'tiladi —
--       savollarni ko'rib, brauzerni yopib, qaytadan boshlash mumkin.
--
--  YECHIM
--  Muddati o'tgan va yopilmagan sessiya uchun 0 ballik urinish
--  yaratiladi. Xuddi o'quvchi bo'sh varaq topshirgandek.
-- =====================================================================

create or replace function public.close_abandoned_sessions()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_session       record;
  v_attempt_id    uuid;
  v_total_points  integer;
  v_assignment_id bigint;
  v_closed        integer := 0;
begin
  for v_session in
    select s.id, s.user_id, s.test_id, s.started_at, s.expires_at
    from public.test_sessions s
    where s.submitted_at is null
      and s.attempt_id is null
      and s.expires_at < now()
    -- Bir vaqtda ikki marta ishlab ketmasligi uchun
    for update skip locked
  loop
    -- Har savol 2 ball — submit_timed_test bilan bir xil hisob
    select count(*) * 2
    into v_total_points
    from public.questions
    where test_id = v_session.test_id;

    if coalesce(v_total_points, 0) = 0 then
      -- Savolsiz test: shunchaki sessiyani yopamiz
      update public.test_sessions
      set submitted_at = v_session.expires_at
      where id = v_session.id;

      continue;
    end if;

    /*
     * Uy vazifasini aniqlash.
     * Sessiya vazifani bilmaydi, shuning uchun o'quvchi a'zo bo'lgan
     * guruhlardagi shu testga tegishli faol vazifani qidiramiz.
     * Aniq bitta bo'lsagina bog'laymiz — noaniq holatda tegmaymiz.
     */
    select a.id
    into v_assignment_id
    from public.assignments a
    join public.study_group_members m
      on m.group_id = a.group_id
     and m.user_id = v_session.user_id
    where a.test_id = v_session.test_id
      and a.is_active = true
      and not exists (
        select 1 from public.attempts att
        where att.assignment_id = a.id
          and att.user_id = v_session.user_id
      )
    limit 2;

    -- Agar bittadan ko'p topilsa — noaniq, bog'lamaymiz
    if (
      select count(*)
      from public.assignments a
      join public.study_group_members m
        on m.group_id = a.group_id
       and m.user_id = v_session.user_id
      where a.test_id = v_session.test_id
        and a.is_active = true
    ) <> 1 then
      v_assignment_id := null;
    end if;

    insert into public.attempts (
      user_id,
      test_id,
      score,
      total_questions,
      percentage,
      started_at,
      completed_at,
      assignment_id
    )
    values (
      v_session.user_id,
      v_session.test_id,
      0,
      v_total_points,
      0,
      v_session.started_at,
      v_session.expires_at,
      v_assignment_id
    )
    returning id into v_attempt_id;

    -- Barcha savollar javobsiz deb yoziladi
    insert into public.user_answers (
      attempt_id,
      question_id,
      selected_answer,
      is_correct
    )
    select v_attempt_id, q.id, '', false
    from public.questions q
    where q.test_id = v_session.test_id;

    update public.test_sessions
    set
      submitted_at = v_session.expires_at,
      attempt_id = v_attempt_id
    where id = v_session.id;

    v_closed := v_closed + 1;
  end loop;

  return v_closed;
end;
$$;

comment on function public.close_abandoned_sessions() is
  'Muddati o''tgan va topshirilmagan sessiyalar uchun 0 ballik urinish yaratadi.';

grant execute on function public.close_abandoned_sessions() to authenticated;

-- ---------------------------------------------------------------------
--  Ixtiyoriy: avtomatik ishga tushirish
--
--  Yuqoridagi funksiya sayt ochilganda ham chaqiriladi, lekin uni
--  har 5 daqiqada avtomatik ishlatib turish ishonchliroq.
--  Supabase → Database → Extensions → pg_cron ni yoqing, so'ng
--  quyidagi ikki qatorni izohdan chiqarib, bir marta ishga tushiring:
--
--  select cron.schedule(
--    'close-abandoned-sessions',
--    '*/5 * * * *',
--    $cron$ select public.close_abandoned_sessions(); $cron$
--  );
-- ---------------------------------------------------------------------
