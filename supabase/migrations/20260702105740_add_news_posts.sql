-- Public News / Blog posts for the Home Highlight "News" slide.
-- Published rows are public for SEO and the mobile app; mutations are admin-only.

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text,
  image_url text,
  cta_label text,
  cta_url text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_posts_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists news_posts_published_idx
  on public.news_posts (is_published, published_at desc, created_at desc);

create unique index if not exists news_posts_single_featured_idx
  on public.news_posts (is_featured)
  where is_featured = true;

alter table public.news_posts enable row level security;

grant select on table public.news_posts to anon, authenticated;
grant insert, update, delete on table public.news_posts to authenticated;

create or replace function public.touch_news_posts_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_news_posts_updated_at() from public, anon, authenticated;

drop trigger if exists touch_news_posts_updated_at on public.news_posts;
create trigger touch_news_posts_updated_at
  before update on public.news_posts
  for each row
  execute function public.touch_news_posts_updated_at();

drop policy if exists "Published news posts are public" on public.news_posts;
create policy "Published news posts are public"
  on public.news_posts
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Admins can read all news posts" on public.news_posts;
create policy "Admins can read all news posts"
  on public.news_posts
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert news posts" on public.news_posts;
create policy "Admins can insert news posts"
  on public.news_posts
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update news posts" on public.news_posts;
create policy "Admins can update news posts"
  on public.news_posts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete news posts" on public.news_posts;
create policy "Admins can delete news posts"
  on public.news_posts
  for delete
  to authenticated
  using (public.is_admin());

create or replace function public.set_featured_news_post(post_id uuid)
returns void
language plpgsql
security definer
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

-- Backward-compatible fields for the simpler single-slide settings payload.
alter table public.app_settings
  add column if not exists highlight_news_image_url text,
  add column if not exists highlight_news_article_slug text;
