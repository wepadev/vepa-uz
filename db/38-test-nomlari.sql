-- =====================================================================
--  38-fayl: test nomlari mavzu ichida "1-test", "2-test", "3-test"
--
--  ILGARI: "8-mavzu, 1-test" — mavzu raqami test nomida turardi.
--  ENDI:   "1-test" — mavzu nomi sahifa sarlavhasida va videodarsga
--          test tanlash ro'yxatida alohida ko'rinadi.
--
--  Faqat "N-mavzu, K-test" ko'rinishidagi nomlar o'zgaradi, boshqa
--  nomlarga tegilmaydi. Savollar, natijalar va bog'lamlar
--  o'zgarmaydi (ular test id siga bog'langan).
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  Avval sayt yangi kod bilan deploy bo'lsin (PR: mavzu nomi
--  ko'rinadigan bo'lishi uchun), keyin ishga tushiring.
-- =====================================================================

update public.tests
set title = regexp_replace(title, '^\s*\d+\s*-\s*mavzu\s*,\s*', '')
where title ~ '^\s*\d+\s*-\s*mavzu\s*,\s*\d+\s*-\s*test\s*$';
