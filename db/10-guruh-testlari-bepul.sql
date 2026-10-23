-- =====================================================================
--  10-fayl: guruh testlari har doim bepul
--
--  Muammo: "dastlabki 3 ta test bepul, qolgani Premium" qoidasi butun
--  katalogga tegishli edi va guruh testlariga ham tarqalardi. Natijada
--  o'quvchi uy vazifasini ochmoqchi bo'lganda "Premium kerak" degan
--  to'siqqa urilardi. Uy vazifasi esa hech qachon pulli bo'lmasligi
--  kerak — u sinfdagi majburiy ish.
--
--  Yechim ikki qatlamli:
--    1. Mavjud guruh testlariga is_free = true qo'yamiz
--    2. Trigger qo'yamiz — yangi qo'shilganlari ham avtomatik bepul
--
--  Shu tufayli kelajakda test qanday qo'shilishidan qat'i nazar
--  (admin panel, PDF import, skript) u baribir bepul bo'ladi.
--
--  Supabase → SQL Editor → Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mavjud guruh testlarini bepul qilamiz
-- ---------------------------------------------------------------------
update public.tests t
set is_free = true
from public.test_sections s
join public.test_exam_types e on e.id = s.exam_type_id
where s.id = t.section_id
  and e.code = 'guruh-testlari'
  and t.is_free is distinct from true;

-- ---------------------------------------------------------------------
-- 2. Yangi qo'shilganlari uchun trigger
--
--    Test qaysi bo'limga tegishli ekanini tekshiradi. Bo'lim guruh
--    yo'nalishida bo'lsa — is_free majburan true.
--
--    Bo'lim keyinroq o'zgartirilsa ham ishlaydi, chunki trigger
--    insert va update da ishlaydi.
-- ---------------------------------------------------------------------
create or replace function public.force_free_group_test()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.section_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.test_sections s
    join public.test_exam_types e on e.id = s.exam_type_id
    where s.id = new.section_id
      and e.code = 'guruh-testlari'
  ) then
    new.is_free := true;
  end if;

  return new;
end;
$$;

drop trigger if exists tests_force_free_group on public.tests;

create trigger tests_force_free_group
  before insert or update of section_id, is_free
  on public.tests
  for each row
  execute function public.force_free_group_test();

-- ---------------------------------------------------------------------
-- 3. Sayt tomonidagi tekshiruvni ham aniqlashtiramiz
--
--    can_access_test() endi guruh testini so'ralganda darhol true
--    qaytaradi. Bu ortiqcha ehtiyot chorasi: is_free allaqachon
--    qo'yilgan, lekin qoida bir joyda buzilsa ham o'quvchi uy
--    vazifasidan chetda qolmasin.
-- ---------------------------------------------------------------------
create or replace function public.can_access_test(p_test_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Uy vazifasi testlari har doim ochiq
  if public.is_group_only_test(p_test_id) then
    return true;
  end if;

  return coalesce(
    public.math_booster_can_access_test(p_test_id, auth.uid()),
    false
  );
end;
$$;

grant execute on function public.can_access_test(bigint) to authenticated;
