-- =====================================================================
--  21-fayl: guruhlarni birlashtirish va ball qoidasini soddalashtirish
--
--  MUAMMO 1: ikkita guruh tizimi bor edi.
--
--    · study_groups — saytdagi guruh: kod, a'zolar, uy vazifasi
--    · crm_groups   — offline guruh: davomat, xulq, ball, tanga
--
--  O'qituvchi bir sinfni ikki joyda yuritishga majbur edi, o'quvchi
--  esa ikkita kod kiritardi.
--
--  YECHIM: ikkalasi bir-biriga bog'lanadi. Ma'lumot ko'chirilmaydi —
--  uy vazifasi o'z joyida, davomat o'z joyida qoladi, lekin ular
--  bitta guruh sifatida ko'rinadi va bitta kod bilan ishlaydi.
--
--  Har qanday kod (saytniki yoki offline'niki) kiritilsa, o'quvchi
--  ikkala tomonga ham qo'shiladi.
--
--  MUAMMO 2: kunlik varaqda "Jami berilgan" maydoni ortiqcha edi.
--  Ball endi faqat uchta narsadan: davomat, xulq va ishlangan
--  masalalar sonidan hisoblanadi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  20-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bog'lanish
-- ---------------------------------------------------------------------
alter table public.crm_groups
  add column if not exists study_group_id bigint
    references public.study_groups(id) on delete set null;

create unique index if not exists crm_groups_study_group_idx
  on public.crm_groups (study_group_id)
  where study_group_id is not null;

-- ---------------------------------------------------------------------
-- 2. Guruh juftini yaratish yoki topish
--
--    Nomi bo'yicha yangi guruh yaratganda ikkala yarmi ham
--    yaratiladi va bog'lanadi. Mavjud guruhga ikkinchi yarmini
--    qo'shish uchun ham shu funksiya ishlatiladi.
-- ---------------------------------------------------------------------
create or replace function public.ensure_group_pair(
  p_crm_group_id   bigint default null,
  p_study_group_id bigint default null,
  p_title          text   default null
)
returns table (crm_group_id bigint, study_group_id bigint, title text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_crm   public.crm_groups%rowtype;
  v_study public.study_groups%rowtype;
  v_title text;
begin
  if not public.is_teacher() then
    raise exception 'Ruxsat yo''q';
  end if;

  if p_crm_group_id is not null then
    select * into v_crm from public.crm_groups where id = p_crm_group_id;
  elsif p_study_group_id is not null then
    select * into v_crm
    from public.crm_groups where study_group_id = p_study_group_id;
  end if;

  if p_study_group_id is not null then
    select * into v_study
    from public.study_groups where id = p_study_group_id;
  elsif v_crm.study_group_id is not null then
    select * into v_study
    from public.study_groups where id = v_crm.study_group_id;
  end if;

  v_title := coalesce(
    nullif(btrim(coalesce(p_title, '')), ''),
    v_crm.title,
    v_study.title,
    'Yangi guruh'
  );

  /* Saytdagi yarmi yo'q bo'lsa yaratamiz */
  if v_study.id is null then
    insert into public.study_groups (title, join_code, created_by)
    values (v_title, public.generate_join_code(), auth.uid())
    returning * into v_study;
  end if;

  /* Offline yarmi yo'q bo'lsa yaratamiz */
  if v_crm.id is null then
    insert into public.crm_groups (title, study_group_id)
    values (v_title, v_study.id)
    returning * into v_crm;
  elsif v_crm.study_group_id is null then
    update public.crm_groups
    set study_group_id = v_study.id
    where id = v_crm.id
    returning * into v_crm;
  end if;

  return query select v_crm.id::bigint, v_study.id::bigint, v_title;
end;
$$;

/*
 * Mavjud guruhlarga juftini yasab qo'yamiz.
 *
 * Yangi yozuvning raqami `returning` orqali olinadi. `max(id)` ga
 * tayanish xavfli edi: qo'shish biror sababdan o'tmasa, guruh
 * butunlay boshqa guruhga bog'lanib qolardi.
 */
do $$
declare
  v_crm    bigint;
  v_study  bigint;
  v_title  text;
  v_owner  uuid;
begin
  select p.id into v_owner
  from public.profiles p
  where p.role = 'admin' and p.is_active = true
  order by p.id
  limit 1;

  /* Offline guruhga saytdagi yarmini */
  for v_crm, v_title in
    select id, title from public.crm_groups where study_group_id is null
  loop
    insert into public.study_groups (title, join_code, created_by)
    values (v_title, public.generate_join_code(), v_owner)
    returning id into v_study;

    update public.crm_groups
    set study_group_id = v_study
    where id = v_crm;
  end loop;

  /* Saytdagi guruhga offline yarmini */
  for v_study, v_title in
    select s.id, s.title
    from public.study_groups s
    where not exists (
      select 1 from public.crm_groups c where c.study_group_id = s.id
    )
  loop
    insert into public.crm_groups (title, study_group_id)
    values (v_title, v_study);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Bitta kod — ikkala tomonga
--
--    O'quvchi qaysi kodni kiritsa ham (saytniki yoki offline'niki)
--    ikkala ro'yxatga ham tushadi: uy vazifasi ham keladi, dars
--    ballari ham yoziladi.
-- ---------------------------------------------------------------------
create or replace function public.join_group_by_code(p_code text)
returns table (
  crm_group_id bigint,
  group_title  text,
  already      boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_code   text := upper(btrim(coalesce(p_code, '')));
  v_crm    public.crm_groups%rowtype;
  v_study  public.study_groups%rowtype;
  v_name   text;
  v_had    boolean := false;
begin
  if v_user is null then
    raise exception 'Avval tizimga kiring';
  end if;

  /* Avval offline kodni, keyin saytdagi kodni qidiramiz */
  select * into v_crm
  from public.crm_groups
  where join_code = v_code and is_active = true;

  if found then
    select * into v_study
    from public.study_groups where id = v_crm.study_group_id;
  else
    select * into v_study
    from public.study_groups
    where join_code = v_code and is_active = true;

    if not found then
      raise exception 'Bunday kod topilmadi';
    end if;

    select * into v_crm
    from public.crm_groups where study_group_id = v_study.id;
  end if;

  /* Saytdagi a'zolik */
  if v_study.id is not null then
    v_had := exists (
      select 1 from public.study_group_members m
      where m.group_id = v_study.id and m.user_id = v_user
    );

    insert into public.study_group_members (group_id, user_id)
    values (v_study.id, v_user)
    on conflict do nothing;
  end if;

  /* Offline ro'yxat */
  if v_crm.id is not null then
    if exists (
      select 1 from public.crm_students s
      where s.group_id = v_crm.id and s.user_id = v_user
    ) then
      update public.crm_students
      set is_active = true
      where group_id = v_crm.id and user_id = v_user;

      v_had := true;
    else
      select coalesce(nullif(btrim(p.full_name), ''), 'Ism ko''rsatilmagan')
      into v_name
      from public.profiles p where p.id = v_user;

      insert into public.crm_students (group_id, full_name, user_id)
      values (v_crm.id, coalesce(v_name, 'Ism ko''rsatilmagan'), v_user);
    end if;
  end if;

  return query
  select
    v_crm.id::bigint,
    coalesce(v_crm.title, v_study.title)::text,
    v_had;
end;
$$;

/*
 * Eski nom bilan chaqirilsa ham ishlasin — 20-faylda yozilgan
 * `crm_join_group` endi shu yangi funksiyaga yo'naltiriladi.
 */
create or replace function public.crm_join_group(p_code text)
returns table (group_id bigint, group_title text, already boolean)
language sql
volatile
security definer
set search_path = public
as $$
  select crm_group_id, group_title, already
  from public.join_group_by_code(p_code);
$$;

-- ---------------------------------------------------------------------
-- 4. Ball qoidasi soddalashdi
--
--    "Jami berilgan" maydoni olib tashlandi. Ball uchta narsadan:
--    davomat, xulq bahosi va ishlangan masalalar soni.
--
--    `homework_total` ustuni jadvalda qoladi — eski yozuvlar
--    buzilmasin. Lekin hisobda ishlatilmaydi.
-- ---------------------------------------------------------------------
create or replace function public.crm_calculate_points(
  p_group_id       bigint,
  p_attendance     text,
  p_behavior       smallint,
  p_homework_done  integer,
  p_homework_total integer,
  p_bonus          integer
)
returns table (points integer, coins integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r      public.crm_point_rules%rowtype;
  v_base integer;
  v_all  integer;
begin
  select * into r from public.crm_point_rules where group_id = p_group_id;

  if not found then
    r.present_points       := 10;
    r.late_points          := 5;
    r.excused_points       := 2;
    r.absent_points        := 0;
    r.behavior_points      := 2;
    r.homework_item_points := 2;
    r.coins_per_points     := 10;
  end if;

  v_base := case p_attendance
    when 'keldi'    then r.present_points
    when 'kechikdi' then r.late_points
    when 'sababli'  then r.excused_points
    else                 r.absent_points
  end;

  /*
   * p_homework_total ataylab ishlatilmaydi. Parametr faqat eski
   * chaqiruvlar buzilmasligi uchun qoldirilgan.
   */
  v_all := v_base
    + coalesce(p_behavior, 0) * r.behavior_points
    + greatest(0, coalesce(p_homework_done, 0)) * r.homework_item_points
    + coalesce(p_bonus, 0);

  v_all := greatest(0, v_all);

  return query
  select
    v_all,
    case
      when r.coins_per_points > 0 then (v_all / r.coins_per_points)
      else 0
    end;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Guruhlarning umumiy ro'yxati
--
--    Bitta qatorda ikkala yarmining ma'lumoti: o'quvchilar soni,
--    darslar soni, faol uy vazifalari soni va ikkala kod.
-- ---------------------------------------------------------------------
create or replace function public.group_overview()
returns table (
  crm_group_id     bigint,
  study_group_id   bigint,
  title            text,
  is_active        boolean,
  join_code        text,
  student_count    integer,
  lesson_count     integer,
  assignment_count integer,
  last_lesson      date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id::bigint,
    g.study_group_id::bigint,
    g.title::text,
    g.is_active,
    coalesce(g.join_code, s.join_code)::text,
    (select count(*)::int from public.crm_students x
      where x.group_id = g.id and x.is_active = true),
    (select count(*)::int from public.crm_lessons l where l.group_id = g.id),
    (select count(*)::int from public.assignments a
      where a.group_id = g.study_group_id and a.is_active = true),
    (select max(l.lesson_date) from public.crm_lessons l where l.group_id = g.id)
  from public.crm_groups g
  left join public.study_groups s on s.id = g.study_group_id
  where public.is_teacher()
  order by g.is_active desc, g.title asc;
$$;

-- ---------------------------------------------------------------------
-- 6. Nomni ikkala tomonda birga o'zgartirish
-- ---------------------------------------------------------------------
create or replace function public.rename_group_pair(
  p_crm_group_id bigint,
  p_title        text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_study bigint;
begin
  if not public.is_teacher() then
    raise exception 'Ruxsat yo''q';
  end if;

  if length(btrim(coalesce(p_title, ''))) < 2 then
    raise exception 'Guruh nomi juda qisqa';
  end if;

  update public.crm_groups
  set title = btrim(p_title)
  where id = p_crm_group_id
  returning study_group_id into v_study;

  if v_study is not null then
    update public.study_groups
    set title = btrim(p_title)
    where id = v_study;
  end if;
end;
$$;

grant execute on function public.ensure_group_pair(bigint, bigint, text) to authenticated;
grant execute on function public.join_group_by_code(text)                to authenticated;
grant execute on function public.group_overview()                        to authenticated;
grant execute on function public.rename_group_pair(bigint, text)         to authenticated;
