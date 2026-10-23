-- =====================================================================
--  13-fayl: admin bosh sahifasi uchun umumiy ko'rsatkich
--
--  Muammo: bosh sahifa o'rtacha foizni hisoblash uchun barcha
--  tugatilgan urinishlarning `percentage` ustunini tortib olardi.
--  100 ta urinishda bu sezilmaydi, 50 000 tasida esa har safar
--  50 000 qator tarmoq orqali o'tadi va sahifa sekinlashadi.
--
--  Yechim: o'rtachani bazaning o'zi hisoblab, bitta son qaytaradi.
--
--  Faqat o'qituvchi uchun. Supabase -> SQL Editor -> Run.
--  Qayta ishga tushirish xavfsiz.
-- =====================================================================

create or replace function public.platform_average_percentage()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(round(avg(a.percentage), 1), 0)
  from public.attempts a
  where a.completed_at is not null
    and public.is_teacher();
$$;

grant execute on function public.platform_average_percentage() to authenticated;
