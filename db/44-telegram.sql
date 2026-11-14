-- 44. Telegram Mini App: Telegram hisobi ↔ sayt hisobi
--
-- Bitta Telegram bitta hisobga bog'lanadi (va aksinça). Jadvalga
-- faqat server (admin kaliti) yozadi: /api/telegram/auth imzosi
-- tekşirilgan initData'dan keyin. Foydalanuvçi faqat özininikini
-- köradi (Profil sahifasidagi "Telegram" bloki).
--
-- Qayta işga tuşiriş xavfsiz.

create table if not exists public.telegram_accounts (
  telegram_id  bigint      primary key,
  user_id      uuid        not null unique
                           references auth.users (id) on delete cascade,
  username     text,
  first_name   text,
  linked_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.telegram_accounts enable row level security;

drop policy if exists "telegram_accounts: öziniki" on public.telegram_accounts;
create policy "telegram_accounts: öziniki"
  on public.telegram_accounts
  for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.telegram_accounts from anon, authenticated;
grant select on public.telegram_accounts to authenticated;
