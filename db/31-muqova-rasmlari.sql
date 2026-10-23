-- =====================================================================
--  31-fayl: darslik muqovasini saytdan yuklash
--
--  ILGARI: muqova faqat havola (URL) sifatida kiritilardi. Rasmni
--  avval boshqa joyga yuklab, undan havola olib kelish kerak edi —
--  noqulay, havola esa vaqt o'tib buzilib qolardi.
--
--  ENDI: rasm to'g'ridan-to'g'ri admin paneldan yuklanadi va
--  Supabase Storage'da saqlanadi.
--
--  Bucket ochiq (public): muqova maxfiy ma'lumot emas, o'quvchiga
--  har ochilganda imzo so'ramaslik uchun shunday qilingan. Yozish
--  esa faqat o'qituvchiga ruxsat etilgan.
--
--  Supabase -> SQL Editor -> Run. Qayta ishga tushirish xavfsiz.
--  30-fayldan keyin ishlating.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Muqovalar uchun ochiq bucket
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('textbook-covers', 'textbook-covers', true)
on conflict (id) do update set public = true;

-- ---------------------------------------------------------------------
-- 2. Ruxsatlar
--
--    O'qish — hammaga (rasm saytda ko'rinishi kerak).
--    Yuklash, almashtirish, o'chirish — faqat o'qituvchiga.
-- ---------------------------------------------------------------------
/*
 * Siyosatlar DO blok ichida: ba'zi loyihalarda `storage.objects`
 * jadvaliga siyosat yozishga huquq bo'lmasligi mumkin. Bunday
 * holatda fayl xato bilan to'xtamaydi — nima qilish kerakligini
 * aytadi, siz Dashboard orqali qo'shasiz.
 */
do $$
begin
  execute 'drop policy if exists textbook_covers_read on storage.objects';
  execute 'drop policy if exists textbook_covers_write on storage.objects';

  execute $policy$
    create policy textbook_covers_read
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'textbook-covers')
  $policy$;

  execute $policy$
    create policy textbook_covers_write
      on storage.objects
      for all
      to authenticated
      using (
        bucket_id = 'textbook-covers'
        and public.is_teacher()
      )
      with check (
        bucket_id = 'textbook-covers'
        and public.is_teacher()
      )
  $policy$;

  raise notice 'Muqova siyosatlari qo''shildi.';
exception
  when insufficient_privilege then
    raise warning
      'storage.objects ga siyosat yozib bo''lmadi. Supabase Dashboard -> Storage -> textbook-covers -> Policies bo''limidan qo''lda qo''shing.';
end $$;
