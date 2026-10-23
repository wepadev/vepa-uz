-- =====================================================================
--  9-fayl: darslik yechimlarida videoni mavzu darajasiga ko'chirish
--
--  Ilgari har bir MISOL uchun alohida video havolasi bor edi
--  (exercises.video_url). Amalda esa bitta videoda mavzuning hamma
--  misollari yechiladi — har biriga alohida video olish real emas.
--
--  Shuning uchun video endi MAVZUGA biriktiriladi: topics.video_url.
--
--  Eski ustun o'chirilmaydi. Sabab: unda allaqachon havolalar bo'lishi
--  mumkin va ularni yo'qotib qo'ymaslik kerak. Pastda mavjud
--  havolalarni mavzu darajasiga ko'chirish ham bor.
--
--  Supabase → SQL Editor → Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mavzuga video ustuni
-- ---------------------------------------------------------------------
alter table public.topics
  add column if not exists video_url text;

comment on column public.topics.video_url is
  'Mavzu bo''yicha videoyechim. Bitta videoda mavzuning hamma misollari.';

-- ---------------------------------------------------------------------
-- 2. Eski havolalarni ko'chirish
--
--    Har bir mavzu uchun uning misollaridagi birinchi to'ldirilgan
--    havolani olamiz. Mavzuda allaqachon video bo'lsa tegilmaydi,
--    shuning uchun buni qayta ishga tushirish xavfsiz.
-- ---------------------------------------------------------------------
update public.topics t
set video_url = src.video_url
from (
  select distinct on (e.topic_id)
    e.topic_id,
    e.video_url
  from public.exercises e
  where e.video_url is not null
    and btrim(e.video_url) <> ''
  order by e.topic_id, e.order_number, e.id
) as src
where src.topic_id = t.id
  and (t.video_url is null or btrim(t.video_url) = '');

-- ---------------------------------------------------------------------
-- 3. Darslik turiga qarab ruxsat
--
--    Qoida: maktab darsliklari hamma uchun ochiq, TOP kitoblar
--    yechimlari faqat Premium uchun.
--
--    Funksiya sayt tomonidan chaqiriladi. Admin har doim ko'ra oladi.
-- ---------------------------------------------------------------------
create or replace function public.can_access_textbook(p_textbook_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_book_type text;
  v_role text;
  v_premium_until timestamptz;
begin
  if v_user_id is null then
    return false;
  end if;

  select book_type into v_book_type
  from public.textbooks
  where id = p_textbook_id;

  if v_book_type is null then
    return false;  -- bunday darslik yo'q
  end if;

  -- Maktab darsliklari hamma uchun
  if v_book_type = 'school' then
    return true;
  end if;

  select role, premium_until
  into v_role, v_premium_until
  from public.profiles
  where id = v_user_id;

  if v_role = 'admin' then
    return true;
  end if;

  return v_premium_until is not null
     and v_premium_until > now();
end;
$$;

grant execute on function public.can_access_textbook(bigint) to authenticated;
