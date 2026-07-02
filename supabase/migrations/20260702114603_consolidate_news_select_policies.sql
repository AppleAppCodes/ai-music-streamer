-- Avoid multiple permissive SELECT policies for authenticated users while
-- keeping public published posts and admin full-read access.
drop policy if exists "Published news posts are public" on public.news_posts;
drop policy if exists "Admins can read all news posts" on public.news_posts;

create policy "Published news posts are public"
  on public.news_posts
  for select
  to anon
  using (is_published = true);

create policy "Authenticated users can read published or admin news"
  on public.news_posts
  for select
  to authenticated
  using (is_published = true or public.is_admin());
