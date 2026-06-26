-- When an admin promotes a user to creator (or mod / admin), drop the
-- affected user a notification so they see it in the bell dropdown.
-- Demoting back to plain user does not generate a notification.

create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_previous_role text;
  v_username text;
  v_notification_title text;
  v_notification_message text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change user roles';
  end if;

  if new_role not in ('user', 'mod', 'admin', 'creator') then
    raise exception 'Invalid role. Must be user, mod, admin, or creator.';
  end if;

  select role, username
    into v_previous_role, v_username
    from public.profiles
    where id = target_user_id;

  update auth.users
  set raw_app_meta_data =
    case
      when new_role = 'user' then coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
      else jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role))
    end
  where id = target_user_id;

  update public.profiles
  set role = new_role
  where id = target_user_id;

  if new_role <> coalesce(v_previous_role, 'user') and new_role <> 'user' then
    if new_role = 'creator' then
      v_notification_title := 'Du bist jetzt YORIAX Creator!';
      v_notification_message := 'Glückwunsch — du kannst ab sofort eigene Songs hochladen und sie erscheinen direkt auf YORIAX.';
    elsif new_role = 'mod' then
      v_notification_title := 'Du bist jetzt YORIAX Moderator!';
      v_notification_message := 'Du hast jetzt Moderations-Rechte auf YORIAX.';
    else
      v_notification_title := 'Du bist jetzt YORIAX Admin!';
      v_notification_message := 'Du hast jetzt vollen Admin-Zugriff auf YORIAX.';
    end if;

    insert into public.notifications (user_id, type, title, message, link)
    values (
      target_user_id,
      'role_promotion',
      v_notification_title,
      v_notification_message,
      case when new_role = 'creator' then '/upload'
           when new_role = 'admin' then '/admin'
           else '/'
      end
    );
  end if;
end;
$function$;
