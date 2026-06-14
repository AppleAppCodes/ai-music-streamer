-- Lock down security-definer functions so they have a fixed search_path and
-- cannot be called directly by anonymous users.

CREATE OR REPLACE FUNCTION public.notify_admins_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT id, 'system', 'Neuer Nutzer registriert', 'Der Nutzer "' || COALESCE(NEW.username, 'Unbekannt') || '" hat sich gerade angemeldet.', '/admin'
  FROM public.profiles
  WHERE role = 'admin';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_followers_on_new_song()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT
    f.user_id,
    'new_release',
    'Neuer Release: ' || NEW.artist_name,
    NEW.artist_name || ' hat gerade "' || NEW.title || '" veröffentlicht!',
    '/song/' || NEW.id
  FROM public.follows f
  WHERE f.artist_name = NEW.artist_name;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_followers_on_new_song() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  IF new_role NOT IN ('user', 'mod', 'admin', 'creator') THEN
    RAISE EXCEPTION 'Invalid role. Must be user, mod, admin, or creator.';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data =
    CASE
      WHEN new_role = 'user' THEN COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role'
      ELSE jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role))
    END
  WHERE id = target_user_id;

  UPDATE public.profiles
  SET role = new_role
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_artist_order(order_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update artist ordering';
  END IF;

  FOR item IN SELECT * FROM jsonb_to_recordset(order_data) AS x(artist_name text, sort_order integer, is_original boolean)
  LOOP
    INSERT INTO public.artist_profiles (artist_name, sort_order, is_original)
    VALUES (item.artist_name, item.sort_order, COALESCE(item.is_original, false))
    ON CONFLICT (artist_name) DO UPDATE
    SET sort_order = EXCLUDED.sort_order,
        is_original = EXCLUDED.is_original;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.update_artist_order(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_artist_order(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_viral_song_order(order_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update viral song ordering';
  END IF;

  FOR item IN SELECT * FROM jsonb_to_recordset(order_data) AS x(id uuid, viral_sort_order integer)
  LOOP
    UPDATE public.songs
    SET viral_sort_order = item.viral_sort_order
    WHERE songs.id = item.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.update_viral_song_order(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_viral_song_order(jsonb) TO authenticated;
