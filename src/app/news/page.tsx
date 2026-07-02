import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Megaphone } from 'lucide-react';

import { loadPublishedNewsPosts, newsArticlePath } from '@/lib/news';
import { buildPageMetadata, jsonLdScript, SITE_NAME, SITE_URL } from '@/lib/seo';
import { createPublicClient } from '@/utils/supabase/public';

export const metadata: Metadata = buildPageMetadata({
  title: 'YORIAX News',
  description: 'Latest YORIAX updates, product news, app releases, and announcements.',
  path: '/news',
});

function formatNewsDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default async function NewsPage() {
  const supabase = createPublicClient();
  const posts = await loadPublishedNewsPosts(supabase, 48);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE_URL}/news#blog`,
    name: `${SITE_NAME} News`,
    url: `${SITE_URL}/news`,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    blogPost: posts.slice(0, 12).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `${SITE_URL}${newsArticlePath(post.slug)}`,
      datePublished: post.published_at ?? post.created_at,
      image: post.image_url ?? undefined,
    })),
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <script id="yoriax-news-jsonld" type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <section className="relative overflow-hidden px-5 py-24 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute -left-28 top-12 h-80 w-80 rounded-full bg-primary/30 blur-[130px]" />
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/20 blur-[150px]" />

        <div className="relative mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white/65 transition-colors hover:bg-white/10 hover:text-white">
            YORIAX
          </Link>
          <div className="mt-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-accent">
              <Megaphone className="h-4 w-4" />
              News
            </span>
            <h1 className="mt-4 text-5xl font-black tracking-tight text-white sm:text-7xl">Updates, releases & stories.</h1>
            <p className="mt-5 text-lg font-semibold leading-8 text-white/55">
              Official YORIAX announcements, app updates, playlist drops, and product notes.
            </p>
          </div>

          {posts.length > 0 ? (
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <Link
                  key={post.id}
                  href={newsArticlePath(post.slug)}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-[0_24px_70px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-1 hover:border-primary/45"
                >
                  <div className="relative aspect-[16/10] bg-gradient-to-br from-primary/35 via-accent/20 to-white/5">
                    {post.image_url ? (
                      <Image
                        src={post.image_url}
                        alt={post.title}
                        fill
                        sizes={index < 3 ? '(max-width: 1024px) 50vw, 33vw' : '33vw'}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        priority={index < 3}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Megaphone className="h-12 w-12 text-white/55" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-accent/90">
                      {formatNewsDate(post.published_at ?? post.created_at) ?? 'YORIAX News'}
                    </p>
                    <h2 className="mt-2 line-clamp-2 text-2xl font-black tracking-tight text-white">{post.title}</h2>
                    {post.excerpt || post.body ? (
                      <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-white/55">
                        {post.excerpt || post.body}
                      </p>
                    ) : null}
                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-black text-primary-light">
                      Read more
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-14 rounded-3xl border border-white/10 bg-white/[0.045] p-8 text-white/55">
              No public news yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
