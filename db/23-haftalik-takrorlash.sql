-- =====================================================================
--  23-fayl: takrorlash haftada bir marta
--
--  ILGARI: xato qilingan savol ertaga, keyin 3, 7, 30 kundan qaytardi.
--  Har kuni bir nechta savol chiqib, o'quvchini charchatardi.
--
--  ENDI oddiy va oldindan bilinadigan qoida:
--
--    · hafta davomida qilingan xatolar yig'iladi
--    · ular keyingi dushanbadan takrorlashga chiqadi
--    · to'g'ri yechsa — savol boshqa hech qachon qaytmaydi
--    · yana xato qilsa — keyingi haftaga qoladi
--
--  Ya'ni o'quvchi haftada bir marta o'tirib, o'sha haftaning
--  xatolarini yopadi.
--
--  Bosqichlar (1-3-7-30) endi ishlatilmaydi. `stage` ustuni
--  jadvalda qoladi — eski yozuvlar buzilmasin, lekin hisobga
--  olinmaydi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  22-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Keyingi takrorlash sanasi
--
--    Har doim keyingi hafta boshi (dushanba). Bugun dushanba
--    bo'lsa ham keyingi dushanba qaytadi — shu haftaning xatosi
--    shu hafta takrorlanmasin, avval o'rganilsin.
-- ---------------------------------------------------------------------
create or replace function public.next_review_monday()
returns timestamptz
language sql
stable
as $$
  select date_trunc('week', now() at time zone 'Asia/Tashkent')
       + interval '7 days';
$$;

-- ---------------------------------------------------------------------
-- 2. Xatolarni yig'ish — endi keyingi haftaga
-- ---------------------------------------------------------------------
create or replace function public.collect_review_items()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    return 0;
  end if;

  insert into public.review_items (user_id, question_id, due_at)
  select distinct
    v_user,
    ua.question_id,
    public.next_review_monday()
  from public.attempts a
  join public.user_answers ua on ua.attempt_id = a.id
  join public.questions q     on q.id = ua.question_id
  where a.user_id = v_user
    and a.completed_at is not null
    and a.completed_at > now() - interval '90 days'
    and ua.is_correct = false
  on conflict (user_id, question_id) do nothing;

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Javob: to'g'ri bo'lsa butunlay yopiladi
--
--    Bosqich yo'q. To'g'ri — tamom. Xato — keyingi haftaga.
-- ---------------------------------------------------------------------
create or replace function public.answer_review_item(
  p_question_id bigint,
  p_answer      text
)
returns table (
  is_correct         boolean,
  correct_answer     text,
  solution_text      text,
  solution_video_url text,
  next_due_at        timestamptz,
  new_stage          smallint,
  is_mastered        boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_item    public.review_items%rowtype;
  v_correct boolean;
  v_due     timestamptz;
begin
  if v_user is null then
    return;
  end if;

  select * into v_item
  from public.review_items r
  where r.user_id = v_user
    and r.question_id = p_question_id
    and r.due_at is not null
    and r.due_at <= now()
  for update;

  if not found then
    return;
  end if;

  v_correct := public.review_answer_matches(p_question_id, p_answer);

  if v_correct then
    /* To'g'ri yechdi — savol yopiladi, boshqa qaytmaydi */
    v_due := null;

    update public.review_items r
    set stage            = 5,
        due_at           = null,
        right_count      = r.right_count + 1,
        last_reviewed_at = now()
    where r.id = v_item.id;
  else
    /* Xato — keyingi haftaga qoladi */
    v_due := public.next_review_monday();

    update public.review_items r
    set stage            = 0,
        due_at           = v_due,
        wrong_count      = r.wrong_count + 1,
        last_reviewed_at = now()
    where r.id = v_item.id;
  end if;

  return query
  select
    v_correct,
    k.correct_answer::text,
    k.solution_text::text,
    k.solution_video_url::text,
    v_due,
    (case when v_correct then 5 else 0 end)::smallint,
    v_correct
  from public.answer_keys k
  where k.question_id = p_question_id;

  if not found then
    return query
    select v_correct, null::text, null::text, null::text,
           v_due, (case when v_correct then 5 else 0 end)::smallint, v_correct;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Keyingi takrorlash qachonligi
--
--    Sahifada "Keyingi takrorlash: 2-sentabr" deb ko'rsatish uchun.
--    Bugun kutayotgan savol bo'lmasa shu sana chiqadi.
-- ---------------------------------------------------------------------
create or replace function public.review_next_date()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select min(r.due_at)
  from public.review_items r
  where r.user_id = auth.uid()
    and r.due_at is not null
    and r.due_at > now();
$$;

grant execute on function public.next_review_monday()             to authenticated;
grant execute on function public.review_next_date()               to authenticated;
