-- =====================================================================
--  15-fayl: xatolarni takrorlash (oraliqli takrorlash)
--
--  MUAMMO: o'quvchi testda xato qiladi, natijani ko'radi va unutadi.
--  Xuddi shu savol bir oydan keyin yana xato bo'ladi.
--
--  YECHIM: xato qilingan (yoki javobsiz qolgan) savol takrorlash
--  ro'yxatiga tushadi va oraliq bilan qaytib turadi:
--
--      xato            -> ertaga
--      1-marta to'g'ri -> 1 kundan keyin
--      2-marta to'g'ri -> 3 kundan keyin
--      3-marta to'g'ri -> 7 kundan keyin
--      4-marta to'g'ri -> 30 kundan keyin
--      5-marta to'g'ri -> o'zlashtirildi, boshqa chiqmaydi
--
--  Har qanday bosqichda xato qilinsa — boshidan boshlanadi.
--
--  MUHIM: takrorlash reytingga ham, natijalar tarixiga ham umuman
--  ta'sir qilmaydi. `attempts` jadvaliga hech narsa yozilmaydi.
--  Bu ataylab: aks holda o'quvchi oson savollarni qayta-qayta
--  ishlab ball yig'ib olardi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Takrorlash ro'yxati
--
--    due_at = null  ->  o'zlashtirilgan, boshqa chiqmaydi.
--    Yozuv hech qachon o'chirilmaydi: aks holda yig'uvchi funksiya
--    uni eski urinishlardan topib yana qo'shib yuborardi.
-- ---------------------------------------------------------------------
create table if not exists public.review_items (
  id               bigint generated always as identity primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  question_id      bigint      not null references public.questions(id) on delete cascade,
  stage            smallint    not null default 0,
  due_at           timestamptz,
  wrong_count      integer     not null default 1,
  right_count      integer     not null default 0,
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists review_items_due_idx
  on public.review_items (user_id, due_at)
  where due_at is not null;

/*
 * RLS yoqiladi, siyosat yozilmaydi — jadvalga faqat quyidagi
 * security definer funksiyalari orqali murojaat qilinadi.
 */
alter table public.review_items enable row level security;

-- ---------------------------------------------------------------------
-- 2. Javobni solishtirish
--
--    Bosh harf va chetdagi bo'sh joy hisobga olinmaydi. Javob
--    kalitidagi muqobil variantlar (accepted_answers) ham qabul
--    qilinadi — SAT dagi "0.5 / 0,5 / .5 / 1/2" kabi holatlar uchun.
-- ---------------------------------------------------------------------
create or replace function public.review_answer_matches(
  p_question_id bigint,
  p_answer      text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.answer_keys k
    where k.question_id = p_question_id
      and (
        lower(btrim(k.correct_answer)) = lower(btrim(coalesce(p_answer, '')))
        or exists (
          select 1
          from unnest(coalesce(k.accepted_answers, '{}'::text[])) alt
          where lower(btrim(alt)) = lower(btrim(coalesce(p_answer, '')))
        )
      )
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Xatolarni yig'ish
--
--    Tugallangan urinishlardagi noto'g'ri javoblarni ro'yxatga
--    qo'shadi. Javobsiz qolgan savollar ham shu yerga tushadi:
--    ular `user_answers` ga bo'sh javob va is_correct = false bilan
--    yoziladi.
--
--    Ikki marta qo'shilmaydi (unique cheklovi), o'zlashtirilgan
--    savol esa qayta tirilmaydi.
--
--    Oxirgi 90 kun bilan chegaralangan: juda eski urinishlarni har
--    safar qayta ko'rib chiqish keraksiz yuk.
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
    now()
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
-- 4. Bugun kutayotgan savollar soni
--
--    Bosh sahifadagi eslatma uchun. Yig'ishni ham o'zi bajaradi,
--    ya'ni sahifa bitta chaqiruv bilan kifoyalanadi.
-- ---------------------------------------------------------------------
create or replace function public.due_review_count()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return 0;
  end if;

  return (
    select count(*)::int
    from public.review_items r
    where r.user_id = v_user
      and r.due_at is not null
      and r.due_at <= now()
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Takrorlash uchun savollar
--
--    Variantlar savolning o'zida yoki blokda bo'lishi mumkin
--    (uchtalik savollarda variantlar umumiy) — shuning uchun
--    coalesce bilan ikkalasidan olinadi.
--
--    To'g'ri javob ataylab qaytarilmaydi: u faqat o'quvchi javob
--    berganidan keyin, `answer_review_item` orqali beriladi.
-- ---------------------------------------------------------------------
create or replace function public.due_review_questions(
  p_limit integer default 10
)
returns table (
  question_id   bigint,
  question_text text,
  stimulus_text text,
  image_path    text,
  option_a      text,
  option_b      text,
  option_c      text,
  option_d      text,
  question_type text,
  part_label    text,
  test_title    text,
  stage         smallint,
  wrong_count   integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id::bigint,
    q.question_text::text,
    b.stimulus_text::text,
    coalesce(q.image_path, b.image_path)::text,
    coalesce(q.option_a, b.option_a)::text,
    coalesce(q.option_b, b.option_b)::text,
    coalesce(q.option_c, b.option_c)::text,
    coalesce(q.option_d, b.option_d)::text,
    q.question_type::text,
    q.part_label::text,
    t.title::text,
    r.stage,
    r.wrong_count
  from public.review_items r
  join public.questions q            on q.id = r.question_id
  left join public.question_blocks b on b.id = q.block_id
  left join public.tests t           on t.id = q.test_id
  where r.user_id = auth.uid()
    and r.due_at is not null
    and r.due_at <= now()
  order by r.due_at asc, r.wrong_count desc, q.id asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

-- ---------------------------------------------------------------------
-- 6. Javobni qabul qilish va keyingi muddatni belgilash
--
--    Natija bilan birga yechim ham qaytadi — o'quvchi xatosini
--    darhol ko'rib, tushunib ketsin.
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
  v_stage   smallint;
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
    v_stage := least(v_item.stage + 1, 5);

    v_due := case v_stage
      when 1 then now() + interval '1 day'
      when 2 then now() + interval '3 days'
      when 3 then now() + interval '7 days'
      when 4 then now() + interval '30 days'
      else null                       -- 5 -> o'zlashtirildi
    end;

    update public.review_items r
    set stage            = v_stage,
        due_at           = v_due,
        right_count      = r.right_count + 1,
        last_reviewed_at = now()
    where r.id = v_item.id;
  else
    v_stage := 0;
    v_due   := now() + interval '1 day';

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
    v_stage,
    v_due is null
  from public.answer_keys k
  where k.question_id = p_question_id;

  -- Javob kaliti topilmasa ham natija qaytsin
  if not found then
    return query
    select v_correct, null::text, null::text, null::text,
           v_due, v_stage, v_due is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Umumiy holat — sahifa tepasidagi ko'rsatkichlar
-- ---------------------------------------------------------------------
create or replace function public.review_progress()
returns table (
  due_count      integer,
  learning_count integer,
  mastered_count integer,
  total_count    integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where r.due_at is not null and r.due_at <= now())::int,
    count(*) filter (where r.due_at is not null)::int,
    count(*) filter (where r.due_at is null)::int,
    count(*)::int
  from public.review_items r
  where r.user_id = auth.uid();
$$;

grant execute on function public.review_answer_matches(bigint, text) to authenticated;
grant execute on function public.collect_review_items()              to authenticated;
grant execute on function public.due_review_count()                  to authenticated;
grant execute on function public.due_review_questions(integer)       to authenticated;
grant execute on function public.answer_review_item(bigint, text)    to authenticated;
grant execute on function public.review_progress()                   to authenticated;
