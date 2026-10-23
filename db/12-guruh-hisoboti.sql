-- =====================================================================
--  12-fayl: guruh bo'yicha umumiy hisobot
--
--  Hozir har bir vazifa natijasini alohida ko'rish mumkin, lekin
--  "bu o'quvchi umuman qanday o'qiyapti" yoki "sinf qaysi mavzuda
--  qoqilyapti" degan savolga javob yo'q. Ma'lumot bazada bor, faqat
--  yig'ib berish kerak.
--
--  Ikkita funksiya:
--    1. group_student_report  — har bir o'quvchi bo'yicha yakun
--    2. group_weak_tests      — sinf eng yomon ishlagan vazifalar
--
--  Ikkalasi ham faqat o'qituvchi uchun.
--
--  Supabase → SQL Editor → Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O'quvchilar kesimida
--
--    Har bir a'zo uchun: nechta vazifa berilgan, nechtasini ishlagan,
--    o'rtacha foizi qancha va oxirgi marta qachon ishlagan.
--
--    Vazifa "berilgan" deb hisoblanadi, agar u o'quvchi guruhga
--    qo'shilgandan keyin berilgan bo'lsa. Aks holda kechroq
--    qo'shilgan o'quvchi eski vazifalar uchun "ishlamadi" deb
--    ko'rinib qolardi.
-- ---------------------------------------------------------------------
create or replace function public.group_student_report(p_group_id bigint)
returns table (
  user_id          uuid,
  full_name        text,
  assigned_count   integer,
  completed_count  integer,
  average_percent  numeric,
  last_activity    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    coalesce(nullif(btrim(p.full_name), ''), 'Ism ko''rsatilmagan')::text,

    count(a.id) filter (
      where a.id is not null
    )::int as assigned_count,

    count(att.id)::int as completed_count,

    case
      when count(att.id) > 0
        then round(avg(att.percentage), 0)
      else 0
    end as average_percent,

    max(att.completed_at) as last_activity

  from public.study_group_members m
  join public.profiles p on p.id = m.user_id

  left join public.assignments a
    on a.group_id = m.group_id
   and a.created_at >= m.joined_at

  left join public.attempts att
    on att.assignment_id = a.id
   and att.user_id = m.user_id

  where m.group_id = p_group_id
    and public.is_teacher()

  group by m.user_id, p.full_name
  order by
    case when count(att.id) > 0 then round(avg(att.percentage), 0) else -1 end desc,
    p.full_name asc;
$$;

-- ---------------------------------------------------------------------
-- 2. Eng qiyin kelgan vazifalar
--
--    Sinfning o'rtacha natijasi past bo'lgan vazifalar tepada.
--    Shu ro'yxat qaysi mavzuni qayta tushuntirish kerakligini
--    ko'rsatadi.
-- ---------------------------------------------------------------------
create or replace function public.group_weak_tests(p_group_id bigint)
returns table (
  assignment_id   bigint,
  test_id         bigint,
  test_title      text,
  due_at          timestamptz,
  attempts_count  integer,
  average_percent numeric,
  lowest_percent  numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id::bigint,
    t.id::bigint,
    t.title::text,
    a.due_at,
    count(att.id)::int,
    case
      when count(att.id) > 0 then round(avg(att.percentage), 0)
      else 0
    end,
    coalesce(min(att.percentage), 0)
  from public.assignments a
  join public.tests t on t.id = a.test_id
  left join public.attempts att on att.assignment_id = a.id
  where a.group_id = p_group_id
    and public.is_teacher()
  group by a.id, t.id, t.title, a.due_at
  having count(att.id) > 0
  order by round(avg(att.percentage), 0) asc, a.due_at desc;
$$;

grant execute on function public.group_student_report(bigint) to authenticated;
grant execute on function public.group_weak_tests(bigint)     to authenticated;
