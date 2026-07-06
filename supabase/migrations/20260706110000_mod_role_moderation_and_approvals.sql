-- MOD role, part 1+2: working moderation (reports) and song approvals.
-- Deliberately NOT included: banning, user management, any admin analytics.

create or replace function public.is_mod()
returns boolean
language sql
stable
set search_path to ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'mod'), false);
$$;

-- Reports were admin-only, which made the mod moderation dashboard empty.
drop policy if exists "Admins can view all reports" on public.reports;
create policy "Admins and mods can view all reports" on public.reports
  for select to authenticated using ((select public.is_mod()));
drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins and mods can update reports" on public.reports
  for update to authenticated using ((select public.is_mod()));

-- Songs RLS hides foreign unapproved rows from non-admins, so the approvals
-- queue comes through a guarded definer function.
create or replace function public.get_pending_songs()
returns table (id uuid, title text, artist_name text, audio_url text, created_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not (select public.is_mod()) then
    raise exception 'mods only';
  end if;
  return query
    select s.id, s.title, s.artist_name, s.audio_url, s.created_at
    from public.songs s
    where coalesce(s.is_approved, false) = false
    order by s.created_at asc;
end;
$$;
revoke all on function public.get_pending_songs() from anon;
grant execute on function public.get_pending_songs() to authenticated;

-- Approve publishes the song; reject deletes it — but only while it is still
-- unapproved, so mods can never delete live catalogue via this path.
create or replace function public.moderate_song_approval(target_song_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not (select public.is_mod()) then
    raise exception 'mods only';
  end if;
  if approve then
    update public.songs set is_approved = true where id = target_song_id;
  else
    delete from public.songs
    where id = target_song_id and coalesce(is_approved, false) = false;
  end if;
end;
$$;
revoke all on function public.moderate_song_approval(uuid, boolean) from anon;
grant execute on function public.moderate_song_approval(uuid, boolean) to authenticated;
