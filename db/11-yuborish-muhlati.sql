-- =====================================================================
--  11-fayl: test yuborish muhlatini uzaytirish
--
--  MUAMMO: submit_timed_test() vaqt tugagach atigi 15 soniya muhlat
--  beradi. Sekin internetda o'quvchi oxirgi soniyalarda "Yakunlash"
--  bossa, so'rov serverga shu 15 soniyadan kechroq yetib borishi
--  mumkin — va butun ishi rad etiladi. Bu o'quvchi uchun juda
--  og'ir xato: 45 daqiqalik mehnat yo'qoladi.
--
--  YECHIM: muhlat 60 soniyaga uzaytiriladi. Bu qo'shimcha imkoniyat
--  bermaydi — o'quvchi bu vaqtda yangi javob kirita olmaydi, chunki
--  brauzerdagi taymer allaqachon nolga tushgan va sahifa yuborishga
--  o'tgan. Faqat sekin aloqa uchun zaxira.
--
--  Funksiya matnini o'zimiz bilmaymiz (u bazada yozilgan), shuning
--  uchun uni bazadan o'qib, faqat kerakli qismini almashtiramiz.
--  Naqsh topilmasa hech narsa o'zgarmaydi va xabar beriladi.
--
--  Supabase → SQL Editor → Run. Qayta ishga tushirish xavfsiz.
-- =====================================================================

do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_timed_test'
  limit 1;

  if v_def is null then
    raise notice 'submit_timed_test topilmadi — o''zgarish kiritilmadi.';
    return;
  end if;

  -- Bo'sh joy soni har xil bo'lishi mumkin, shuning uchun ikkala
  -- ko'rinishni ham sinaymiz
  v_new := replace(v_def, 'interval ''15 seconds''', 'interval ''60 seconds''');

  if v_new = v_def then
    v_new := replace(v_def, 'interval''15 seconds''', 'interval''60 seconds''');
  end if;

  if v_new = v_def then
    raise notice
      'Muhlat naqshi topilmadi. Ehtimol allaqachon uzaytirilgan yoki boshqacha yozilgan.';
    return;
  end if;

  execute v_new;

  raise notice 'Yuborish muhlati 60 soniyaga uzaytirildi.';
end $$;
