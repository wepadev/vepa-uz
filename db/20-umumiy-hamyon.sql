-- =====================================================================
--  20-fayl: umumiy tanga hamyoni va o'quvchi do'koni
--
--  NIMA O'ZGARDI
--
--  1. Offline guruhga ham qo'shilish kodi qo'shildi — o'quvchi
--     o'zi kiritib guruhga ulanadi, o'qituvchi email yozib
--     o'tirmaydi.
--
--  2. Onlayn guruhdagi uy vazifasi ham tanga keltiradi: foizga
--     yarasha, muddatida bajarsa bonus bilan.
--
--  3. Balans endi bitta. O'quvchi offline darsda ham, saytda ham
--     tanga yig'adi — hammasi bitta hamyonga tushadi.
--
--  4. O'quvchi sovg'ani o'zi tanlaydi. Tanga darhol ushlab
--     qolinadi (ikki marta sarflay olmasin), sovg'a "kutilmoqda"
--     holatida turadi. O'qituvchi qo'lga topshirganda tasdiqlaydi.
--
--  HAMYON KIMGA TEGISHLI
--
--  Saytda hisobi bor o'quvchida hamyon `user_id` ga bog'lanadi:
--  uning barcha offline guruhlaridagi tangalari va onlayn
--  vazifalardan yig'ilgani birlashadi.
--
--  Hisobi yo'q, faqat ro'yxatdagi o'quvchida hamyon `crm_students`
--  yozuviga bog'lanadi — u faqat o'qituvchi orqali ishlaydi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  19-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Offline guruhga qo'shilish kodi
-- ---------------------------------------------------------------------
alter table public.crm_groups
  add column if not exists join_code text;

create unique index if not exists crm_groups_join_code_idx
  on public.crm_groups (join_code)
  where join_code is not null;

/* Takrorlanmaydigan 6 belgili kod. Chalkash harflar (I, O, 0, 1) yo'q. */
create or replace function public.crm_generate_join_code()
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
      select 1 from public.crm_groups where join_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

/* Kodi yo'q eski guruhlarga kod beramiz */
do $$
declare
  v_id bigint;
begin
  for v_id in select id from public.crm_groups where join_code is null
  loop
    update public.crm_groups
    set join_code = public.crm_generate_join_code()
    where id = v_id;
  end loop;
end $$;

/* Yangi guruhga kod o'zi beriladi */
create or replace function public.tg_crm_group_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.join_code is null then
    new.join_code := public.crm_generate_join_code();
  end if;

  return new;
end;
$$;

drop trigger if exists crm_groups_set_code on public.crm_groups;

create trigger crm_groups_set_code
  before insert on public.crm_groups
  for each row
  execute function public.tg_crm_group_code();

-- ---------------------------------------------------------------------
-- 2. O'quvchi kod bilan qo'shiladi
--
--    Bir guruhga ikki marta qo'shilib bo'lmaydi. Agar o'qituvchi
--    o'quvchini qo'lda kiritgan bo'lsa, ikkita yozuv paydo bo'lishi
--    mumkin — ularni 8-banddagi birlashtirish tuzatadi.
-- ---------------------------------------------------------------------
create or replace function public.crm_join_group(p_code text)
returns table (group_id bigint, group_title text, already boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_group public.crm_groups%rowtype;
  v_name  text;
  v_exists bigint;
begin
  if v_user is null then
    raise exception 'Avval tizimga kiring';
  end if;

  select * into v_group
  from public.crm_groups
  where join_code = upper(btrim(coalesce(p_code, '')))
    and is_active = true;

  if not found then
    raise exception 'Bunday kod topilmadi';
  end if;

  select s.id into v_exists
  from public.crm_students s
  where s.group_id = v_group.id
    and s.user_id = v_user
  limit 1;

  if v_exists is not null then
    -- Chiqarib yuborilgan bo'lsa qaytadan faollashtiramiz
    update public.crm_students set is_active = true where id = v_exists;

    return query select v_group.id::bigint, v_group.title::text, true;
    return;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'Ism ko''rsatilmagan')
  into v_name
  from public.profiles p
  where p.id = v_user;

  insert into public.crm_students (group_id, full_name, user_id)
  values (v_group.id, coalesce(v_name, 'Ism ko''rsatilmagan'), v_user);

  return query select v_group.id::bigint, v_group.title::text, false;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Onlayn uy vazifasi uchun tanga
--
--    Qoida bitta va hamma guruhga umumiy — offline'dagi kabi har
--    guruhga alohida sozlash bu yerda ortiqcha bo'lardi.
-- ---------------------------------------------------------------------
create table if not exists public.online_coin_rules (
  id             boolean primary key default true check (id),
  homework_coins integer not null default 10,  -- 100% uchun
  ontime_bonus   integer not null default 3    -- muddatida bajarsa
);

