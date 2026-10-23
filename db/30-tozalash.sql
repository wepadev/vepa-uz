-- =====================================================================
--  30-fayl: bazani tozalash (texnik xizmat)
--
--  Vaqt o'tishi bilan bazada FAQAT ish jarayonidan qolgan chiqindi
--  yig'iladi. Ular hech kimga kerak emas, lekin joy egallaydi va
--  so'rovlarni sekinlashtiradi:
--
--    · javob qoralamalari — test yuborilgach keraksiz
--    · yopilgan test sessiyalari — ochiq sessiya kerak, yopilgani yo'q
--    · boshlanib tashlab ketilgan urinishlar — natijasi yo'q
--    · to'g'ri yechilib yopilgan takrorlash savollari
--
--  NIMA HECH QACHON O'CHMAYDI:
--    · tugallangan urinishlar va ularning javoblari (natijalar, reyting)
--    · testlar, savollar, javob kalitlari, darslar, darsliklar
--    · guruhlar, ballar, tangalar, sovg'a tarixi
--    · uy vazifalari va ularning natijalari
--
--  Ya'ni o'quvchining biror natijasi yoki sizning biror kontentingiz
--  o'chishi mumkin emas — funksiya ularga umuman tegmaydi.
--
--  Oldingi fayllar ishga tushirilmagan bo'lsa ham buziladigan joyi
--  yo'q: yo'q funksiya va jadvallar shunchaki o'tkazib yuboriladi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  29-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tozalash
--
--    p_days — shu kundan eskilari o'chadi (eng kami 7 kun).
--    Standart 90 kun: yaqin oradagi hech narsaga tegilmaydi.
-- ---------------------------------------------------------------------
create or replace function public.platform_cleanup(
  p_days integer default 90
)
returns table (
  step    text,
  removed integer
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz :=
    now() - make_interval(days => greatest(7, coalesce(p_days, 90)));
  v_count integer;
begin
  if not public.is_teacher() then
    raise exception 'Ruxsat yo''q';
  end if;

  /*
   * 1. Avval tashlab ketilgan sessiyalarni yopamiz.
   *
   *    Bu qadam ataylab birinchi: sessiya o'chirilishidan oldin
   *    undan 0 ballik urinish yaratiladi, ya'ni o'quvchining
   *    testni boshlagani tarixda qoladi.
   */
  if to_regprocedure('public.close_abandoned_sessions()') is not null then
    execute 'select public.close_abandoned_sessions()' into v_count;
  else
    v_count := 0;
  end if;

  step := 'Yopilgan tashlandiq sessiyalar';
  removed := coalesce(v_count, 0);
  return next;

  /* 2. Javob qoralamalari — yuborilgan testniki keraksiz */
  if to_regprocedure('public.purge_answer_drafts()') is not null then
    execute 'select public.purge_answer_drafts()' into v_count;
  else
    v_count := 0;
  end if;

  step := 'Javob qoralamalari';
  removed := coalesce(v_count, 0);
  return next;

  /* 3. Eski yopilgan sessiyalar. Ochiq sessiyaga tegilmaydi */
  delete from public.test_sessions s
  where coalesce(s.started_at, now()) < v_cutoff
    and (
      s.submitted_at is not null
      or s.expires_at < now()
    );

  get diagnostics v_count = row_count;

  step := 'Eski test sessiyalari';
  removed := coalesce(v_count, 0);
  return next;

  /*
   * 4. Tugallanmagan eski urinishlar.
   *
   *    `completed_at is null` — o'quvchi testni yubormagan, ya'ni
   *    natija ham, foiz ham yo'q. Yuqoridagi qadamdan keyin bunday
   *    yozuvlar faqat haqiqatan tashlab ketilganlar bo'lib qoladi.
   */
  delete from public.user_answers u
  where u.attempt_id in (
    select a.id
    from public.attempts a
    where a.completed_at is null
      and coalesce(a.started_at, now()) < v_cutoff
  );

  get diagnostics v_count = row_count;

  step := 'Tashlandiq javob yozuvlari';
  removed := coalesce(v_count, 0);
  return next;

  delete from public.attempts a
  where a.completed_at is null
    and coalesce(a.started_at, now()) < v_cutoff;

  get diagnostics v_count = row_count;

  step := 'Tashlandiq urinishlar';
  removed := coalesce(v_count, 0);
  return next;

  /*
   * 5. Yopilgan takrorlash savollari.
   *
   *    `due_at is null` va to'g'ri yechilgan — savol boshqa
   *    qaytmaydi, yozuv esa faqat joy egallab turadi.
   */
  if to_regclass('public.review_items') is not null then
    execute
      'delete from public.review_items r
        where r.due_at is null
          and r.right_count > 0
          and coalesce(r.last_reviewed_at, r.created_at) < $1'
    using v_cutoff;

    get diagnostics v_count = row_count;
  else
    v_count := 0;
  end if;

  step := 'Yopilgan takrorlash savollari';
  removed := coalesce(v_count, 0);
  return next;

  return;
end;
$$;

grant execute on function public.platform_cleanup(integer) to authenticated;
revoke execute on function public.platform_cleanup(integer) from anon;

-- ---------------------------------------------------------------------
-- 2. Baza qancha joy egallayapti
--
--    Eng katta 12 ta jadval. Qaysi biri o'sayotganini ko'rib
--    turish uchun — tozalashdan oldin va keyin solishtiriladi.
-- ---------------------------------------------------------------------
create or replace function public.platform_storage_report()
returns table (
  table_name text,
  row_count  bigint,
  size_text  text,
  size_bytes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.relname::text,
    t.n_live_tup::bigint,
    pg_size_pretty(
      pg_total_relation_size(c.oid)
    )::text,
    pg_total_relation_size(c.oid)::bigint
  from pg_stat_user_tables t
  join pg_class c on c.oid = t.relid
  where t.schemaname = 'public'
    and public.is_teacher()
  order by pg_total_relation_size(c.oid) desc
  limit 12;
$$;

grant execute on function public.platform_storage_report() to authenticated;
revoke execute on function public.platform_storage_report() from anon;
