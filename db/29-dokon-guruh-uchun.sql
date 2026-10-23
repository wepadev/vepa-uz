-- =====================================================================
--  29-fayl: do'kon faqat guruh o'quvchilari uchun
--
--  Tanga faqat guruh ichidagi ishdan yig'iladi: darsdagi ball va
--  guruhga berilgan uy vazifasi. Guruhga qo'shilmagan o'quvchida
--  tanga bo'lishi mumkin emas, demak do'konning unga keragi ham yo'q.
--
--  Ilgari bu qoida faqat sayt tomonida edi: do'kon havolasi hammaga
--  ko'rinardi, ichida esa "tanga yetarli emas" deb turardi. Endi
--  qoida bazaning o'zida:
--
--    · guruhda bo'lmagan o'quvchiga sovg'alar ro'yxati bo'sh qaytadi
--    · so'rov yuborishga urinsa aniq xato chiqadi
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  28-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O'quvchi biror guruhdami?
--
--    Ikkala ro'yxat ham tekshiriladi: kod bilan qo'shilgan
--    (`study_group_members`) va o'qituvchi qo'lda kiritgan
--    (`crm_students`). Ular bitta guruhning ikki yarmi.
-- ---------------------------------------------------------------------
create or replace function public.is_group_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.study_group_members m
      where m.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.crm_students s
      where s.user_id = auth.uid()
        and s.is_active = true
    );
$$;

grant execute on function public.is_group_student() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Sovg'alar ro'yxati — faqat guruh o'quvchisiga
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
    and public.is_group_student()
    and (
      w.group_id is null
      or exists (
        select 1
        from public.crm_students s
        where s.group_id = w.group_id
          and s.user_id = auth.uid()
          and s.is_active = true
      )
    )
  order by w.cost_coins asc, w.title asc;
$$;

grant execute on function public.my_reward_list() to authenticated;

-- ---------------------------------------------------------------------
-- 3. So'rov yuborish — guruhdan tashqarida ishlamaydi
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

  if not public.is_group_student() then
    raise exception 'Do''kon guruh o''quvchilari uchun. Avval ustozingiz bergan kod bilan guruhga qo''shiling';
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
    update public.crm_rewards
    set stock = greatest(0, stock - 1)
    where id = v_reward.id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.request_reward(bigint) to authenticated;
