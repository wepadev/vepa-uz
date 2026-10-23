-- =====================================================================
--  17-fayl: offline guruhlar uchun CRM va ballar
--
--  Bu bo'lim saytdagi onlayn guruhlardan (study_groups) alohida.
--  Sabab: offline guruhda o'quvchining saytda hisobi bo'lmasligi
--  mumkin — u shunchaki ism sifatida ro'yxatda turadi. Hisobi
--  bo'lganlar esa `user_id` orqali bog'lanadi va kelajakda o'z
--  ballini profilida ko'ra oladi.
--
--  Har dars uchun o'qituvchi bitta varaqni to'ldiradi:
--      davomat  ·  xulq (1-5)  ·  uy vazifasi (nechtadan nechta)
--
--  Ball shu ma'lumotdan qoidaga ko'ra hisoblanadi. Qoidalar har
--  bir guruh uchun alohida sozlanadi.
--
--  MUHIM: hisoblangan ball va tanga yozuvning o'ziga saqlanadi.
--  Keyinchalik qoida o'zgartirilsa, eski kunlar qayta hisoblanmaydi
--  — aks holda o'tgan oyning natijalari to'satdan o'zgarib ketardi.
--
--  Faqat o'qituvchi uchun. Supabase -> SQL Editor -> Run.
--  Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Guruhlar
-- ---------------------------------------------------------------------
create table if not exists public.crm_groups (
  id          bigint generated always as identity primary key,
  title       text        not null,
  note        text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. O'quvchilar
--
--    user_id — ixtiyoriy. Bo'lsa, saytdagi hisob bilan bog'lanadi;
--    bo'lmasa o'quvchi faqat shu ro'yxatda yashaydi.
-- ---------------------------------------------------------------------
create table if not exists public.crm_students (
  id          bigint generated always as identity primary key,
  group_id    bigint      not null references public.crm_groups(id) on delete cascade,
  full_name   text        not null,
  phone       text,
  user_id     uuid        references auth.users(id) on delete set null,
  is_active   boolean     not null default true,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists crm_students_group_idx
  on public.crm_students (group_id);

-- ---------------------------------------------------------------------
-- 3. Dars kunlari
-- ---------------------------------------------------------------------
create table if not exists public.crm_lessons (
  id          bigint generated always as identity primary key,
  group_id    bigint      not null references public.crm_groups(id) on delete cascade,
  lesson_date date        not null,
  topic       text,
  created_at  timestamptz not null default now(),
  unique (group_id, lesson_date)
);

-- ---------------------------------------------------------------------
-- 4. Ball qoidalari
--
--    Har bir guruhda o'z qoidasi bo'lishi mumkin: kimdir davomatga
--    ko'proq, kimdir uy vazifasiga ko'proq ahamiyat beradi.
-- ---------------------------------------------------------------------
create table if not exists public.crm_point_rules (
  group_id             bigint primary key references public.crm_groups(id) on delete cascade,
  present_points       integer not null default 10,  -- keldi
  late_points          integer not null default 5,   -- kechikdi
  excused_points       integer not null default 2,   -- sababli
  absent_points        integer not null default 0,   -- kelmadi
  behavior_points      integer not null default 2,   -- xulq bahosi shu songa ko'paytiriladi
  homework_item_points integer not null default 2,   -- har bir ishlangan masala
  homework_full_bonus  integer not null default 5,   -- hammasini ishlaganga qo'shimcha
  coins_per_points     integer not null default 10   -- necha ball = 1 tanga
);

-- ---------------------------------------------------------------------
-- 5. Kunlik yozuv
-- ---------------------------------------------------------------------
create table if not exists public.crm_daily_records (
  id             bigint generated always as identity primary key,
  lesson_id      bigint   not null references public.crm_lessons(id) on delete cascade,
  student_id     bigint   not null references public.crm_students(id) on delete cascade,
  attendance     text     not null default 'kelmadi',
  behavior       smallint,
  homework_done  integer  not null default 0,
  homework_total integer  not null default 0,
  bonus_points   integer  not null default 0,
  note           text,
  points         integer  not null default 0,
  coins          integer  not null default 0,
  created_at     timestamptz not null default now(),
  unique (lesson_id, student_id),
  constraint crm_daily_attendance_check
    check (attendance in ('keldi', 'kechikdi', 'sababli', 'kelmadi')),
  constraint crm_daily_behavior_check
    check (behavior is null or behavior between 1 and 5)
);

create index if not exists crm_daily_student_idx
  on public.crm_daily_records (student_id);

/*
 * RLS: bu jadvallar butunlay o'qituvchiga tegishli.
 *
 * O'quvchi ularni na o'qiy, na yoza oladi. O'qituvchi esa
 * to'g'ridan-to'g'ri ham ishlay oladi — sayt tomonida guruh
 * yaratish, o'quvchi qo'shish kabi oddiy amallar uchun alohida
 * funksiya yozish ortiqcha bo'lardi.
 *
 * `using` — o'qish va o'zgartirish uchun.
 * `with check` — yangi qator yozishda ham shu shart tekshiriladi.
 */
alter table public.crm_groups        enable row level security;
alter table public.crm_students      enable row level security;
alter table public.crm_lessons       enable row level security;
alter table public.crm_point_rules   enable row level security;
alter table public.crm_daily_records enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'crm_groups',
    'crm_students',
    'crm_lessons',
    'crm_point_rules',
    'crm_daily_records'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      v_table || '_teacher', v_table
    );

    execute format(
      'create policy %I on public.%I
         for all to authenticated
         using (public.is_teacher())
         with check (public.is_teacher())',
      v_table || '_teacher', v_table
    );

    /*
     * RLS'dan tashqari jadval darajasidagi ruxsat ham kerak.
     * Supabase odatda uni o'zi beradi, lekin aniq yozib qo'ygan
     * ma'qul — aks holda "permission denied" chiqishi mumkin.
     */
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      v_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Ballni hisoblash
--
--    Alohida funksiya: kunlik varaqni saqlashda ham, ekranda
--    oldindan ko'rsatishda ham bir xil qoida ishlasin.
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
    -- Qoida yozilmagan bo'lsa standart qiymatlar ishlaydi
    r.present_points       := 10;
    r.late_points          := 5;
    r.excused_points       := 2;
    r.absent_points        := 0;
    r.behavior_points      := 2;
    r.homework_item_points := 2;
    r.homework_full_bonus  := 5;
    r.coins_per_points     := 10;
  end if;

  v_base := case p_attendance
    when 'keldi'    then r.present_points
    when 'kechikdi' then r.late_points
    when 'sababli'  then r.excused_points
    else                 r.absent_points
  end;

  v_all := v_base
    + coalesce(p_behavior, 0) * r.behavior_points
    + greatest(0, coalesce(p_homework_done, 0)) * r.homework_item_points
    + case
        when coalesce(p_homework_total, 0) > 0
         and coalesce(p_homework_done, 0) >= p_homework_total
        then r.homework_full_bonus
        else 0
      end
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
-- 7. Kunlik varaq — ekranga chiqarish uchun
--
--    Guruhning barcha faol o'quvchilari qaytadi. Shu sana uchun
--    yozuv bo'lsa — qiymatlari bilan, bo'lmasa bo'sh.
-- ---------------------------------------------------------------------
create or replace function public.crm_day_sheet(
  p_group_id bigint,
  p_date     date
)
returns table (
  student_id     bigint,
  full_name      text,
  has_account    boolean,
  attendance     text,
  behavior       smallint,
  homework_done  integer,
  homework_total integer,
  bonus_points   integer,
  note           text,
  points         integer,
  coins          integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id::bigint,
    s.full_name::text,
    s.user_id is not null,
    coalesce(d.attendance, 'keldi')::text,
    d.behavior,
    coalesce(d.homework_done, 0),
    coalesce(d.homework_total, 0),
    coalesce(d.bonus_points, 0),
    d.note::text,
    coalesce(d.points, 0),
    coalesce(d.coins, 0)
  from public.crm_students s
  left join public.crm_lessons l
    on l.group_id = s.group_id
   and l.lesson_date = p_date
  left join public.crm_daily_records d
    on d.lesson_id = l.id
   and d.student_id = s.id
  where s.group_id = p_group_id
    and s.is_active = true
    and public.is_teacher()
  order by s.full_name asc, s.id asc;
$$;

-- ---------------------------------------------------------------------
-- 8. Kunlik varaqni saqlash
--
--    Butun guruh bitta chaqiruvda yoziladi. Har safar qayta
--    yozilaveradi — o'qituvchi xatosini tuzatishi tabiiy.
--
--    p_rows ko'rinishi:
--      [{"student_id":1,"attendance":"keldi","behavior":4,
--        "homework_done":8,"homework_total":10,"bonus":0,"note":""}]
-- ---------------------------------------------------------------------
create or replace function public.crm_save_day(
  p_group_id bigint,
  p_date     date,
  p_topic    text,
  p_rows     jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson_id bigint;
  v_row       jsonb;
  v_count     integer := 0;
  v_points    integer;
  v_coins     integer;
  v_student   bigint;
begin
  if not public.is_teacher() then
    raise exception 'Ruxsat yo''q';
  end if;

  if not exists (select 1 from public.crm_groups g where g.id = p_group_id) then
    raise exception 'Guruh topilmadi';
  end if;

  insert into public.crm_lessons (group_id, lesson_date, topic)
  values (p_group_id, p_date, nullif(btrim(coalesce(p_topic, '')), ''))
  on conflict (group_id, lesson_date) do update
    set topic = coalesce(
      nullif(btrim(coalesce(excluded.topic, '')), ''),
      public.crm_lessons.topic
    )
  returning id into v_lesson_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_student := (v_row ->> 'student_id')::bigint;

    -- O'quvchi shu guruhdanmi? Boshqa guruhga yozib yubormaslik uchun
    if not exists (
      select 1 from public.crm_students s
      where s.id = v_student and s.group_id = p_group_id
    ) then
      continue;
    end if;

    select c.points, c.coins into v_points, v_coins
    from public.crm_calculate_points(
      p_group_id,
      coalesce(v_row ->> 'attendance', 'kelmadi'),
      nullif(v_row ->> 'behavior', '')::smallint,
      coalesce(nullif(v_row ->> 'homework_done', ''), '0')::integer,
      coalesce(nullif(v_row ->> 'homework_total', ''), '0')::integer,
      coalesce(nullif(v_row ->> 'bonus', ''), '0')::integer
    ) c;

    insert into public.crm_daily_records (
      lesson_id, student_id, attendance, behavior,
      homework_done, homework_total, bonus_points, note, points, coins
    )
    values (
      v_lesson_id,
      v_student,
      coalesce(v_row ->> 'attendance', 'kelmadi'),
      nullif(v_row ->> 'behavior', '')::smallint,
      coalesce(nullif(v_row ->> 'homework_done', ''), '0')::integer,
      coalesce(nullif(v_row ->> 'homework_total', ''), '0')::integer,
      coalesce(nullif(v_row ->> 'bonus', ''), '0')::integer,
      nullif(btrim(coalesce(v_row ->> 'note', '')), ''),
      v_points,
      v_coins
    )
    on conflict (lesson_id, student_id) do update
      set attendance     = excluded.attendance,
          behavior       = excluded.behavior,
          homework_done  = excluded.homework_done,
          homework_total = excluded.homework_total,
          bonus_points   = excluded.bonus_points,
          note           = excluded.note,
          points         = excluded.points,
          coins          = excluded.coins;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Guruh reytingi
--
--    Yig'ilgan ball, tanga va davomat foizi.
--    Sarflangan tangalar 18-faylda ayriladi — bu yerda faqat
--    ishlab topilgani.
-- ---------------------------------------------------------------------
create or replace function public.crm_group_ranking(p_group_id bigint)
returns table (
  student_id     bigint,
  full_name      text,
  has_account    boolean,
  total_points   integer,
  earned_coins   integer,
  lessons_count  integer,
  present_count  integer,
  homework_done  integer,
  homework_total integer,
  avg_behavior   numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id::bigint,
    s.full_name::text,
    s.user_id is not null,
    coalesce(sum(d.points), 0)::int,
    coalesce(sum(d.coins), 0)::int,
    count(d.id)::int,
    count(d.id) filter (where d.attendance in ('keldi', 'kechikdi'))::int,
    coalesce(sum(d.homework_done), 0)::int,
    coalesce(sum(d.homework_total), 0)::int,
    round(avg(d.behavior) filter (where d.behavior is not null), 1)
  from public.crm_students s
  left join public.crm_daily_records d on d.student_id = s.id
  where s.group_id = p_group_id
    and s.is_active = true
    and public.is_teacher()
  group by s.id, s.full_name, s.user_id
  order by coalesce(sum(d.points), 0) desc, s.full_name asc;
$$;

-- ---------------------------------------------------------------------
-- 10. Guruhlar ro'yxati
-- ---------------------------------------------------------------------
create or replace function public.crm_group_list()
returns table (
  id            bigint,
  title         text,
  is_active     boolean,
  student_count integer,
  lesson_count  integer,
  last_lesson   date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id::bigint,
    g.title::text,
    g.is_active,
    (select count(*)::int from public.crm_students s
      where s.group_id = g.id and s.is_active = true),
    (select count(*)::int from public.crm_lessons l where l.group_id = g.id),
    (select max(l.lesson_date) from public.crm_lessons l where l.group_id = g.id)
  from public.crm_groups g
  where public.is_teacher()
  order by g.is_active desc, g.title asc;
$$;

-- ---------------------------------------------------------------------
-- 11. Bitta o'quvchining tarixi
-- ---------------------------------------------------------------------
create or replace function public.crm_student_history(p_student_id bigint)
returns table (
  lesson_date    date,
  topic          text,
  attendance     text,
  behavior       smallint,
  homework_done  integer,
  homework_total integer,
  points         integer,
  coins          integer,
  note           text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.lesson_date,
    l.topic::text,
    d.attendance::text,
    d.behavior,
    d.homework_done,
    d.homework_total,
    d.points,
    d.coins,
    d.note::text
  from public.crm_daily_records d
  join public.crm_lessons l on l.id = d.lesson_id
  where d.student_id = p_student_id
    and public.is_teacher()
  order by l.lesson_date desc;
$$;

-- ---------------------------------------------------------------------
-- 12. Email bo'yicha sayt hisobini topish
--
--     O'quvchini saytdagi hisobiga bog'lash uchun. Email `auth.users`
--     jadvalida yotadi va unga oddiy so'rov bilan yetib bo'lmaydi —
--     shu funksiya orqali, faqat o'qituvchiga.
--
--     Faqat topilgan/topilmagani ma'lum bo'ladi: boshqa hech qanday
--     shaxsiy ma'lumot qaytmaydi.
-- ---------------------------------------------------------------------
create or replace function public.crm_find_user_by_email(p_email text)
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    coalesce(nullif(btrim(p.full_name), ''), '')::text
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.is_teacher()
    and lower(u.email) = lower(btrim(coalesce(p_email, '')))
  limit 1;
$$;

grant execute on function public.crm_find_user_by_email(text)                                           to authenticated;
grant execute on function public.crm_calculate_points(bigint, text, smallint, integer, integer, integer) to authenticated;
grant execute on function public.crm_day_sheet(bigint, date)                to authenticated;
grant execute on function public.crm_save_day(bigint, date, text, jsonb)    to authenticated;
grant execute on function public.crm_group_ranking(bigint)                  to authenticated;
grant execute on function public.crm_group_list()                           to authenticated;
grant execute on function public.crm_student_history(bigint)                to authenticated;
