import type { SupabaseClient } from '@supabase/supabase-js';

import { SITE_URL } from '@/lib/seo';

export type NewsPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  is_published: boolean;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type NewsPostRow = Partial<NewsPost> & {
  id: string;
  slug: string;
  title: string;
  created_at: string;
  updated_at?: string | null;
};

export function newsArticlePath(slug: string) {
  return `/news/${encodeURIComponent(slug)}`;
}

export function newsArticleUrl(slug: string) {
  return `${SITE_URL}${newsArticlePath(slug)}`;
}

export function normalizeNewsPost(row: NewsPostRow): NewsPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? null,
    body: row.body ?? null,
    image_url: row.image_url ?? null,
    cta_label: row.cta_label ?? null,
    cta_url: row.cta_url ?? null,
    is_published: Boolean(row.is_published),
    is_featured: Boolean(row.is_featured),
    published_at: row.published_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

const NEWS_SELECT = 'id, slug, title, excerpt, body, image_url, cta_label, cta_url, is_published, is_featured, published_at, created_at, updated_at';

export async function loadFeaturedNewsPost(client: SupabaseClient): Promise<NewsPost | null> {
  const { data, error } = await client
    .from('news_posts')
    .select(NEWS_SELECT)
    .eq('is_featured', true)
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeNewsPost(data as NewsPostRow);
}

export async function loadPublishedNewsPosts(client: SupabaseClient, limit = 24): Promise<NewsPost[]> {
  const { data, error } = await client
    .from('news_posts')
    .select(NEWS_SELECT)
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as NewsPostRow[]).map(normalizeNewsPost);
}

export async function loadNewsPostBySlug(client: SupabaseClient, slug: string): Promise<NewsPost | null> {
  const { data, error } = await client
    .from('news_posts')
    .select(NEWS_SELECT)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeNewsPost(data as NewsPostRow);
}
