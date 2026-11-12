-- =====================================================================
--  41-fayl: natija oxirgi urinişdan olinadi
--
--  QOIDA
--
--    · Har bir testning natijasi — öquvçining şu testdagi OXIRGI
--      urinişi. Eng yaxşi uriniş emas.
--
--    · Mavzu (videodars) örtaçasi — uning testlaridagi oxirgi
--      urinişlar örtaçasi. Bu qism saytda hisoblanadi
--      (`lib/lesson-progress.ts`, `buildLastScoreMap`).
--
--  QANDAY ISHLAYDI
--
--  `ranking_best_attempts` körinişi har (öquvçi, test) juftligi uçun
--  bitta urinişni tanlaydi. Statistika va reyting funksiyalari
--  (`get_user_test_statistics`, `get_user_ranking_summary`, reyting
--  jadvali) hammasi şu körinişdan öqiydi. Ilgari u eng baland foizni
--  olardi, endi eng keyin tugatilgan urinişni oladi. Ustunlar
--  özgarmadi, şuning uçun funksiyalarni qayta yoziş şart emas.
--
--  Natijada saytdagi "Testlar", "Natijalar", profil va reyting —
--  hammasi oxirgi urinişni körsatadi.
--
--  Supabase -> SQL Editor -> Run. Qayta işga tuşiriş xavfsiz.
-- =====================================================================

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
  /* Eng yaxşisi emas — eng keyingi uriniş */
  completed_at desc,
  attempt_id desc;
