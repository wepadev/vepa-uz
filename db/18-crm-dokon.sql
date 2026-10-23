-- =====================================================================
--  18-fayl: sovg'a do'koni
--
--  Ballar reytingni belgilaydi va hech qachon kamaymaydi — o'quvchi
--  yig'gan mehnati o'chib ketmasligi kerak.
--
--  Tangalar esa sarflanadi: o'quvchi to'plab, ro'yxatdagi sovg'aga
--  almashtiradi. Shu sababli ikki xil hisob yuritiladi.
--
--  Balans = ishlab topilgan tanga - sarflangan tanga.
--
--  Sovg'a keyinchalik o'chirilsa ham almashtirish tarixi buzilmaydi:
--  sovg'a nomi yozuvning ichiga ko'chirib qo'yiladi.
--
--  Faqat o'qituvchi uchun. Supabase -> SQL Editor -> Run.
--  Qayta ishga tushirish xavfsiz. 17-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Sovg'alar
--
--    group_id = null  ->  sovg'a barcha guruhlar uchun.
--    stock    = null  ->  cheklanmagan.
-- ---------------------------------------------------------------------
create table if not exists public.crm_rewards (
  id          bigint generated always as identity primary key,
  group_id    bigint      references public.crm_groups(id) on delete cascade,
  title       text        not null,
  description text,
  cost_coins  integer     not null check (cost_coins > 0),
  stock       integer     check (stock is null or stock >= 0),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Almashtirishlar
-- ---------------------------------------------------------------------
create table if not exists public.crm_redemptions (
  id           bigint generated always as identity primary key,
  student_id   bigint      not null references public.crm_students(id) on delete cascade,
  reward_id    bigint      references public.crm_rewards(id) on delete set null,
  reward_title text        not null,
  cost_coins   integer     not null check (cost_coins > 0),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists crm_redemptions_student_idx
  on public.crm_redemptions (student_id);

/* RLS: 17-fayldagi kabi — faqat o'qituvchi o'qiydi va yozadi */
alter table public.crm_rewards     enable row level security;
alter table public.crm_redemptions enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['crm_rewards', 'crm_redemptions']
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      v_table || '_teacher', v_table
    );

    execute format(
      'create policy %I on public.%I
         for all to authenticated
         using (public.is_teacher())
         with check (public.is_teacher())',
      v_table || '_teacher', v_table
    );

    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      v_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Bitta o'quvchining tanga balansi
-- ---------------------------------------------------------------------
create or replace function public.crm_student_balance(p_student_id bigint)
returns table (
  earned_coins    integer,
  spent_coins     integer,
  available_coins integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.earned,
    s.spent,
    e.earned - s.spent
  from
    (select coalesce(sum(d.coins), 0)::int as earned
       from public.crm_daily_records d
      where d.student_id = p_student_id) e,
    (select coalesce(sum(r.cost_coins), 0)::int as spent
       from public.crm_redemptions r
      where r.student_id = p_student_id) s
  where public.is_teacher();
$$;

-- ---------------------------------------------------------------------
-- 4. Guruhdagi hamma balanslar — do'kon ekrani uchun
-- ---------------------------------------------------------------------
create or replace function public.crm_group_balances(p_group_id bigint)
returns table (
  student_id      bigint,
  full_name       text,
  earned_coins    integer,
  spent_coins     integer,
  available_coins integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id::bigint,
    s.full_name::text,
    coalesce(e.earned, 0)::int,
    coalesce(r.spent, 0)::int,
    (coalesce(e.earned, 0) - coalesce(r.spent, 0))::int
  from public.crm_students s
  left join lateral (
    select sum(d.coins)::int as earned
    from public.crm_daily_records d
    where d.student_id = s.id
  ) e on true
  left join lateral (
    select sum(x.cost_coins)::int as spent
    from public.crm_redemptions x
    where x.student_id = s.id
  ) r on true
  where s.group_id = p_group_id
    and s.is_active = true
    and public.is_teacher()
  order by (coalesce(e.earned, 0) - coalesce(r.spent, 0)) desc, s.full_name asc;
$$;

-- ---------------------------------------------------------------------
-- 5. Guruhga tegishli sovg'alar
-- ---------------------------------------------------------------------
create or replace function public.crm_reward_list(p_group_id bigint default null)
returns table (
  id          bigint,
  group_id    bigint,
  title       text,
  description text,
  cost_coins  integer,
  stock       integer,
  is_active   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id::bigint,
    w.group_id::bigint,
    w.title::text,
    w.description::text,
    w.cost_coins,
    w.stock,
    w.is_active
  from public.crm_rewards w
  where public.is_teacher()
    and (
      p_group_id is null
      or w.group_id is null
      or w.group_id = p_group_id
    )
  order by w.is_active desc, w.cost_coins asc, w.title asc;
$$;

-- ---------------------------------------------------------------------
-- 6. Sovg'aga almashtirish
--
--    Tanga yetmasa yoki sovg'a tugagan bo'lsa tushunarli xato
--    qaytadi — o'qituvchi buni ekranda ko'radi.
-- ---------------------------------------------------------------------
create or replace function public.crm_redeem(
  p_student_id bigint,
  p_reward_id  bigint,
  p_note       text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward    public.crm_rewards%rowtype;
  v_student   public.crm_students%rowtype;
  v_available integer;
  v_id        bigint;
begin
  if not public.is_teacher() then
    raise exception 'Ruxsat yo''q';
  end if;

  select * into v_student
  from public.crm_students where id = p_student_id;

  if not found then
    raise exception 'O''quvchi topilmadi';
  end if;

  -- Qator qulflanadi: ikki marta bosilsa ikkinchisi kutadi
  select * into v_reward
  from public.crm_rewards where id = p_reward_id
  for update;

  if not found or v_reward.is_active = false then
    raise exception 'Sovg''a mavjud emas';
  end if;

  -- Sovg'a boshqa guruhga tegishli bo'lmasin
  if v_reward.group_id is not null
     and v_reward.group_id <> v_student.group_id then
    raise exception 'Bu sovg''a boshqa guruh uchun';
  end if;

  if v_reward.stock is not null and v_reward.stock <= 0 then
    raise exception 'Sovg''a tugagan';
  end if;

  select b.available_coins into v_available
  from public.crm_student_balance(p_student_id) b;

  if coalesce(v_available, 0) < v_reward.cost_coins then
    raise exception 'Tanga yetarli emas: % ta bor, % ta kerak',
      coalesce(v_available, 0), v_reward.cost_coins;
  end if;

  insert into public.crm_redemptions (
    student_id, reward_id, reward_title, cost_coins, note
  )
  values (
    p_student_id,
    v_reward.id,
    v_reward.title,
    v_reward.cost_coins,
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_id;

  if v_reward.stock is not null then
    update public.crm_rewards
    set stock = stock - 1
    where id = v_reward.id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Almashtirishni bekor qilish
--
--    Xato bosilgan bo'lsa qaytarish kerak: tanga o'quvchiga
--    qaytadi, sovg'a zaxirasi tiklanadi.
-- ---------------------------------------------------------------------
create or replace function public.crm_cancel_redemption(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.crm_redemptions%rowtype;
begin
  if not public.is_teacher() then
    raise exception 'Ruxsat yo''q';
  end if;

  delete from public.crm_redemptions where id = p_id returning * into v_row;

  if not found then
    return;
  end if;

  if v_row.reward_id is not null then
    update public.crm_rewards
    set stock = stock + 1
    where id = v_row.reward_id
      and stock is not null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Almashtirishlar tarixi
-- ---------------------------------------------------------------------
create or replace function public.crm_redemption_history(p_group_id bigint)
returns table (
  id           bigint,
  student_id   bigint,
  full_name    text,
  reward_title text,
  cost_coins   integer,
  note         text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id::bigint,
    s.id::bigint,
    s.full_name::text,
    r.reward_title::text,
    r.cost_coins,
    r.note::text,
    r.created_at
  from public.crm_redemptions r
  join public.crm_students s on s.id = r.student_id
  where s.group_id = p_group_id
    and public.is_teacher()
  order by r.created_at desc
  limit 100;
$$;

grant execute on function public.crm_student_balance(bigint)             to authenticated;
grant execute on function public.crm_group_balances(bigint)              to authenticated;
grant execute on function public.crm_reward_list(bigint)                 to authenticated;
grant execute on function public.crm_redeem(bigint, bigint, text)        to authenticated;
grant execute on function public.crm_cancel_redemption(bigint)           to authenticated;
grant execute on function public.crm_redemption_history(bigint)          to authenticated;
