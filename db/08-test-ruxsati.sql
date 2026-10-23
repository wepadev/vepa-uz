-- =====================================================================
--  8-fayl: testga ruxsatni sayt tomonidan so'rash
--
--  math_booster_can_access_test(test_id, user_id) allaqachon bor va
--  start_timed_test() uni ishlatadi — himoya o'sha yerda.
--
--  Bu fayl xavfsizlik qo'shmaydi. U shunchaki o'sha tekshiruvni
--  sahifaga ham ochadi, toki premium bo'lmagan o'quvchi testni
--  boshlashga urinib qizil xato ko'rmasin, balki kirishidayoq
--  "Premium kerak" degan tushunarli ekranni ko'rsin.
--
--  Foydalanuvchi id sini o'zi auth.uid() dan oladi — sayt tomondan
--  begona id yuborib bo'lmaydi.
--
--  Supabase → SQL Editor → Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

create or replace function public.can_access_test(p_test_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.math_booster_can_access_test(p_test_id, auth.uid()),
    false
  );
$$;

grant execute on function public.can_access_test(bigint) to authenticated;
