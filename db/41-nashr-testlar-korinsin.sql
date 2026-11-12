-- =====================================================================
--  41-fayl: naşr qilingan har bir test Testlar bölimida körinsin
--
--  MUAMMO
--
--  Öquvçi testni yönaliş → bölim → mavzu orqali topadi. Test naşr
--  qilingan bölsa ham, uning mavzusi, bölimi yoki yönalişi qoralama
--  bölsa — test körinmasdi. Yangi mavzu va bölim har doim qoralama
--  bölib yaratiladi, test esa alohida naşr qilinadi, şuning uçun
--  "naşr qildim, lekin körinmayapti" holati tez-tez çiqardi.
--  Mavzusiz qolgan (topic_id = null) testlar ham heç qayerda
--  körinmasdi.
--
--  YEÇIM (bir martalik, mavjud ma'lumot uçun)
--
--    1. Mavzusiz naşr qilingan katalog testlari bölimidagi "Umumiy"
--       mavzusiga solinadi (yöq bölsa yaratiladi).
--    2. Naşr qilingan testi bor har bir mavzu, bölim va yönaliş
--       naşr qilinadi.
--
--  Bundan keyin admin panel buni özi qiladi: test naşr qilinganda
--  uning mavzusi, bölimi va yönalişi ham oçiladi
--  (lib/publish-test-parents.ts).
--
--  Videodarsga biriktirilgan-biriktirilmaganiga qaralmaydi.
--
--  Istisno: "Guruhlar uçun maxsus testlar" (guruh-testlari) yönalişi
--  ataylab yopiq qoladi — u testlar faqat uy vazifasi orqali oçiladi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tuşiriş xavfsiz.
--  40-fayldan keyin işlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Avval: qaysi testlar hozir körinmayapti va nega
--    (faqat körib çiqiş uçun, heç narsani özgartirmaydi)
--
--    select t.id, t.title,
--           case
--             when t.topic_id is null      then 'mavzusiz'
--             when not tp.is_published     then 'mavzu qoralama'
--             when not s.is_published      then 'bölim qoralama'
--             when not e.is_published      then 'yönaliş qoralama'
--           end as sabab
--    from public.tests t
--    join public.test_sections   s on s.id = t.section_id
--    join public.test_exam_types e on e.id = s.exam_type_id
--    left join public.test_topics tp on tp.id = t.topic_id
--    where t.is_published
--      and e.code <> 'guruh-testlari'
--      and (t.topic_id is null or not tp.is_published
--           or not s.is_published or not e.is_published)
--    order by t.id;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Mavzusiz testlar "Umumiy" mavzusiga
-- ---------------------------------------------------------------------
insert into public.test_topics (section_id, title, description, order_number, is_published)
select
  s.id,
  'Umumiy',
  'Mavzuga ajratilmagan testlar.',
  coalesce((select max(tp.order_number) from public.test_topics tp where tp.section_id = s.id), 0) + 1,
  true
from public.test_sections s
join public.test_exam_types e on e.id = s.exam_type_id
where e.code <> 'guruh-testlari'
  and exists (
    select 1 from public.tests t
    where t.section_id = s.id
      and t.topic_id is null
      and t.is_published
  )
  and not exists (
    select 1 from public.test_topics tp
    where tp.section_id = s.id and tp.title = 'Umumiy'
  );

update public.tests t
set topic_id = tp.id
from public.test_topics tp,
     public.test_sections s,
     public.test_exam_types e
where tp.section_id = t.section_id
  and tp.title = 'Umumiy'
  and s.id = t.section_id
  and e.id = s.exam_type_id
  and e.code <> 'guruh-testlari'
  and t.topic_id is null
  and t.is_published;

-- ---------------------------------------------------------------------
-- 2. Naşr qilingan testi bor mavzu, bölim, yönaliş naşr qilinadi
-- ---------------------------------------------------------------------
update public.test_topics tp
set is_published = true
where not tp.is_published
  and exists (
    select 1 from public.tests t
    where t.topic_id = tp.id and t.is_published
  );

update public.test_sections s
set is_published = true
where not s.is_published
  and exists (
    select 1
    from public.tests t
    join public.test_topics tp on tp.id = t.topic_id
    where tp.section_id = s.id and t.is_published
  );

update public.test_exam_types e
set is_published = true
where not e.is_published
  and e.code <> 'guruh-testlari'
  and exists (
    select 1
    from public.tests t
    join public.test_topics   tp on tp.id = t.topic_id
    join public.test_sections s  on s.id  = tp.section_id
    where s.exam_type_id = e.id and t.is_published
  );

-- ---------------------------------------------------------------------
-- 3. Tekşiriş: 0-banddagi so'rov endi bo'ş qaytişi kerak.
-- ---------------------------------------------------------------------
