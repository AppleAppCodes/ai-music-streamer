-- Bot / Admin activity audit log.
--
-- Why: the admin "Bot Control" tab reads public.mcp_logs, but the only code that
-- ever wrote to it (the bespoke YORIAX MCP server) is wired to no agent. Real
-- admin/agent activity goes through the generic Supabase MCP (direct SQL) and
-- bypassed logging entirely, so the tab was always empty.
--
-- Fix: log writes at the database level — the single place every client passes
-- through — into the existing mcp_logs table.
--
-- Safety guarantees:
--   * Fail-safe  – an error while auditing can NEVER roll back the real write
--                  (inner BEGIN ... EXCEPTION WHEN OTHERS swallows everything).
--   * Flood-safe – ordinary end-user writes (JWT role authenticated/anon),
--                  including the per-stream increment_song_plays, are skipped;
--                  the songs UPDATE trigger additionally ignores updates that
--                  only touch plays/updated_at.
--   * Reversible – DROP the triggers + function to remove completely.

create or replace function public.log_db_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    text;
  v_row     jsonb;
  v_args    jsonb;
  v_changed text;
  v_title   text;
  v_artist  text;
  v_summary text;
begin
  begin
    -- PostgREST requests carry the JWT role; direct SQL (generic Supabase MCP,
    -- scripts, psql) carries none -> label it 'system'.
    v_role := coalesce(nullif(auth.role(), ''), 'system');

    -- This is a *bot/admin* activity log: skip ordinary app users. That also
    -- keeps the high-frequency play-count increment out of the log.
    if v_role in ('authenticated', 'anon') then
      return coalesce(NEW, OLD);
    end if;

    -- Field access via jsonb so the shared function works on every table
    -- (never reference table-specific columns directly here).
    v_row    := to_jsonb(coalesce(NEW, OLD));
    v_title  := coalesce(v_row ->> 'title', v_row ->> 'username', '');
    v_artist := coalesce(v_row ->> 'artist_name', '?');

    if TG_OP = 'INSERT' then
      v_args := to_jsonb(NEW);
    elsif TG_OP = 'DELETE' then
      v_args := to_jsonb(OLD);
    else
      -- only the columns that actually changed (ignore the updated_at churn)
      select string_agg(key, ', ' order by key),
             jsonb_object_agg(key, jsonb_build_object('von', o.value, 'zu', n.value))
        into v_changed, v_args
      from jsonb_each(to_jsonb(OLD)) o
      join jsonb_each(to_jsonb(NEW)) n using (key)
      where key <> 'updated_at'
        and o.value is distinct from n.value;
    end if;

    -- Human-readable German summary shown in the dashboard.
    v_summary := case TG_TABLE_NAME
      when 'songs' then case TG_OP
        when 'INSERT' then '🎵 Song hochgeladen: "' || v_title || '" von ' || v_artist
        when 'DELETE' then '🗑️ Song gelöscht: "' || v_title || '" von ' || v_artist
        else '✏️ Song "' || v_title || '" bearbeitet (geändert: ' || coalesce(v_changed, '–') || ')'
      end
      when 'playlists' then case TG_OP
        when 'INSERT' then '📋 Playlist erstellt: "' || v_title || '"'
        when 'DELETE' then '🗑️ Playlist gelöscht: "' || v_title || '"'
        else '✏️ Playlist "' || v_title || '" bearbeitet (geändert: ' || coalesce(v_changed, '–') || ')'
      end
      when 'profiles' then '👤 Nutzer "' || v_title || '" geändert (' || coalesce(v_changed, '–') || ')'
      else TG_TABLE_NAME || '.' || TG_OP
    end;

    insert into public.mcp_logs (tool_name, arguments, response_summary)
    values (
      lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
      coalesce(v_args, '{}'::jsonb) || jsonb_build_object('_akteur', v_role),
      v_summary
    );
  exception when others then
    -- auditing must never break the real write
    null;
  end;
  return coalesce(NEW, OLD);
end;
$$;

comment on function public.log_db_activity() is
  'Audit trigger: logs bot/admin/MCP (non end-user) writes into mcp_logs for the admin Bot Control tab. Fail-safe and flood-safe.';

-- ── songs ────────────────────────────────────────────────────────────────────
drop trigger if exists trg_log_activity_songs_ins_del on public.songs;
create trigger trg_log_activity_songs_ins_del
  after insert or delete on public.songs
  for each row execute function public.log_db_activity();

-- Skip play-count-only updates (per-stream churn) entirely.
drop trigger if exists trg_log_activity_songs_upd on public.songs;
create trigger trg_log_activity_songs_upd
  after update on public.songs
  for each row
  when ((to_jsonb(OLD) - 'plays' - 'updated_at') is distinct from (to_jsonb(NEW) - 'plays' - 'updated_at'))
  execute function public.log_db_activity();

-- ── playlists ────────────────────────────────────────────────────────────────
drop trigger if exists trg_log_activity_playlists on public.playlists;
create trigger trg_log_activity_playlists
  after insert or update or delete on public.playlists
  for each row execute function public.log_db_activity();

-- ── profiles (only role / ban changes; avoids subscription/login noise) ──────
drop trigger if exists trg_log_activity_profiles on public.profiles;
create trigger trg_log_activity_profiles
  after update on public.profiles
  for each row
  when (OLD.role is distinct from NEW.role or OLD.is_banned is distinct from NEW.is_banned)
  execute function public.log_db_activity();

-- ── Realtime: let the admin dashboard receive live inserts ───────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mcp_logs'
  ) then
    alter publication supabase_realtime add table public.mcp_logs;
  end if;
end $$;
