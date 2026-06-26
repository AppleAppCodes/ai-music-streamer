-- Per-song spotlight pitch shown under the song in the home Spotlight section.
-- Nullable: when NULL the UI falls back to the localized default copy.
alter table public.songs
  add column if not exists spotlight_copy text;
