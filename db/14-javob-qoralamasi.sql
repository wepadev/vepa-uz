-- =====================================================================
--  14-fayl: test ishlashda javoblarni yo'qotmaslik
--
--  MUAMMO: o'quvchi 20 daqiqa test ishlaydi, telefon o'chib qoladi
--  yoki brauzer yopiladi — javoblar yo'qoladi. Sessiya serverda
--  ochiq turadi (07-fayl uni tiklaydi), lekin belgilangan javoblar
--  faqat brauzer xotirasida edi.
--
--  YECHIM: har bir javob belgilangan zahoti bazaga qoralama sifatida
--  yoziladi. Qaytib kirganda o'sha qoralamalar tiklanadi.
--
--  MUHIM: qoralama baholashda umuman ishtirok etmaydi. Yakuniy natija
--  ilgarigidek `submit_timed_test` ga yuborilgan javoblardan
--  hisoblanadi. Ya'ni bu fayl mavjud mantiqqa tegmaydi — faqat
--  yo'qolgan ishni qaytarish uchun zaxira.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Qoralama jadvali
--
--    session_id ataylab `text`: test_sessions.id loyihaga qarab uuid
--    yoki bigint bo'lishi mumkin. 07-fayl ham shu sababli matnga
--    o'giradi.
-- ---------------------------------------------------------------------
create table if not exists public.test_answer_drafts (
  session_id  text        not null,
  question_id bigint      not null,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  answer      text        not null default '',
  updated_at  timestamptz not null default now(),
  primary key (session_id, question_id)
);

create index if not exists test_answer_drafts_user_idx
  on public.test_answer_drafts (user_id);

/*
 * RLS yoqiladi, lekin biror siyosat yozilmaydi.
 *
 * Bu "hech kim to'g'ridan-to'g'ri o'qiy va yoza olmaydi" degani.
 * Jadvalga faqat quyidagi security definer funksiyalari orqali
 * murojaat qilinadi — ular sessiya kimniki ekanini o'zi tekshiradi.
 */
alter table public.test_answer_drafts enable row level security;

-- ---------------------------------------------------------------------
-- 2. Bitta javobni saqlash
--
--    Xato bo'lsa ham jimgina qaytadi: qoralama yozilmagani testni
--    to'xtatib qo'yishi mumkin emas.
-- ---------------------------------------------------------------------
create or replace function public.save_answer_draft(
  p_session_id  text,
  p_question_id bigint,
  p_answer      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or p_session_id is null then
    return;
  end if;

  -- Sessiya shu o'quvchiniki bo'lsin va hali ochiq bo'lsin
  if not exists (
    select 1
    from public.test_sessions s
    where s.id::text = p_session_id
      and s.user_id = v_user
      and s.submitted_at is null
      and s.expires_at > now()
  ) then
    return;
  end if;

  insert into public.test_answer_drafts (
    session_id, question_id, user_id, answer
  )
  values (
    p_session_id,
    p_question_id,
    v_user,
    left(coalesce(p_answer, ''), 500)
  )
  on conflict (session_id, question_id) do update
    set answer     = excluded.answer,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Sessiyaning barcha qoralamalarini o'qish
-- ---------------------------------------------------------------------
create or replace function public.load_answer_drafts(p_session_id text)
returns table (
  question_id bigint,
  answer      text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.question_id, d.answer
  from public.test_answer_drafts d
  where d.session_id = p_session_id
    and d.user_id = auth.uid()
  order by d.question_id;
$$;

-- ---------------------------------------------------------------------
-- 4. Test yuborilgach qoralamalar o'chadi
--
--    submit_timed_test funksiyasiga tegmaymiz — o'rniga sessiya
--    "yuborilgan" deb belgilanganda trigger ishga tushadi. Shu
--    sababli baholash mantiqi umuman o'zgarmaydi.
-- ---------------------------------------------------------------------
create or replace function public.tg_clear_answer_drafts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.submitted_at is not null and old.submitted_at is null then
    delete from public.test_answer_drafts
    where session_id = new.id::text;
  end if;

  return new;
end;
$$;

drop trigger if exists test_sessions_clear_drafts on public.test_sessions;

create trigger test_sessions_clear_drafts
  after update of submitted_at on public.test_sessions
  for each row
  execute function public.tg_clear_answer_drafts();

-- ---------------------------------------------------------------------
-- 5. Tashlab ketilgan sessiyalarning qoralamalarini tozalash
--
--    Trigger faqat yuborilgan sessiyani tozalaydi. Boshlab tashlab
--    ketilgan (muddati o'tgan) sessiyalarniki qolib ketadi —
--    vaqti-vaqti bilan shu funksiyani chaqirsangiz yetarli.
-- ---------------------------------------------------------------------
create or replace function public.purge_answer_drafts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.test_answer_drafts d
  where not exists (
    select 1
    from public.test_sessions s
    where s.id::text = d.session_id
      and s.submitted_at is null
      and s.expires_at > now()
  );

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

grant execute on function public.save_answer_draft(text, bigint, text) to authenticated;
grant execute on function public.load_answer_drafts(text)              to authenticated;
grant execute on function public.purge_answer_drafts()                 to authenticated;
