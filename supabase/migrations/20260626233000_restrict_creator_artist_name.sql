-- Restrict creator uploads to artist names that are either brand new or
-- already owned by the same creator. Admin uploads are unaffected.

-- Helper function (SECURITY DEFINER so it can read the full songs table even
-- when the calling user's row-level SELECT is restricted).
create or replace function public.artist_name_available_for_creator(p_artist_name text, p_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_artist_name is null then true
    when length(trim(p_artist_name)) = 0 then true
    else not exists (
      select 1
      from public.songs other
      where lower(trim(other.artist_name)) = lower(trim(p_artist_name))
        and other.creator_id is distinct from p_creator_id
    )
  end;
$$;

revoke all on function public.artist_name_available_for_creator(text, uuid) from public, anon;
grant execute on function public.artist_name_available_for_creator(text, uuid) to authenticated;

drop policy if exists "Admins and creators can insert songs" on public.songs;

create policy "Admins and creators can insert songs"
  on public.songs for insert
  to authenticated
  with check (
    (select public.is_admin())
    or (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'creator'
      and creator_id = (select auth.uid())
      and coalesce(is_approved, false) = false
      and public.artist_name_available_for_creator(songs.artist_name, (select auth.uid()))
    )
  );
