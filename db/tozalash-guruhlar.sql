-- =====================================================================
--  DIQQAT: BU FAYL MA'LUMOTNI O'CHIRADI
--
--  Bu migratsiya emas. Uni faqat guruhlar bo'limini noldan
--  boshlamoqchi bo'lganingizda, bilib turib ishga tushiring.
--
--  NIMA O'CHADI
--    · barcha guruhlar (onlayn va offline)
--    · guruh a'zoliklari va o'quvchilar ro'yxati
--    · darslar, davomat, ball va tangalar
--    · uy vazifalari (guruhga berilgan topshiriqlar)
--    · sovg'alar va almashtirishlar tarixi
--    · onlayn vazifa uchun berilgan tangalar
--
--  NIMA SAQLANADI
--    · foydalanuvchi hisoblari va profillar
--    · testlar, savollar, javob kalitlari
--    · o'quvchilarning test natijalari (attempts) — faqat
--      vazifaga bog'lanishi uziladi, natijaning o'zi qoladi
--    · darsliklar, videodarslar, to'lovlar
--
--  Ishga tushirishdan oldin Supabase'da zaxira nusxa olib qo'ying:
--  Database -> Backups.
--
--  Supabase -> SQL Editor -> Run.
-- =====================================================================

begin;

/*
 * Urinishlarni vazifadan uzamiz.
 *
 * Vazifa o'chganda `on delete set null` buni o'zi qiladi, lekin
 * aniq yozib qo'ygan ma'qul — natijalar tarixi yo'qolmasligi
 * kerakligi shu yerdan ko'rinib tursin.
 */
update public.attempts set assignment_id = null
where assignment_id is not null;

/* Onlayn vazifa uchun berilgan tangalar */
delete from public.online_coin_awards;

/* Sovg'a almashtirishlari va sovg'alar */
delete from public.crm_redemptions;
delete from public.crm_rewards;

/* Kunlik yozuvlar, darslar, qoidalar, o'quvchilar */
delete from public.crm_daily_records;
delete from public.crm_lessons;
delete from public.crm_point_rules;
delete from public.crm_students;

/* Uy vazifalari va guruh a'zoliklari */
delete from public.assignments;
delete from public.study_group_members;

/* Guruhlarning o'zi */
delete from public.crm_groups;
delete from public.study_groups;

commit;

/* Nima qolganini ko'rsatamiz — hammasi 0 bo'lishi kerak */
select
  (select count(*) from public.crm_groups)        as guruhlar,
  (select count(*) from public.study_groups)      as sayt_guruhlari,
  (select count(*) from public.crm_students)      as oquvchilar,
  (select count(*) from public.crm_lessons)       as darslar,
  (select count(*) from public.crm_daily_records) as yozuvlar,
  (select count(*) from public.assignments)       as vazifalar,
  (select count(*) from public.crm_rewards)       as sovgalar,
  (select count(*) from public.attempts)          as natijalar_saqlandi;
