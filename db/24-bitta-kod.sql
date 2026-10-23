-- =====================================================================
--  24-fayl: bitta guruh — bitta kod
--
--  MUAMMO: guruh birlashtirilgach ham har bir yarmining o'z kodi
--  qolib ketgan edi. O'qituvchi guruh sahifasida bitta kodni,
--  uy vazifalari sahifasida boshqasini ko'rardi.
--
--  Ikkalasi ham ishlardi (21-fayldagi `join_group_by_code` har
--  qanday kodni qabul qiladi), lekin o'quvchiga qaysi birini
--  aytish noaniq edi.
--
--  YECHIM: juftlikdagi ikkala yarim ham bitta kodga ega bo'ladi.
--  Saytdagi guruh kodi asosiy deb olinadi — u eskiroq va o'quvchilar
--  qo'lida bo'lishi ehtimoli yuqoriroq.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  23-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mavjud juftliklarni bitta kodga keltiramiz
--
--    Takrorlanmasligi uchun bittalab yuriladi: kod band bo'lsa
--    o'sha guruh o'z kodi bilan qoladi.
-- ---------------------------------------------------------------------
do $$
declare
  v_crm   bigint;
  v_code  text;
begin
  for v_crm, v_code in
    select g.id, s.join_code
    from public.crm_groups g
    join public.study_groups s on s.id = g.study_group_id
    where s.join_code is not null
      and (g.join_code is distinct from s.join_code)
  loop
    /* Kod boshqa offline guruhda band bo'lmasa ko'chiramiz */
    if not exists (
      select 1 from public.crm_groups x
      where x.join_code = v_code and x.id <> v_crm
    ) then
      update public.crm_groups set join_code = v_code where id = v_crm;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Yangi guruh ham bitta kod bilan yaratiladi
--
--    21-fayldagi funksiya yangilanadi: offline yarmi yaratilgach
--    uning kodi saytdagi yarmining kodiga tenglashtiriladi.
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
    insert into public.crm_groups (title, study_group_id, join_code)
    values (v_title, v_study.id, v_study.join_code)
    returning * into v_crm;
  else
    update public.crm_groups
    set study_group_id = v_study.id,
        join_code      = v_study.join_code
    where id = v_crm.id
    returning * into v_crm;
  end if;

  return query select v_crm.id::bigint, v_study.id::bigint, v_title;
end;
$$;

grant execute on function public.ensure_group_pair(bigint, bigint, text) to authenticated;