insert into public.online_coin_rules (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.online_coin_awards (
  id            bigint generated always as identity primary key,
  user_id       uuid    not null references auth.users(id) on delete cascade,
  assignment_id bigint  not null references public.assignments(id) on delete cascade,
  coins         integer not null,
  created_at    timestamptz not null default now(),
  unique (user_id, assignment_id)
);

create index if not exists online_coin_awards_user_idx
  on public.online_coin_awards (user_id);

/*
 * Yig'ish.
 *
 * Tugallangan vazifalarni ko'rib chiqadi va hali tanga
 * berilmaganlariga tanga yozadi. Takror yozilmaydi — unique
 * cheklovi bor.
 */
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
    v_rules.homework_coins := 10;
    v_rules.ontime_bonus   := 3;
  end if;

  insert into public.online_coin_awards (user_id, assignment_id, coins)
  select
    att.user_id,
    att.assignment_id,
    greatest(
      0,
      round(
        coalesce(att.percentage, 0) * v_rules.homework_coins / 100.0
      )::int
      + case
          when att.completed_at <= a.due_at then v_rules.ontime_bonus
          else 0
        end
    )
  from public.attempts att
  join public.assignments a on a.id = att.assignment_id
  where att.user_id = v_user
    and att.assignment_id is not null
    and att.completed_at is not null
  on conflict (user_id, assignment_id) do nothing;

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Sovg'a so'rovi: holat va egasi
--
--    student_id endi majburiy emas — saytdagi o'quvchi offline
--    guruhda bo'lmasligi ham mumkin.
-- ---------------------------------------------------------------------
alter table public.crm_redemptions
  alter column student_id drop not null;

alter table public.crm_redemptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.crm_redemptions
  add column if not exists status text not null default 'topshirildi';

alter table public.crm_redemptions
  add column if not exists confirmed_at timestamptz;

do $$
begin
  alter table public.crm_redemptions
    drop constraint if exists crm_redemptions_status_check;

  alter table public.crm_redemptions
    add constraint crm_redemptions_status_check
    check (status in ('kutilmoqda', 'topshirildi'));
end $$;

create index if not exists crm_redemptions_user_idx
  on public.crm_redemptions (user_id);

-- ---------------------------------------------------------------------
-- 5. Hamyon balansi
--
--    Ikki xil egasi bor:
--      · saytda hisobi bor    -> p_user_id
--      · faqat ro'yxatda      -> p_student_id
--
--    Hisobi bor o'quvchida uning BARCHA offline guruhlaridagi
--    tangalari qo'shiladi.
-- ---------------------------------------------------------------------
create or replace function public.coin_balance(
  p_user_id    uuid    default null,
  p_student_id bigint  default null
)
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
  with wallet_students as (
    select s.id
    from public.crm_students s
    where (p_user_id is not null and s.user_id = p_user_id)
       or (p_user_id is null and s.id = p_student_id)
  ),
  offline_earned as (
    select coalesce(sum(d.coins), 0)::int as total
    from public.crm_daily_records d
    where d.student_id in (select id from wallet_students)
  ),
  online_earned as (
    select coalesce(sum(w.coins), 0)::int as total
    from public.online_coin_awards w
    where p_user_id is not null and w.user_id = p_user_id
  ),
  spent as (
    select coalesce(sum(r.cost_coins), 0)::int as total
    from public.crm_redemptions r
    where (p_user_id is not null and r.user_id = p_user_id)
       or r.student_id in (select id from wallet_students)
  )
  select
    (offline_earned.total + online_earned.total),
    spent.total,
    (offline_earned.total + online_earned.total - spent.total)
  from offline_earned, online_earned, spent;
$$;

/* O'quvchining o'z balansi */
create or replace function public.my_coin_balance()
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
  select * from public.coin_balance(auth.uid(), null);
$$;

-- ---------------------------------------------------------------------
-- 6. O'quvchiga ochiq sovg'alar
--
--    Umumiy sovg'alar (group_id null) hammaga, guruh sovg'asi esa
--    faqat o'sha guruh a'zosiga ko'rinadi.
-- ---------------------------------------------------------------------
create or replace function public.my_reward_list()
returns table (
  id          bigint,
  title       text,
  description text,
  cost_coins  integer,
  stock       integer,
  icon        text,
  group_title text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id::bigint,
    w.title::text,
    w.description::text,
    w.cost_coins,
    w.stock,
    w.icon::text,
    g.title::text
  from public.crm_rewards w
  left join public.crm_groups g on g.id = w.group_id
  where w.is_active = true
    and auth.uid() is not null
    and (
      w.group_id is null
      or exists (
        select 1 from public.crm_students s
        where s.group_id = w.group_id
          and s.user_id = auth.uid()
          and s.is_active = true
      )
    )
  order by w.cost_coins asc, w.title asc;
$$;

-- ---------------------------------------------------------------------
-- 7. O'quvchi sovg'a so'raydi
--
--    Tanga darhol ushlab qolinadi. Sovg'a "kutilmoqda" bo'lib
--    turadi, o'qituvchi topshirganda tasdiqlaydi.
-- ---------------------------------------------------------------------
create or replace function public.request_reward(p_reward_id bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_reward    public.crm_rewards%rowtype;
  v_available integer;
  v_student   bigint;
  v_id        bigint;
begin
  if v_user is null then
    raise exception 'Avval tizimga kiring';
  end if;

  select * into v_reward
  from public.crm_rewards where id = p_reward_id
  for update;

  if not found or v_reward.is_active = false then
    raise exception 'Sovg''a mavjud emas';
  end if;

  /* Guruh sovg'asi bo'lsa, o'quvchi o'sha guruhda bo'lishi shart */
  if v_reward.group_id is not null then
    select s.id into v_student
    from public.crm_students s
    where s.group_id = v_reward.group_id
      and s.user_id = v_user
      and s.is_active = true
    limit 1;

    if v_student is null then
      raise exception 'Bu sovg''a boshqa guruh uchun';
    end if;
  end if;

  if v_reward.stock is not null and v_reward.stock <= 0 then
    raise exception 'Sovg''a tugagan';
  end if;

  select b.available_coins into v_available
  from public.coin_balance(v_user, null) b;

  if coalesce(v_available, 0) < v_reward.cost_coins then
    raise exception 'Tanga yetarli emas: % ta bor, % ta kerak',
      coalesce(v_available, 0), v_reward.cost_coins;
  end if;

  insert into public.crm_redemptions (
    student_id, user_id, reward_id, reward_title, cost_coins, status
  )
  values (
    v_student, v_user, v_reward.id, v_reward.title,
    v_reward.cost_coins, 'kutilmoqda'
  )
  returning id into v_id;

  if v_reward.stock is not null then
    update public.crm_rewards set stock = stock - 1 where id = v_reward.id;
  end if;

  return v_id;
end;
$$;

/* O'quvchining so'rovlari tarixi */
create or replace function public.my_redemptions()
returns table (
  id           bigint,
  reward_title text,
  cost_coins   integer,
  status       text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id::bigint,
    r.reward_title::text,
    r.cost_coins,
    r.status::text,
    r.created_at
  from public.crm_redemptions r
  where r.user_id = auth.uid()
  order by r.created_at desc
  limit 50;
$$;

-- ---------------------------------------------------------------------
-- 8. O'qituvchi: so'rovni tasdiqlash
-- ---------------------------------------------------------------------
create or replace function public.crm_confirm_redemption(p_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_teacher() then
    raise exception 'Ruxsat yo''q';
  end if;

  update public.crm_redemptions
  set status = 'topshirildi',
      confirmed_at = now()
  where id = p_id;
end;
$$;

/* Kutayotgan so'rovlar — o'qituvchi ekrani uchun */
create or replace function public.crm_pending_redemptions()
returns table (
  id           bigint,
  full_name    text,
  reward_title text,
  cost_coins   integer,
  group_title  text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id::bigint,
    coalesce(
      nullif(btrim(p.full_name), ''),
      nullif(btrim(s.full_name), ''),
      'Ism ko''rsatilmagan'
    )::text,
    r.reward_title::text,
    r.cost_coins,
    g.title::text,
    r.created_at
  from public.crm_redemptions r
  left join public.profiles p     on p.id = r.user_id
  left join public.crm_students s on s.id = r.student_id
  left join public.crm_groups g   on g.id = s.group_id
  where r.status = 'kutilmoqda'
    and public.is_teacher()
  order by r.created_at asc;
$$;

-- ---------------------------------------------------------------------
-- 9. Ikkita yozuvni birlashtirish
--
--    O'qituvchi o'quvchini qo'lda kiritgan, keyin o'quvchi kod
--    bilan o'zi qo'shilgan bo'lsa ikkita yozuv paydo bo'ladi.
--    Bu funksiya ularni bittaga qo'shadi: darslar va sovg'alar
--    saqlanadigan yozuvga ko'chadi.
-- ---------------------------------------------------------------------
create or replace function public.crm_merge_students(
  p_keep_id   bigint,
  p_remove_id bigint
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_keep   public.crm_students%rowtype;
  v_remove public.crm_students%rowtype;
begin
  if not public.is_teacher() then
    raise exception 'Ruxsat yo''q';
  end if;

  if p_keep_id = p_remove_id then
    raise exception 'Bir xil o''quvchi tanlangan';
  end if;

  select * into v_keep   from public.crm_students where id = p_keep_id;
  select * into v_remove from public.crm_students where id = p_remove_id;

  if v_keep.id is null or v_remove.id is null then
    raise exception 'O''quvchi topilmadi';
  end if;

  if v_keep.group_id <> v_remove.group_id then
    raise exception 'Ikkalasi bir guruhda bo''lishi kerak';
  end if;

  /*
   * Bir kunda ikkalasida ham yozuv bo'lsa, saqlanadiganiniki
   * ustun turadi — ikkinchisi tashlab yuboriladi. Aks holda
   * unique (lesson_id, student_id) cheklovi buzilardi.
   */
  delete from public.crm_daily_records d
  where d.student_id = p_remove_id
    and exists (
      select 1 from public.crm_daily_records k
      where k.student_id = p_keep_id
        and k.lesson_id = d.lesson_id
    );

  update public.crm_daily_records
  set student_id = p_keep_id
  where student_id = p_remove_id;

  update public.crm_redemptions
  set student_id = p_keep_id
  where student_id = p_remove_id;

  /* Sayt hisobi qaysi birida bo'lsa, saqlanadiganiga ko'chadi */
  if v_keep.user_id is null and v_remove.user_id is not null then
    update public.crm_students
    set user_id = v_remove.user_id
    where id = p_keep_id;
  end if;

  update public.crm_students
  set phone = coalesce(v_keep.phone, v_remove.phone)
  where id = p_keep_id;

  delete from public.crm_students where id = p_remove_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Guruh balanslari — endi umumiy hamyon bo'yicha
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
    b.earned_coins,
    b.spent_coins,
    b.available_coins
  from public.crm_students s
  cross join lateral public.coin_balance(s.user_id, s.id) b
  where s.group_id = p_group_id
    and s.is_active = true
    and public.is_teacher()
  order by b.available_coins desc, s.full_name asc;
$$;

-- ---------------------------------------------------------------------
-- 11. Eski funksiyalarni yangi hamyonga moslash
-- ---------------------------------------------------------------------

/* Bitta o'quvchining balansi — endi onlayn tangalarni ham qo'shadi */
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
  select b.earned_coins, b.spent_coins, b.available_coins
  from public.crm_students s
  cross join lateral public.coin_balance(s.user_id, s.id) b
  where s.id = p_student_id
    and public.is_teacher();
$$;

/*
 * Almashtirishlar tarixi.
 *
 * Endi `left join`: saytdagi o'quvchi offline guruhda bo'lmasligi
 * ham mumkin, u holda student_id bo'sh bo'ladi va ilgarigi
 * `join` bunday yozuvni butunlay yashirib qo'yardi.
 */
drop function if exists public.crm_redemption_history(bigint);

create function public.crm_redemption_history(p_group_id bigint)
returns table (
  id           bigint,
  student_id   bigint,
  full_name    text,
  reward_title text,
  cost_coins   integer,
  status       text,
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
    coalesce(
      nullif(btrim(s.full_name), ''),
      nullif(btrim(p.full_name), ''),
      'Ism ko''rsatilmagan'
    )::text,
    r.reward_title::text,
    r.cost_coins,
    r.status::text,
    r.note::text,
    r.created_at
  from public.crm_redemptions r
  left join public.crm_students s on s.id = r.student_id
  left join public.profiles p     on p.id = r.user_id
  where public.is_teacher()
    and (
      s.group_id = p_group_id
      or (
        r.student_id is null
        and exists (
          select 1 from public.crm_students x
          where x.group_id = p_group_id
            and x.user_id = r.user_id
        )
      )
    )
  order by r.created_at desc
  limit 100;
$$;

grant execute on function public.crm_student_balance(bigint)            to authenticated;
grant execute on function public.crm_redemption_history(bigint)         to authenticated;
grant execute on function public.crm_generate_join_code()               to authenticated;
grant execute on function public.crm_join_group(text)                   to authenticated;
grant execute on function public.award_online_coins()                   to authenticated;
grant execute on function public.coin_balance(uuid, bigint)             to authenticated;
grant execute on function public.my_coin_balance()                      to authenticated;
grant execute on function public.my_reward_list()                       to authenticated;
grant execute on function public.request_reward(bigint)                 to authenticated;
grant execute on function public.my_redemptions()                       to authenticated;
grant execute on function public.crm_confirm_redemption(bigint)         to authenticated;
grant execute on function public.crm_pending_redemptions()              to authenticated;
grant execute on function public.crm_merge_students(bigint, bigint)     to authenticated;
grant execute on function public.crm_group_balances(bigint)             to authenticated;

revoke execute on function public.crm_generate_join_code() from anon;
