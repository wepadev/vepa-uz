-- =====================================================================
--  37-fayl: "Mustaqil ishlang" — ballsiz savol
--
--  KERAK: kitobdagi ba'zi topshiriqlarning variantlari ham, kalitdagi
--  javobi ham yo'q ("grafigini yasang", "nuqtalarni belgilang").
--  Ularni testda ko'rsatish kerak, lekin baholab bo'lmaydi.
--
--  YECHIM: `question_blocks` ga yangi tur — `self_study`.
--    - blokning `questions` qatori YO'Q. Ball `questions` bo'yicha
--      hisoblanadi (har savol 2 ball, submit_timed_test va
--      close_abandoned_sessions), shuning uchun bunday blok balga,
--      foizga va savollar soniga umuman ta'sir qilmaydi — bu
--      funksiyalarga tegish shart emas;
--    - videoyechim keyin qo'shiladi: `solution_video_url` ustuni.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  36-fayldan keyin ishlating.
-- =====================================================================

-- 1. Videoyechim havolasi (faqat mustaqil ish uchun ishlatiladi)
alter table public.question_blocks
  add column if not exists solution_video_url text;

comment on column public.question_blocks.solution_video_url is
  'Mustaqil ish (self_study) videoyechimi. Boshqa bloklarda video har bir savolning answer_keys qatorida.';

-- ---------------------------------------------------------------------
-- 2. `block_type` ga 'self_study' qiymatini ruxsat berish
--
--    Ustun bazada qanday yaratilgani repoda yozilmagan: enum bo'lishi
--    ham, `check` cheklovi bo'lishi ham mumkin. Ikkalasini ham
--    tekshiramiz va faqat kerak bo'lsa o'zgartiramiz.
-- ---------------------------------------------------------------------
do $$
declare
  v_type   text;
  v_con    record;
  v_values text;
begin
  select c.udt_name
  into v_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'question_blocks'
    and c.column_name = 'block_type';

  -- 2a. Enum bo'lsa — qiymat qo'shiladi
  if exists (select 1 from pg_type t where t.typname = v_type and t.typtype = 'e') then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = v_type
        and e.enumlabel = 'self_study'
    ) then
      execute format('alter type public.%I add value %L', v_type, 'self_study');
      raise notice 'Enum % ga self_study qo''shildi.', v_type;
    end if;
  end if;

  -- 2b. block_type ga tegishli check cheklovlari — qayta yoziladi
  for v_con in
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.conrelid = 'public.question_blocks'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%block_type%'
  loop
    if v_con.def ilike '%self_study%' then
      continue;
    end if;

    execute format('alter table public.question_blocks drop constraint %I', v_con.conname);
    raise notice 'Eski cheklov olib tashlandi: % (%)', v_con.conname, v_con.def;
  end loop;

  if not exists (
    select 1
    from pg_constraint con
    where con.conrelid = 'public.question_blocks'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%self_study%'
  ) and v_type in ('text', 'varchar') then
    alter table public.question_blocks
      add constraint question_blocks_block_type_check
      check (block_type in ('written_parts', 'shared_options', 'self_study'));
    raise notice 'Yangi cheklov qo''shildi.';
  end if;
end $$;
