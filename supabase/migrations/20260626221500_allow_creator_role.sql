-- The admin UI offers a "creator" role (creator can upload songs that get
-- auto-approved), but the existing check constraint on `profiles.role`
-- only allows 'user' | 'mod' | 'admin', so saving the creator role failed
-- with: new row for relation "profiles" violates check constraint
-- "profiles_role_check". Extend the constraint to match the UI.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['user'::text, 'creator'::text, 'mod'::text, 'admin'::text]));
