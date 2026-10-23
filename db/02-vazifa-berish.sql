-- =====================================================================
--  Uy vazifasi tizimi — 2-bosqich
--
--  Supabase → SQL Editor → to'liq nusxalab Run bosing.
--  Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O'quvchi guruhdan o'zi chiqa olmaydi
--
--    Faqat o'qituvchi chiqarib yuboradi. Bu UI da yashirish emas —
--    bazada ham yopiladi.
-- ---------------------------------------------------------------------
drop policy if exists group_members_self_delete on public.study_group_members;
drop function if exists public.leave_study_group(bigint);

-- ---------------------------------------------------------------------
-- 1b. Bir xil testni qayta berish mumkin bo'lsin
--
--    Avval "bitta guruh + bitta test" juftligi umuman takrorlanmasdi.
--    Bu kelasi chorakda o'sha testni qayta berishga to'sqinlik qilardi.
--    Endi cheklov faqat FAOL vazifalarga tegishli: eskisini yopib,
--    yangisini berish mumkin.
-- ---------------------------------------------------------------------
alter table public.assignments
  drop constraint if exists assignments_group_id_test_id_key;

create unique index if not exists assignments_one_active_idx
  on public.assignments (group_id, test_id)
  where is_active;

-- ---------------------------------------------------------------------
-- 2. O'quvchining vazifalari
--
--    Bitta chaqiruvda: vazifa, test, muddat va o'z natijasi.
-- ---------------------------------------------------------------------
create or replace function public.my_assignments()
returns table (
  assignment_id   bigint,
  group_id        bigint,
  group_title     text,
  test_id         bigint,
  test_title      text,
  time_limit_minutes integer,
  question_count  integer,
  due_at          timestamptz,
  is_overdue      boolean,
  attempt_id      uuid,
  completed_at    timestamptz,
  percentage      numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    g.id,
    g.title,
    t.id,
    t.title,
    t.time_limit_minutes,
    (select count(*)::int from public.questions q where q.test_id = t.id),
    a.due_at,
    (now() > a.due_at),
    att.id,
    att.completed_at,
    att.percentage
  from public.assignments a
  join public.study_groups g on g.id = a.group_id
  join public.tests t        on t.id = a.test_id
  join public.study_group_members m
    on m.group_id = a.group_id
   and m.user_id = auth.uid()
  left join public.attempts att
    on att.assignment_id = a.id
   and att.user_id = auth.uid()
  where a.is_active = true
  order by
    (att.completed_at is not null),  -- bajarilmaganlar tepada
    a.due_at asc;
$$;

-- ---------------------------------------------------------------------
-- 3. Vazifani boshlash mumkinmi
--
--    Qaytaradi: 'ok' | 'not_found' | 'not_member' | 'overdue' | 'done'
-- ---------------------------------------------------------------------
create or replace function public.assignment_access(p_assignment_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.assignments;
  is_member boolean;
  has_attempt boolean;
begin
  select * into a
  from public.assignments
  where id = p_assignment_id
    and is_active = true;

  if a.id is null then
    return 'not_found';
  end if;

  select exists (
    select 1 from public.study_group_members
    where group_id = a.group_id
      and user_id = auth.uid()
  ) into is_member;

  if not is_member then
    return 'not_member';
  end if;

  select exists (
    select 1 from public.attempts
    where assignment_id = a.id
      and user_id = auth.uid()
  ) into has_attempt;

  if has_attempt then
    return 'done';
  end if;

  if now() > a.due_at then
    return 'overdue';
  end if;

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Topshirilgan urinishni vazifaga bog'lash
--
--    Test yuborilgandan keyin chaqiriladi. Muddat testni boshlaganda
--    tekshirilgani uchun bu yerda qayta tekshirilmaydi — boshlagan
--    o'quvchi tugatib ulguradi.
-- ---------------------------------------------------------------------
create or replace function public.link_attempt_to_assignment(
  p_attempt_id uuid,
  p_assignment_id bigint
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a public.assignments;
begin
  select * into a
  from public.assignments
  where id = p_assignment_id
    and is_active = true;

  if a.id is null then
    raise exception 'Vazifa topilmadi.';
  end if;

  if not exists (
    select 1 from public.study_group_members
    where group_id = a.group_id
      and user_id = auth.uid()
  ) then
    raise exception 'Siz bu guruhda emassiz.';
  end if;

  update public.attempts
  set assignment_id = p_assignment_id
  where id = p_attempt_id
    and user_id = auth.uid()
    and assignment_id is null;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Ruxsatlar
-- ---------------------------------------------------------------------
grant execute on function public.my_assignments()                          to authenticated;
grant execute on function public.assignment_access(bigint)                 to authenticated;
grant execute on function public.link_attempt_to_assignment(uuid, bigint)  to authenticated;
