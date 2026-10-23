-- =====================================================================
--  26-fayl: onlayn uy vazifasi guruh balliga qo'shiladi
--
--  MUAMMO: onlayn vazifa faqat tanga berardi. Guruh reytingi esa
--  ball bo'yicha tuziladi — shu sababli vazifani a'lo bajargan
--  o'quvchi guruhdagi o'rnida ko'tarilmasdi.
--
--  YECHIM: onlayn vazifa ham BALL beradi, tanga esa balldan
--  hisoblanadi — xuddi darsdagi kabi. Ya'ni butun tizimda bitta
--  qoida: ball ishlab topiladi, tanga ballning ulushi.
--
--    ball  = foiz x homework_points / 100  (+ muddatida bo'lsa bonus)
--    tanga = ball / guruhning "1 tanga = ball" qoidasi
--
--  QAYTA HISOBLASH: eski yozuvlarga ham ball beriladi (ilgari faqat
--  tanga bor edi). Tanga miqdori o'zgarmaydi — o'quvchi allaqachon
--  sarflagan bo'lishi mumkin.
--
--  Shuningdek uy vazifasiga "Testlar" bo'limidan ham test tanlash
--  imkoni qo'shiladi (5-band).
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  25-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Qoidaga ball ustunlari
-- ---------------------------------------------------------------------
alter table public.online_coin_rules
  add column if not exists homework_points integer not null default 20;

alter table public.online_coin_rules
  add column if not exists ontime_bonus_points integer not null default 5;

insert into public.online_coin_rules (id)
values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Berilgan mukofotga ball ustuni
-- ---------------------------------------------------------------------
alter table public.online_coin_awards
  add column if not exists points integer not null default 0;

-- ---------------------------------------------------------------------
-- 3. Yig'ish — endi ball ham
--
--    Tanga guruhning o'z qoidasidan hisoblanadi, chunki har guruhda
--    "1 tanga = necha ball" boshqacha bo'lishi mumkin.
-- ---------------------------------------------------------------------
create or replace function public.award_online_coins()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_rules public.online_coin_rules%rowtype;
  v_count integer;
begin
  if v_user is null then
    return 0;
  end if;

  select * into v_rules from public.online_coin_rules where id = true;

  if not found then
    v_rules.homework_points     := 20;
    v_rules.ontime_bonus_points := 5;
  end if;

  insert into public.online_coin_awards (user_id, assignment_id, points, coins)
  select
    calc.user_id,
    calc.assignment_id,
    calc.points,
    case
      when calc.rate > 0 then (calc.points / calc.rate)
      else 0
    end
  from (
    select
      att.user_id,
      att.assignment_id,
      greatest(
        0,
        round(
          coalesce(att.percentage, 0) * v_rules.homework_points / 100.0
        )::int
        + case
            when att.completed_at <= a.due_at then v_rules.ontime_bonus_points
            else 0
          end
      ) as points,
      coalesce(
        (
          select r.coins_per_points
          from public.crm_groups g
          join public.crm_point_rules r on r.group_id = g.id
          where g.study_group_id = a.group_id
          limit 1
        ),
        10
      ) as rate
    from public.attempts att
    join public.assignments a on a.id = att.assignment_id
    where att.user_id = v_user
      and att.assignment_id is not null
      and att.completed_at is not null
  ) calc
  on conflict (user_id, assignment_id) do nothing;

  get diagnostics v_count = row_count;

  /*
   * Eski yozuvlarda ball nol bo'lib qolgan — ularni to'ldiramiz.
   * Tangaga tegilmaydi: o'quvchi uni sarflagan bo'lishi mumkin.
   */
  update public.online_coin_awards w
  set points = greatest(
    0,
    round(
      coalesce(att.percentage, 0) * v_rules.homework_points / 100.0
    )::int
    + case
        when att.completed_at <= a.due_at then v_rules.ontime_bonus_points
        else 0
      end
  )
  from public.attempts att
  join public.assignments a on a.id = att.assignment_id
  where w.user_id = v_user
    and w.points = 0
    and att.user_id = w.user_id
    and att.assignment_id = w.assignment_id;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Guruh ballari — dars + onlayn vazifa
--
--    Yordamchi ko'rinish: har bir o'quvchining shu guruhdagi
--    umumiy ball va tangasi. Uchta funksiya undan foydalanadi,
--    shunda hisob bitta joyda turadi.
-- ---------------------------------------------------------------------
create or replace view public.crm_student_totals as
select
  s.id            as student_id,
  s.group_id,
  s.user_id,
  s.full_name,
  coalesce(lesson.points, 0) + coalesce(online.points, 0) as points,
  coalesce(lesson.coins, 0)  + coalesce(online.coins, 0)  as coins
from public.crm_students s
left join lateral (
  select
    sum(d.points)::int as points,
    sum(d.coins)::int  as coins
  from public.crm_daily_records d
  where d.student_id = s.id
) lesson on true
left join lateral (
  select
    sum(w.points)::int as points,
    sum(w.coins)::int  as coins
  from public.online_coin_awards w
  join public.assignments a on a.id = w.assignment_id
  join public.crm_groups g  on g.study_group_id = a.group_id
  where w.user_id = s.user_id
    and g.id = s.group_id
) online on true;

/* Ko'rinishga faqat funksiyalar orqali murojaat qilinadi */
alter view public.crm_student_totals set (security_invoker = true);

-- ---------------------------------------------------------------------
-- 5. Mening guruhlarim — yangilangan hisob bilan
-- ---------------------------------------------------------------------
create or replace function public.my_groups()
returns table (
  crm_group_id   bigint,
  study_group_id bigint,
  title          text,
  my_points      integer,
  my_coins       integer,
  my_rank        integer,
  member_count   integer,
  lesson_count   integer
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select s.id as student_id, s.group_id
    from public.crm_students s
    where s.user_id = auth.uid()
      and s.is_active = true
  ),
  ranked as (
    select
      t.student_id,
      t.group_id,
      t.points,
      t.coins,
      rank() over (
        partition by t.group_id order by t.points desc
      )::int as place,
      count(*) over (partition by t.group_id)::int as members
    from public.crm_student_totals t
    join public.crm_students s on s.id = t.student_id
    where s.is_active = true
      and t.group_id in (select group_id from mine)
  )
  select
    g.id::bigint,
    g.study_group_id::bigint,
    g.title::text,
    r.points,
    r.coins,
    r.place,
    r.members,
    (select count(*)::int from public.crm_lessons l where l.group_id = g.id)
  from mine m
  join public.crm_groups g on g.id = m.group_id
  join ranked r on r.student_id = m.student_id
  order by g.title asc;
$$;

-- ---------------------------------------------------------------------
-- 6. Guruh reytingi — o'quvchi ko'rinishi
-- ---------------------------------------------------------------------
create or replace function public.my_group_leaderboard(p_group_id bigint)
returns table (
  student_id bigint,
  full_name  text,
  points     integer,
  coins      integer,
  place      integer,
  is_me      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select 1
    from public.crm_students s
    where s.group_id = p_group_id
      and s.user_id = auth.uid()
      and s.is_active = true
  )
  select
    t.student_id::bigint,
    t.full_name::text,
    t.points,
    t.coins,
    rank() over (order by t.points desc)::int,
    t.user_id = auth.uid()
  from public.crm_student_totals t
  join public.crm_students s on s.id = t.student_id
  where t.group_id = p_group_id
    and s.is_active = true
    and exists (select 1 from allowed)
  order by t.points desc, t.full_name asc;
$$;

-- ---------------------------------------------------------------------
-- 7. O'qituvchi ko'radigan guruh reytingi
-- ---------------------------------------------------------------------
create or replace function public.crm_group_ranking(p_group_id bigint)
returns table (
  student_id     bigint,
  full_name      text,
  has_account    boolean,
  total_points   integer,
  earned_coins   integer,
  lessons_count  integer,
  present_count  integer,
  homework_done  integer,
  homework_total integer,
  avg_behavior   numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id::bigint,
    s.full_name::text,
    s.user_id is not null,
    t.points,
    t.coins,
    (select count(*)::int from public.crm_daily_records d where d.student_id = s.id),
    (select count(*)::int from public.crm_daily_records d
      where d.student_id = s.id and d.attendance in ('keldi', 'kechikdi')),
    (select coalesce(sum(d.homework_done), 0)::int from public.crm_daily_records d
      where d.student_id = s.id),
    (select coalesce(sum(d.homework_total), 0)::int from public.crm_daily_records d
      where d.student_id = s.id),
    (select round(avg(d.behavior) filter (where d.behavior is not null), 1)
       from public.crm_daily_records d where d.student_id = s.id)
  from public.crm_students s
  join public.crm_student_totals t on t.student_id = s.id
  where s.group_id = p_group_id
    and s.is_active = true
    and public.is_teacher()
  order by t.points desc, s.full_name asc;
$$;

-- ---------------------------------------------------------------------
-- 8. Uy vazifasiga test tanlash — ikkala manbadan
--
--    `source` ustuni ro'yxatni ikkiga ajratish uchun:
--      'guruh'   — Guruhlar uchun maxsus testlar (katalogda yo'q)
--      'katalog' — Testlar bo'limidagi ochiq testlar
--
--    Dars testlari chiqmaydi — ular videodarsga biriktirilgan.
-- ---------------------------------------------------------------------
create or replace function public.assignable_tests()
returns table (
  test_id        bigint,
  test_title     text,
  section_title  text,
  question_count integer,
  source         text
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
      select 1 from public.lessons l where l.test_id = t.id
    )
  order by
    (case when e.code = 'guruh-testlari' then 0 else 1 end),
    s.order_number asc,
    s.id asc,
    t.order_number asc,
    t.id asc;
$$;

/*
 * Vazifa berishda "faqat guruh testi" tekshiruvi endi kerak emas.
 * Funksiya saqlanadi, lekin katalog testiga ham `true` qaytaradi —
 * shunda eski chaqiruvlar buzilmaydi.
 */
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
      and t.is_published = true
      and not exists (select 1 from public.lessons l where l.test_id = t.id)
  );
$$;

grant execute on function public.assignable_tests()               to authenticated;
grant execute on function public.my_groups()                      to authenticated;
grant execute on function public.my_group_leaderboard(bigint)     to authenticated;
grant execute on function public.crm_group_ranking(bigint)        to authenticated;
grant select on public.crm_student_totals                         to authenticated;
