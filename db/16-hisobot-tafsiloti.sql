-- =====================================================================
--  16-fayl: guruh hisobotining tafsiloti
--
--  12-fayl har bir o'quvchi bo'yicha YAKUNIY sonlarni beradi:
--  nechta vazifa, nechtasi bajarilgan, o'rtacha foiz.
--
--  Ota-onalar yig'ilishiga chiqariladigan varaq uchun esa har bir
--  vazifa alohida kerak: qaysi test, muddati qachon edi, bola
--  necha foiz oldi, umuman ishladimi.
--
--  Shu funksiya aynan shuni beradi — o'quvchi va vazifa kesimida
--  bitta ro'yxat. Guruhlash sayt tomonida bajariladi.
--
--  12-fayldagi qoida bu yerda ham amal qiladi: o'quvchi guruhga
--  qo'shilishidan OLDIN berilgan vazifalar hisobga olinmaydi.
--  Aks holda kechroq kelgan bola eski vazifalar uchun "ishlamadi"
--  deb ko'rinib qolardi.
--
--  Faqat o'qituvchi uchun. Supabase -> SQL Editor -> Run.
--  Qayta ishga tushirish xavfsiz.
-- =====================================================================

create or replace function public.group_report_details(p_group_id bigint)
returns table (
  user_id       uuid,
  full_name     text,
  assignment_id bigint,
  test_title    text,
  due_at        timestamptz,
  is_active     boolean,
  percentage    numeric,
  completed_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    coalesce(nullif(btrim(p.full_name), ''), 'Ism ko''rsatilmagan')::text,
    a.id::bigint,
    t.title::text,
    a.due_at,
    a.is_active,
    att.percentage,
    att.completed_at
  from public.study_group_members m
  join public.profiles p    on p.id = m.user_id
  join public.assignments a on a.group_id = m.group_id
                           and a.created_at >= m.joined_at
  join public.tests t       on t.id = a.test_id
  left join public.attempts att on att.assignment_id = a.id
                               and att.user_id = m.user_id
  where m.group_id = p_group_id
    and public.is_teacher()
  order by p.full_name asc, a.due_at asc, a.id asc;
$$;

grant execute on function public.group_report_details(bigint) to authenticated;
