-- Follow-Push: when a song of a followed artist becomes approved (= the drop
-- goes live), every follower with a push token gets a notification. Runs as a
-- DB trigger so it fires no matter which surface approves the song (admin web,
-- SQL, future tools). One-shot per song via the song_drop_pushes guard table.
--
-- Sending uses pg_net (async HTTP queue) straight to the Expo push API — the
-- same endpoint the admin broadcast uses. No ticket handling here: dead tokens
-- get pruned by the admin broadcast path; a lost push is never worth blocking
-- an approval transaction.
create extension if not exists pg_net;

create table if not exists public.song_drop_pushes (
  song_id uuid primary key references public.songs(id) on delete cascade,
  sent_at timestamptz not null default now(),
  recipients integer not null default 0
);
alter table public.song_drop_pushes enable row level security;
revoke all on public.song_drop_pushes from anon, authenticated;

create or replace function public.notify_followers_on_song_drop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tokens text[];
  total integer := 0;
  push_title text;
  push_body text;
  chunk_start integer := 1;
  payload jsonb;
begin
  if new.is_approved is not true then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.is_approved, false) = true then return new; end if;

  -- One-shot lock: the first transaction to insert wins; re-approvals no-op.
  insert into public.song_drop_pushes (song_id) values (new.id)
  on conflict (song_id) do nothing;
  if not found then return new; end if;

  select array_agg(distinct pt.token) into tokens
  from public.follows f
  join public.push_tokens pt on pt.user_id = f.user_id
  where lower(f.artist_name) = lower(coalesce(new.artist_name, ''))
    and pt.token like 'Expo%'
    and f.user_id is distinct from new.creator_id;

  total := coalesce(array_length(tokens, 1), 0);
  update public.song_drop_pushes set recipients = total where song_id = new.id;
  if total = 0 then return new; end if;

  push_title := left('🎵 New song by ' || coalesce(new.artist_name, 'a YORIAX artist'), 80);
  push_body := left('"' || coalesce(new.title, 'New release') || '" is out now — listen on YORIAX', 240);

  -- Expo accepts max 100 messages per request.
  while chunk_start <= total loop
    select jsonb_agg(jsonb_build_object('to', tok, 'title', push_title, 'body', push_body, 'sound', 'default'))
      into payload
    from unnest(tokens[chunk_start:least(chunk_start + 99, total)]) as tok;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );
    chunk_start := chunk_start + 100;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_song_drop_push on public.songs;
create trigger trg_song_drop_push
  after insert or update of is_approved on public.songs
  for each row execute function public.notify_followers_on_song_drop();

-- Seed the guard table with the existing catalogue so only songs approved
-- AFTER this migration ever push — a bulk re-approval of old songs must never
-- turn into a notification wave.
insert into public.song_drop_pushes (song_id, recipients)
select id, 0 from public.songs where is_approved is true
on conflict (song_id) do nothing;
