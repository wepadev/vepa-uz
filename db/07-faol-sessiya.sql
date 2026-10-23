-- =====================================================================
--  7-fayl: faol test sessiyasini topish
--
--  MUAMMO: test tugagach brauzerda "orqaga" bosilsa, o'quvchi
--  ?start=1 manziliga qaytardi va sahifa yangi sessiya ochib yuborardi.
--  Vaqt noldan ketardi, tashlab ketilsa esa 0 ballik urinish yozilardi.
--
--  YECHIM: endi sahifa manzilda buyruq kutmaydi. U shu funksiya orqali
--  "shu o'quvchining shu testda ochiq sessiyasi bormi?" deb so'raydi.
--  Bor bo'lsa — o'shani davom ettiradi. Yo'q bo'lsa — boshlash ekrani.
--  Sessiya esa faqat "Boshlash" tugmasi bosilganda (POST) ochiladi.
--
--  Qo'shimcha foyda: test yechayotganda sahifa yangilansa yoki aloqa
--  uzilib qayta kirilsa, o'sha sessiya qolgan vaqti bilan tiklanadi.
--
--  Supabase → SQL Editor → Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

create or replace function public.active_test_session(p_test_id bigint)
returns table (
  session_id        text,
  started_at        timestamptz,
  expires_at        timestamptz,
  remaining_seconds integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    -- id ustuni uuid yoki bigint bo'lishi mumkin, shuning uchun matnga
    -- o'giramiz — chaqiruvchi tomon uni baribir satr sifatida ishlatadi
    s.id::text,
    s.started_at,
    s.expires_at,
    greatest(
      0,
      ceil(extract(epoch from (s.expires_at - now())))
    )::integer
  from public.test_sessions s
  where s.user_id = auth.uid()
    and s.test_id = p_test_id
    and s.submitted_at is null
    and s.expires_at > now()
  order by s.started_at desc
  limit 1;
$$;

grant execute on function public.active_test_session(bigint) to authenticated;
