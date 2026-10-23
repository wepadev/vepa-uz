-- =====================================================================
--  25-fayl: uy vazifasi umumiy reytingga kirmaydi
--
--  QOIDA
--
--    · Saytdagi umumiy reyting — faqat "Testlar" bo'limidan
--      o'quvchining o'zi tanlab ishlagan testlardan shakllanadi.
--
--    · Uy vazifasi sifatida ishlangan urinish umumiy reytingga
--      umuman qo'shilmaydi. U guruh ichidagi ball va tangaga
--      ta'sir qiladi, xolos.
--
--  NEGA KERAK
--
--  Uy vazifasiga "Testlar" bo'limidan ham test berish mumkin bo'ldi.
--  Agar bunday urinish reytingga tushsa, o'qituvchi vazifa berish
--  orqali o'quvchining umumiy o'rnini ko'tarib yuborardi — reyting
--  esa hamma uchun bir xil shartda bo'lishi kerak.
--
--  QANDAY ISHLAYDI
--
--  Reyting `attempts` jadvalidan hisoblanadi. Uy vazifasi urinishida
--  `assignment_id` to'ldirilgan bo'ladi. Shu sababli reyting
--  ko'rinishlariga bitta shart qo'shiladi: `assignment_id is null`.
--
--  Guruh testlari allaqachon chetda edi: ularning yo'nalishi
--  (`test_exam_types.is_published = false`) `ranking_tests` filtridan
--  o'tmaydi. Bu fayl o'sha himoyani "Testlar" bo'limidagi testlarga
--  ham yoyadi.
--
--  MUHIM: o'quvchi keyinchalik o'sha testni katalogdan o'zi ishlasa,
--  o'sha urinish reytingga qo'shiladi — chunki unda `assignment_id`
--  bo'sh bo'ladi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Eng yaxshi urinishlar — uy vazifasisiz
-- ---------------------------------------------------------------------
create or replace view math_booster_private.ranking_best_attempts as
with normalized_attempts as (
  select
    attempt.id as attempt_id,
    attempt.user_id,
    attempt.test_id,
    coalesce(nullif(btrim(profile.full_name), ''), 'Oʼquvchi') as full_name,
    coalesce(attempt.percentage, 0) as percentage,
    case
      when attempt.started_at is null then 9223372036854775807::bigint
      else greatest(
        0,
        floor(extract(epoch from attempt.completed_at - attempt.started_at))
      )::bigint
    end as duration_seconds,
    attempt.score::bigint as score,
    attempt.total_questions::bigint as total_questions,
    attempt.started_at,
    attempt.completed_at
  from public.attempts attempt
  join public.profiles profile
    on profile.id = attempt.user_id
  join math_booster_private.ranking_tests ranking_test
    on ranking_test.test_id = attempt.test_id
  where attempt.completed_at is not null
    and profile.is_active is true
    and coalesce(profile.role, 'student') <> 'admin'
    /* Uy vazifasi sifatida ishlangan urinish reytingga kirmaydi */
    and attempt.assignment_id is null
)
select distinct on (user_id, test_id)
  attempt_id,
  user_id,
  test_id,
  full_name,
  percentage,
  duration_seconds,
  score,
  total_questions,
  started_at,
  completed_at
from normalized_attempts normalized
order by
  user_id,
  test_id,
  percentage desc,
  duration_seconds,
  completed_at,
  attempt_id;

-- ---------------------------------------------------------------------
-- 2. Urinishlar soni — uy vazifasisiz
--
--    Aks holda "3 marta ishlagan" degan son uy vazifasini ham
--    qo'shib ko'rsatardi, reyting jadvalida esa u yo'q edi.
-- ---------------------------------------------------------------------
create or replace view math_booster_private.ranking_attempt_counts as
select
  attempt.user_id,
  attempt.test_id,
  count(*) as attempts_count,
  count(*) filter (where attempt.completed_at is not null) as completed_attempts,
  max(attempt.started_at) as last_attempt_at
from public.attempts attempt
join public.profiles profile
  on profile.id = attempt.user_id
join math_booster_private.ranking_tests ranking_test
  on ranking_test.test_id = attempt.test_id
where profile.is_active is true
  and coalesce(profile.role, 'student') <> 'admin'
  and attempt.assignment_id is null
group by attempt.user_id, attempt.test_id;
