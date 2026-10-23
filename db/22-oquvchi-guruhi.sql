-- =====================================================================
--  22-fayl: o'quvchi o'z guruhini ko'radi
--
--  O'quvchiga kerak bo'lgan narsalar:
--
--    · qaysi guruhlardaman va guruhdagi o'rnim nechanchi
--    · o'tgan darslarda qancha ball va tanga oldim
--    · guruh reytingi — kimda qancha ball va tanga bor
--
--  Hammasi faqat o'zi a'zo bo'lgan guruh bo'yicha. Begona guruhning
--  ma'lumoti hech qachon qaytmaydi.
--
--  Reyting ataylab ochiq: o'quvchilar bir-birini ko'rib turgani
--  musobaqa hissini beradi. Lekin faqat ism, ball va tanga —
--  davomat, xulq bahosi va izohlar sir bo'lib qoladi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  21-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mening guruhlarim
--
--    Har bir guruh uchun: nomi, mening ballim, tangam va o'rnim.
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
  totals as (
    select
      s.group_id,
      s.id as student_id,
      coalesce(sum(d.points), 0)::int as points,
      coalesce(sum(d.coins), 0)::int  as coins
    from public.crm_students s
    left join public.crm_daily_records d on d.student_id = s.id
    where s.is_active = true
      and s.group_id in (select group_id from mine)
    group by s.group_id, s.id
  ),
  ranked as (
    select
      t.*,
      rank() over (
        partition by t.group_id order by t.points desc
      )::int as place,
      count(*) over (partition by t.group_id)::int as members
    from totals t
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
-- 2. Mening dars tarixim
--
--    Faqat o'zining yozuvlari. Izoh ham qaytadi — o'qituvchining
--    o'quvchiga aytgan gapi, uni ko'rsa foydali.
-- ---------------------------------------------------------------------
create or replace function public.my_lesson_history(p_group_id bigint)
returns table (
  lesson_date date,
  topic       text,
  attendance  text,
  behavior    smallint,
  homework    integer,
  points      integer,
  coins       integer,
  note        text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.lesson_date,
    l.topic::text,
    d.attendance::text,
    d.behavior,
    d.homework_done,
    d.points,
    d.coins,
    d.note::text
  from public.crm_daily_records d
  join public.crm_lessons l  on l.id = d.lesson_id
  join public.crm_students s on s.id = d.student_id
  where s.user_id = auth.uid()
    and s.group_id = p_group_id
  order by l.lesson_date desc
  limit 60;
$$;

-- ---------------------------------------------------------------------
-- 3. Guruh reytingi — o'quvchi ko'radigan ko'rinish
--
--    Faqat ism, ball va tanga. Davomat va xulq ko'rsatilmaydi.
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
  ),
  totals as (
    select
      s.id,
      s.full_name,
      s.user_id,
      coalesce(sum(d.points), 0)::int as points,
      coalesce(sum(d.coins), 0)::int  as coins
    from public.crm_students s
    left join public.crm_daily_records d on d.student_id = s.id
    where s.group_id = p_group_id
      and s.is_active = true
      and exists (select 1 from allowed)
    group by s.id, s.full_name, s.user_id
  )
  select
    t.id::bigint,
    t.full_name::text,
    t.points,
    t.coins,
    rank() over (order by t.points desc)::int,
    t.user_id = auth.uid()
  from totals t
  order by t.points desc, t.full_name asc;
$$;

-- ---------------------------------------------------------------------
-- 4. Kutayotgan sovg'a so'rovlari soni
--
--    Admin panelidagi ko'rsatkich uchun.
-- ---------------------------------------------------------------------
create or replace function public.pending_redemption_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.crm_redemptions r
  where r.status = 'kutilmoqda'
    and public.is_teacher();
$$;

grant execute on function public.my_groups()                      to authenticated;
grant execute on function public.my_lesson_history(bigint)        to authenticated;
grant execute on function public.my_group_leaderboard(bigint)     to authenticated;
grant execute on function public.pending_redemption_count()       to authenticated;
