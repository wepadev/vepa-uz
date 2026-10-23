-- =====================================================================
--  27-fayl: testni izsiz o'chirish
--
--  MUAMMO: test o'chirilgach undan qolgan izlar sayt bo'ylab
--  sochilib yotardi — natijalar ro'yxatida bo'sh qator, reytingda
--  hisobga olingan urinish, takrorlashda esa endi mavjud bo'lmagan
--  savol. Shu sababli ishlangan testni umuman o'chirib bo'lmasdi.
--
--  YECHIM: bitta funksiya testga tegishli hamma narsani bir
--  tranzaksiyada yig'ishtiradi:
--
--    · urinishlar va ulardagi javoblar   -> natijalar tarixidan chiqadi
--    · ochiq sessiyalar va qoralamalar
--    · savollar, javob kalitlari, bloklar
--    · takrorlash ro'yxatidagi yozuvlar  -> xato savol qaytmaydi
--    · uy vazifalari va ulardan berilgan tanga/ball
--
--  Reyting alohida tozalanmaydi: u urinishlardan hisoblanadi,
--  urinish yo'qolsa ball ham o'zi yo'qoladi.
--
--  BITTA CHEKLOV BOR. O'quvchi shu testdan tanga yig'ib, o'sha
--  tangaga allaqachon sovg'a olgan bo'lsa, o'chirishga yo'l
--  qo'yilmaydi — aks holda balans manfiyga tushib qoladi. Bunday
--  holatda avval sovg'a tarixi hal qilinadi.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  26-fayldan keyin ishlating.
-- =====================================================================

drop function if exists public.delete_test_completely(bigint);

create function public.delete_test_completely(p_test_id bigint)
returns table (
  removed_attempts    integer,
  removed_reviews     integer,
  removed_assignments integer
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_title      text;
  v_debtor     text;
  v_attempts   integer := 0;
  v_reviews    integer := 0;
  v_assignments integer := 0;
begin
  if not public.is_teacher() then
    raise exception 'Ruxsat yo''q';
  end if;

  select t.title into v_title
  from public.tests t
  where t.id = p_test_id;

  if v_title is null then
    raise exception 'Test topilmadi';
  end if;

  /*
   * 1. Tanga tekshiruvi.
   *
   *    Shu testdan yig'ilgan tanga o'quvchining hozirgi
   *    balansidan ko'p bo'lsa — demak uning bir qismi sovg'aga
   *    sarflangan. Bunday tangani orqaga qaytarib bo'lmaydi.
   */
  select string_agg(coalesce(nullif(btrim(p.full_name), ''), 'O''quvchi'), ', ')
  into v_debtor
  from (
    select w.user_id, sum(w.coins)::int as coins
    from public.online_coin_awards w
    join public.assignments a on a.id = w.assignment_id
    where a.test_id = p_test_id
    group by w.user_id
  ) earned
  join public.profiles p on p.id = earned.user_id
  where earned.coins > (
    select b.available_coins
    from public.coin_balance(earned.user_id, null) b
  );

  if v_debtor is not null then
    raise exception
      'O''chirib bo''lmadi: % shu testdan olgan tangasini sovg''aga sarflagan. Avval sovg''a tarixini hal qiling.',
      v_debtor;
  end if;

  /* 2. Takrorlash ro'yxati — savollar o'chishidan oldin */
  delete from public.review_items r
  where r.question_id in (
    select q.id from public.questions q where q.test_id = p_test_id
  );

  get diagnostics v_reviews = row_count;

  /* 3. Javoblar: ham savol, ham urinish tomonidan */
  delete from public.user_answers u
  where u.question_id in (
      select q.id from public.questions q where q.test_id = p_test_id
    )
     or u.attempt_id in (
      select a.id from public.attempts a where a.test_id = p_test_id
    );

  /* 4. Qoralamalar — sessiya o'chishidan oldin */
  delete from public.test_answer_drafts d
  where d.session_id in (
    select s.id::text
    from public.test_sessions s
    where s.test_id = p_test_id
  );

  /* 5. Urinishlar va sessiyalar */
  delete from public.attempts a where a.test_id = p_test_id;

  get diagnostics v_attempts = row_count;

  delete from public.test_sessions s where s.test_id = p_test_id;

  /*
   * 6. Uy vazifalari.
   *
   *    `online_coin_awards` vazifaga bog'langan (on delete
   *    cascade), shuning uchun tanga va ball birga chiqadi —
   *    guruh reytingi o'zi qayta hisoblanadi.
   */
  delete from public.assignments a where a.test_id = p_test_id;

  get diagnostics v_assignments = row_count;

  /* 7. Dars bilan bog'langan bo'lsa — bog'lamni bo'shatamiz */
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lessons'
      and column_name = 'test_id'
  ) then
    execute 'update public.lessons set test_id = null where test_id = $1'
    using p_test_id;
  end if;

  /* 8. Savollar va ularga tegishlisi */
  delete from public.answer_keys k
  where k.question_id in (
    select q.id from public.questions q where q.test_id = p_test_id
  );

  delete from public.questions q where q.test_id = p_test_id;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'question_blocks'
  ) then
    execute 'delete from public.question_blocks where test_id = $1'
    using p_test_id;
  end if;

  /* 9. Testning o'zi */
  delete from public.tests t where t.id = p_test_id;

  removed_attempts    := v_attempts;
  removed_reviews     := v_reviews;
  removed_assignments := v_assignments;

  return next;
end;
$$;

grant execute on function public.delete_test_completely(bigint) to authenticated;
revoke execute on function public.delete_test_completely(bigint) from anon;
