-- =====================================================================
--  43-fayl: "Mock testlar" bölimi
--
--  Mock test — oddiy test, faqat alohida yönalişda turadi:
--
--    Mock testlar (/mock)
--      ├─ Attestatsiya        (code: mock-attestatsiya)
--      ├─ Milliy sertifikat   (code: mock-milliy-sertifikat)
--      │    ├─ Original savollar   — haqiqiy imtihon variantlari
--      │    └─ Namunaviy savollar  — özimiz tuzgan variantlar
--      └─ SAT                 (code: mock-sat)
--
--  Kodi "mock-" bilan boşlangan yönaliş /tests katalogida körinmaydi,
--  faqat /mock sahifasida çiqadi (lib/mock.ts). Qolgan hamma narsa —
--  test işlaş, taymer, natija, yeçim, reyting, Premium qoidasi —
--  oddiy testlardagidek işlaydi.
--
--  Yönaliş ataylab NAŞR QILINGAN (is_published = true): yopiq
--  yönalişdagi test "faqat uy vazifasi" deb hisoblanadi
--  (lib/group-tests.ts). Bölimlar ham naşr qilingan, ular böş
--  turganda öquvçi "Tez orada" yozuvini köradi.
--
--  Supabase -> SQL Editor -> Run. Qayta işga tuşiriş xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kod cheklovi vaqtinça olinadi (db/06 dagidek)
-- ---------------------------------------------------------------------
alter table public.test_exam_types
  drop constraint if exists test_exam_types_code_check;

-- ---------------------------------------------------------------------
-- 2. Uçta mock yönaliş
-- ---------------------------------------------------------------------
insert into public.test_exam_types (code, title, description, order_number, is_published)
select v.code, v.title, v.description, v.order_number, true
from (
  values
    ('mock-attestatsiya',      'Attestatsiya',
     'Attestatsiya formatidagi töliq mock testlar.', 101),
    ('mock-milliy-sertifikat', 'Milliy sertifikat',
     'Milliy sertifikat formatidagi töliq mock testlar: 45 topşiriq, taymer, natija va yeçimlar.', 102),
    ('mock-sat',               'SAT',
     'SAT Math formatidagi töliq mock testlar.', 103)
) as v(code, title, description, order_number)
where not exists (
  select 1 from public.test_exam_types e where e.code = v.code
);

-- ---------------------------------------------------------------------
-- 3. Kod cheklovi qaytariladi — jadvaldagi hamma kod bilan
-- ---------------------------------------------------------------------
do $$
declare
  v_list text;
begin
  select string_agg(quote_literal(code), ', ' order by code)
  into v_list
  from (
    select distinct code
    from public.test_exam_types
    where code is not null
  ) s;

  if v_list is null then
    return;
  end if;

  execute format(
    'alter table public.test_exam_types
       add constraint test_exam_types_code_check
       check (code in (%s))',
    v_list
  );
end $$;

-- ---------------------------------------------------------------------
-- 4. Milliy sertifikat mocki içidagi ikki bölim
-- ---------------------------------------------------------------------
insert into public.test_sections (exam_type_id, title, description, order_number, is_published)
select e.id, v.title, v.description, v.order_number, true
from public.test_exam_types e
cross join (
  values
    ('Original savollar',
     'Haqiqiy Milliy sertifikat imtihonlarida tuşgan variantlar.', 1),
    ('Namunaviy savollar',
     'Imtihon formatida tuzilgan namunaviy variantlar.', 2)
) as v(title, description, order_number)
where e.code = 'mock-milliy-sertifikat'
  and not exists (
    select 1
    from public.test_sections s
    where s.exam_type_id = e.id
      and s.title = v.title
  );

-- Tekşiriş: 3 qator va 2 bölim çiqişi kerak
select e.code, e.title, count(s.id) as bolimlar
from public.test_exam_types e
left join public.test_sections s on s.exam_type_id = e.id
where e.code like 'mock-%'
group by e.code, e.title
order by e.code;
