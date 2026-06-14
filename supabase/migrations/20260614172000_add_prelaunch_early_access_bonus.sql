alter table public.profiles
  add column if not exists ad_free_until timestamptz,
  add column if not exists early_access_bonus_claimed_at timestamptz;

create or replace function public.apply_prelaunch_early_access_bonus()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  bonus_until timestamptz := now() + interval '3 months';
begin
  new.early_access_bonus_claimed_at := coalesce(new.early_access_bonus_claimed_at, now());
  new.ad_free_until := greatest(coalesce(new.ad_free_until, bonus_until), bonus_until);
  return new;
end;
$$;

drop trigger if exists apply_prelaunch_early_access_bonus on public.profiles;
create trigger apply_prelaunch_early_access_bonus
before insert on public.profiles
for each row
execute function public.apply_prelaunch_early_access_bonus();

revoke all on function public.apply_prelaunch_early_access_bonus() from public, anon, authenticated;

update public.profiles
set
  early_access_bonus_claimed_at = coalesce(early_access_bonus_claimed_at, now()),
  ad_free_until = greatest(coalesce(ad_free_until, now() + interval '3 months'), now() + interval '3 months')
where ad_free_until is null
   or ad_free_until < now() + interval '3 months';
