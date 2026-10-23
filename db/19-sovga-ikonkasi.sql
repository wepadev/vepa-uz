-- =====================================================================
--  19-fayl: sovg'aga ikonka
--
--  Do'kondagi sovg'alar bir xil ko'rinishda edi. Endi har biriga
--  ikonka tanlanadi — o'quvchi ro'yxatga qarab darrov nima ekanini
--  tushunadi.
--
--  Bazada faqat ikonka nomi saqlanadi (masalan 'notebook'). Nom
--  qaysi rasmga mos kelishi sayt tomonida, `lib/reward-icons.ts`
--  faylida yozilgan. Shu sababli ikonkani almashtirish yoki yangi
--  qo'shish uchun bazaga tegish shart emas.
--
--  Nom noma'lum bo'lsa sayt oddiy sovg'a ikonkasini ko'rsatadi —
--  ya'ni eski yozuvlar ham buzilmaydi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  18-fayldan keyin ishlating.
-- =====================================================================

alter table public.crm_rewards
  add column if not exists icon text;

/*
 * Ro'yxat funksiyasi endi ikonkani ham qaytaradi.
 *
 * DIQQAT: avval o'chirish shart. `create or replace` funksiya
 * qaytaradigan ustunlar ro'yxatini o'zgartira olmaydi va
 * "cannot change return type of existing function" xatosini beradi.
 */
drop function if exists public.crm_reward_list(bigint);

create function public.crm_reward_list(p_group_id bigint default null)
returns table (
  id          bigint,
  group_id    bigint,
  title       text,
  description text,
  cost_coins  integer,
  stock       integer,
  is_active   boolean,
  icon        text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id::bigint,
    w.group_id::bigint,
    w.title::text,
    w.description::text,
    w.cost_coins,
    w.stock,
    w.is_active,
    w.icon::text
  from public.crm_rewards w
  where public.is_teacher()
    and (
      p_group_id is null
      or w.group_id is null
      or w.group_id = p_group_id
    )
  order by w.is_active desc, w.cost_coins asc, w.title asc;
$$;

grant execute on function public.crm_reward_list(bigint) to authenticated;
