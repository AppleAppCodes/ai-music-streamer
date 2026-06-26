alter table public.songs
  add column if not exists is_spotlight boolean not null default false;

create unique index if not exists songs_single_spotlight_idx
  on public.songs (is_spotlight)
  where is_spotlight = true;
