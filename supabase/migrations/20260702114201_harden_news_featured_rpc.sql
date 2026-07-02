-- RLS already grants admins full mutation rights on news_posts. Keep this RPC
-- invoker-safe so it does not need SECURITY DEFINER exposure.
create or replace function public.set_featured_news_post(post_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can set featured news posts';
  end if;

  update public.news_posts
    set is_featured = false,
        updated_at = now()
    where is_featured = true;

  if post_id is not null then
    update public.news_posts
      set is_featured = true,
          is_published = true,
          published_at = coalesce(published_at, now()),
          updated_at = now()
      where id = post_id;
  end if;
end;
$$;

revoke all on function public.set_featured_news_post(uuid) from public, anon;
grant execute on function public.set_featured_news_post(uuid) to authenticated;
