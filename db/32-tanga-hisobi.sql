-- =====================================================================
--  32-fayl: tanga jami balldan hisoblanadi
--
--  MUAMMO. "10 ball = 1 tanga" deyilgan, lekin amalda tanga har bir
--  dars uchun ALOHIDA hisoblanardi va qoldiq har safar tashlab
--  yuborilardi:
--
--      1-dars 54 ball -> 5 tanga (4 ball yo'qoladi)
--      2-dars 50 ball -> 5 tanga
--      3-dars 48 ball -> 4 tanga (8 ball yo'qoladi)
--      -----------------------------------------
--      jami  152 ball -> 14 tanga, 15 emas
--
--  Onlayn uy vazifasida ham xuddi shunday edi.
--
--  YECHIM. Tanga endi bitta joyda, JAMI balldan hisoblanadi:
--
--      tanga = jami ball / qoida (butun qismi)
--
--  Ya'ni 152 ball -> 15 tanga. Qoldiq (2 ball) yo'qolmaydi,
--  keyingi darsdagi ball ustiga qo'shilib boraveradi.
--
--  MUHIM: bu o'zgarish tangani faqat KO'PAYTIRADI. Hech kimning
--  balansi kamaymaydi, sarflangan tanga tarixiga tegilmaydi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  31-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O'quvchining guruhdagi jami hisobi
--
--    `coins` ustuni endi yig'indi emas — jami balldan olinadi.
--    Guruhning o'z qoidasi bo'lsa (crm_point_rules) o'sha, bo'lmasa
--    standart 10 ball = 1 tanga ishlatiladi.
-- ---------------------------------------------------------------------
create or replace view public.crm_student_totals as
select
  s.id            as student_id,
  s.group_id,
  s.user_id,
  s.full_name,
  total.points,
  /*
   * Jami balldan hisoblangan tanga. Ikkinchi qiymat — eski
   * usulda yozib qo'yilgan tangalar yig'indisi. Kattasi olinadi:
   * shunda hech kimning balansi kamayib qolmaydi (masalan ball
   * yozilmay, faqat tanga yozilgan eski yozuvlarda).
   */
  greatest(
    case
      when rule.rate > 0 then (total.points / rule.rate)
      else 0
    end,
    total.stored_coins
  )::int as coins
from public.crm_students s
left join lateral (
  select coalesce(
    (
      select sum(r.coins_per_points)::int
      from public.crm_point_rules r
      where r.group_id = s.group_id
    ),
    10
  ) as rate
) rule on true
left join lateral (
  select
    (
      coalesce(
        (
          select sum(d.points)::int
          from public.crm_daily_records d
          where d.student_id = s.id
        ),
        0
      )
      +
      coalesce(
        (
          select sum(w.points)::int
          from public.online_coin_awards w
          join public.assignments a on a.id = w.assignment_id
          join public.crm_groups g  on g.study_group_id = a.group_id
          where w.user_id = s.user_id
            and g.id = s.group_id
        ),
        0
      )
    ) as points,
    (
      coalesce(
        (
          select sum(d.coins)::int
          from public.crm_daily_records d
          where d.student_id = s.id
        ),
        0
      )
      +
      coalesce(
        (
          select sum(w.coins)::int
          from public.online_coin_awards w
          join public.assignments a on a.id = w.assignment_id
          join public.crm_groups g  on g.study_group_id = a.group_id
          where w.user_id = s.user_id
            and g.id = s.group_id
        ),
        0
      )
    ) as stored_coins
) total on true;

alter view public.crm_student_totals set (security_invoker = true);

-- ---------------------------------------------------------------------
-- 2. Hamyon balansi ham shu qoidada
--
--    Ilgari balans `crm_daily_records.coins` va
--    `online_coin_awards.coins` ustunlarining yig'indisidan
--    olinardi — ya'ni o'sha qoldiqlar bilan. Endi u ham jami
--    balldan hisoblanadi.
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
  earned as (
    /*
     * Har bir guruh alohida sanaladi: guruhlarning tanga qoidasi
     * har xil bo'lishi mumkin.
     */
    select coalesce(sum(t.coins), 0)::int as total
    from public.crm_student_totals t
    where t.student_id in (select id from wallet_students)
  ),
  orphan_online as (
    /*
     * Guruh ro'yxatiga bog'lanmagan onlayn vazifa tangalari.
     *
     * Bunday holat kam uchraydi (o'quvchi guruhdan chiqarilgan,
     * lekin vazifani ilgari ishlagan), lekin yig'ilgan tanga
     * yo'qolib ketmasligi kerak.
     */
    select coalesce(sum(w.coins), 0)::int as total
    from public.online_coin_awards w
    join public.assignments a on a.id = w.assignment_id
    left join public.crm_groups g on g.study_group_id = a.group_id
    where p_user_id is not null
      and w.user_id = p_user_id
      and not exists (
        select 1
        from public.crm_students s2
        where s2.user_id = p_user_id
          and s2.group_id = g.id
      )
  ),
  spent as (
    select coalesce(sum(r.cost_coins), 0)::int as total
    from public.crm_redemptions r
    where (p_user_id is not null and r.user_id = p_user_id)
       or r.student_id in (select id from wallet_students)
  )
  select
    (earned.total + orphan_online.total),
    spent.total,
    (earned.total + orphan_online.total - spent.total)
  from earned, orphan_online, spent;
$$;

grant execute on function public.coin_balance(uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Guruh balanslari (o'qituvchi ekrani) ham shu qoidada
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
    t.student_id::bigint,
    t.full_name::text,
    t.coins,
    coalesce(spent.total, 0)::int,
    (t.coins - coalesce(spent.total, 0))::int
  from public.crm_student_totals t
  join public.crm_students s on s.id = t.student_id
  left join lateral (
    select coalesce(sum(r.cost_coins), 0)::int as total
    from public.crm_redemptions r
    where r.student_id = t.student_id
       or (t.user_id is not null and r.user_id = t.user_id)
  ) spent on true
  where t.group_id = p_group_id
    and s.is_active = true
    and public.is_teacher()
  order by (t.coins - coalesce(spent.total, 0)) desc, t.full_name asc;
$$;

grant execute on function public.crm_group_balances(bigint) to authenticated;
