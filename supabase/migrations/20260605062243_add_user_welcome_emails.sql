create table if not exists public.user_welcome_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now()
);

alter table public.user_welcome_emails enable row level security;

revoke all on table public.user_welcome_emails from anon;
grant select, insert on table public.user_welcome_emails to authenticated;

drop policy if exists "Users can read their own welcome email record" on public.user_welcome_emails;
create policy "Users can read their own welcome email record"
on public.user_welcome_emails
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own welcome email record" on public.user_welcome_emails;
create policy "Users can create their own welcome email record"
on public.user_welcome_emails
for insert
to authenticated
with check (auth.uid() = user_id);
