-- =====================================================================
--  Uy vazifasi tizimi — 1-bosqich
--
--  Supabase → SQL Editor → shu faylni to'liq nusxalab, Run bosing.
--  Qayta ishga tushirish xavfsiz: hamma narsa "if not exists" bilan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Guruh (sinf)
-- ---------------------------------------------------------------------
create table if not exists public.study_groups (
  id          bigint generated always as identity primary key,
  title       text        not null check (length(btrim(title)) > 0),
  join_code   text        not null unique,
  created_by  uuid        not null references public.profiles (id) on delete cascade,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.study_groups is
  'O''qituvchi yaratadigan sinf yoki to''garak. join_code orqali o''quvchi qo''shiladi.';

-- ---------------------------------------------------------------------
-- 2. Guruh a'zolari
-- ---------------------------------------------------------------------
create table if not exists public.study_group_members (
  group_id  bigint      not null references public.study_groups (id) on delete cascade,
  user_id   uuid        not null references public.profiles (id)     on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists study_group_members_user_idx
  on public.study_group_members (user_id);

-- ---------------------------------------------------------------------
-- 3. Uy vazifasi
-- ---------------------------------------------------------------------
create table if not exists public.assignments (
  id         bigint generated always as identity primary key,
  group_id   bigint      not null references public.study_groups (id) on delete cascade,
  test_id    bigint      not null references public.tests (id)        on delete cascade,
  due_at     timestamptz not null,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, test_id)
);

create index if not exists assignments_group_idx
  on public.assignments (group_id, is_active);

comment on column public.assignments.due_at is
  'Muddat. O''tgach vazifa yopiladi — yangi urinish boshlab bo''lmaydi.';

-- ---------------------------------------------------------------------
-- 4. Urinishni vazifaga bog'lash
-- ---------------------------------------------------------------------
alter table public.attempts
  add column if not exists assignment_id bigint
  references public.assignments (id) on delete set null;

create index if not exists attempts_assignment_idx
  on public.attempts (assignment_id);

-- Bitta o'quvchi bitta vazifani faqat bir marta ishlaydi
create unique index if not exists attempts_one_per_assignment_idx
  on public.attempts (assignment_id, user_id)
  where assignment_id is not null;

-- ---------------------------------------------------------------------
-- 5. Yordamchi funksiyalar
-- ---------------------------------------------------------------------

-- Foydalanuvchi admin (o'qituvchi) mi
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

-- Takrorlanmaydigan qo'shilish kodi.
-- Chalkashadigan belgilar (0/O, 1/I) ishlatilmaydi.
create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';

    for i in 1..6 loop
      candidate := candidate ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.study_groups where join_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

-- Guruh yaratish (faqat o'qituvchi). Kodni o'zi generatsiya qiladi.
create or replace function public.create_study_group(p_title text)
returns public.study_groups
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  new_group public.study_groups;
begin
  if not public.is_teacher() then
    raise exception 'Faqat o''qituvchi guruh yarata oladi.';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Guruh nomini kiriting.';
  end if;

  insert into public.study_groups (title, join_code, created_by)
  values (btrim(p_title), public.generate_join_code(), auth.uid())
  returning * into new_group;

  return new_group;
end;
$$;

-- Kod bilan guruhga qo'shilish (o'quvchi o'zi chaqiradi)
create or replace function public.join_study_group(p_code text)
returns public.study_groups
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  target public.study_groups;
begin
  if auth.uid() is null then
    raise exception 'Avval tizimga kiring.';
  end if;

  select * into target
  from public.study_groups
  where upper(btrim(p_code)) = join_code
    and is_active = true;

  if target.id is null then
    raise exception 'Bunday kod topilmadi.';
  end if;

  insert into public.study_group_members (group_id, user_id)
  values (target.id, auth.uid())
  on conflict do nothing;

  return target;
end;
$$;

-- Guruhdan chiqish
create or replace function public.leave_study_group(p_group_id bigint)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.study_group_members
  where group_id = p_group_id
    and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 6. RLS qoidalari
-- ---------------------------------------------------------------------
alter table public.study_groups        enable row level security;
alter table public.study_group_members enable row level security;
alter table public.assignments         enable row level security;

-- --- study_groups ---
drop policy if exists study_groups_teacher_all on public.study_groups;
create policy study_groups_teacher_all
  on public.study_groups
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists study_groups_member_read on public.study_groups;
create policy study_groups_member_read
  on public.study_groups
  for select
  using (
    exists (
      select 1 from public.study_group_members m
      where m.group_id = study_groups.id
        and m.user_id = auth.uid()
    )
  );

-- --- study_group_members ---
drop policy if exists group_members_teacher_all on public.study_group_members;
create policy group_members_teacher_all
  on public.study_group_members
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists group_members_self_read on public.study_group_members;
create policy group_members_self_read
  on public.study_group_members
  for select
  using (user_id = auth.uid());

drop policy if exists group_members_self_delete on public.study_group_members;
create policy group_members_self_delete
  on public.study_group_members
  for delete
  using (user_id = auth.uid());

-- Qo'shilish faqat join_study_group() orqali — to'g'ridan-to'g'ri
-- insert qilish uchun policy ataylab berilmagan.

-- --- assignments ---
drop policy if exists assignments_teacher_all on public.assignments;
create policy assignments_teacher_all
  on public.assignments
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists assignments_member_read on public.assignments;
create policy assignments_member_read
  on public.assignments
  for select
  using (
    is_active = true
    and exists (
      select 1 from public.study_group_members m
      where m.group_id = assignments.group_id
        and m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 7. Ruxsatlar
-- ---------------------------------------------------------------------
grant execute on function public.is_teacher()                to authenticated;
grant execute on function public.create_study_group(text)    to authenticated;
grant execute on function public.join_study_group(text)      to authenticated;
grant execute on function public.leave_study_group(bigint)   to authenticated;

revoke execute on function public.generate_join_code() from anon, authenticated;
