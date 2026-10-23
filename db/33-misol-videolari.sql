-- =====================================================================
--  33-fayl: TOP kitoblarda har bir misolning o'z videoyechimi
--
--  ILGARI (9-fayl): video mavzuga biriktirilardi — bitta videoda
--  mavzuning hamma misollari yechilardi. Maktab darsliklari uchun bu
--  o'zini oqladi: u yerda mavzu kichik, misollar sanoqli.
--
--  TOP kitoblarda esa bitta mavzuda o'nlab misol bo'ladi va ularning
--  har biri alohida yechiladi. O'quvchi bitta uzun videodan o'ziga
--  kerak misolni qidirib o'tirmasligi kerak.
--
--  ENDI: TOP kitobning har bir mavzusi ostiga misollar ro'yxati
--  qo'shiladi, har bir misolning o'z video havolasi bo'ladi.
--
--  `topics.video_url` tegilmaydi va o'chirilmaydi:
--    - maktab darsliklari avvalgidek ishlashda davom etadi;
--    - TOP kitobda ham mavzuning umumiy videosi qolsa, u misollar
--      ro'yxatidan yuqorida ko'rsatiladi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  32-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mavzu misollari
--
--    `label` — misolning kitobdagi nomi. Erkin matn, chunki har bir
--    kitob o'zicha raqamlaydi: "12-misol", "1.24", "3-mashq".
--    Shuning uchun raqam emas, matn.
-- ---------------------------------------------------------------------
create table if not exists public.topic_examples (
  id           bigint generated always as identity primary key,
  topic_id     bigint not null references public.topics(id) on delete cascade,
  label        text   not null,
  video_url    text,
  order_number integer not null default 1,
  created_at   timestamptz not null default now()
);

comment on table public.topic_examples is
  'TOP kitob mavzusidagi misollar va ularning videoyechimlari.';

comment on column public.topic_examples.label is
  'Misolning kitobdagi nomi: "12-misol", "1.24". Erkin matn.';

create index if not exists topic_examples_topic_idx
  on public.topic_examples (topic_id, order_number, id);

-- ---------------------------------------------------------------------
-- 2. Ruxsatlar
--
--    O'qish — kirgan foydalanuvchiga. Premium to'sig'i bu yerda emas,
--    sahifada: mavzu videosi bilan ham shunday ishlaydi
--    (can_access_textbook, 9-fayl). Ikkala joyda ikki xil qoida
--    bo'lmasligi uchun ataylab shunday qoldirildi.
--
--    Yozish — faqat o'qituvchiga.
-- ---------------------------------------------------------------------
alter table public.topic_examples enable row level security;

drop policy if exists topic_examples_read    on public.topic_examples;
drop policy if exists topic_examples_teacher on public.topic_examples;

create policy topic_examples_read
  on public.topic_examples
  for select
  to authenticated
  using (true);

create policy topic_examples_teacher
  on public.topic_examples
  for all
  to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

grant select on public.topic_examples to authenticated;
grant insert, update, delete on public.topic_examples to authenticated;

-- ---------------------------------------------------------------------
-- 3. Mavzudagi misollar soni
--
--    Mavzular ro'yxatida har bir mavzu yonida "8 ta misol" yozilishi
--    kerak. Sahifa buni bitta so'rov bilan olsin deb funksiya qilindi:
--    aks holda har bir mavzu uchun alohida so'rov ketardi.
-- ---------------------------------------------------------------------
create or replace function public.topic_example_counts(p_textbook_id bigint)
returns table (
  topic_id    bigint,
  total       integer,
  with_video  integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id::bigint,
    count(e.id)::int,
    count(e.id) filter (
      where e.video_url is not null and btrim(e.video_url) <> ''
    )::int
  from public.topics t
  left join public.topic_examples e on e.topic_id = t.id
  where t.textbook_id = p_textbook_id
  group by t.id;
$$;

grant execute on function public.topic_example_counts(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Tartib raqamlarini tiklash
--
--    Misol o'chirilgandan keyin raqamlar orasida bo'shliq qolmasin.
--    Sayt o'chirishdan keyin shu funksiyani chaqiradi.
-- ---------------------------------------------------------------------
create or replace function public.renumber_topic_examples(p_topic_id bigint)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.topic_examples e
  set order_number = src.position
  from (
    select
      id,
      row_number() over (order by order_number, id) as position
    from public.topic_examples
    where topic_id = p_topic_id
  ) as src
  where src.id = e.id
    and e.order_number is distinct from src.position
    and public.is_teacher();
$$;

grant execute on function public.renumber_topic_examples(bigint) to authenticated;
