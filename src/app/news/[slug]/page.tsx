import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight, Megaphone } from 'lucide-react';

import { loadNewsPostBySlug, newsArticlePath } from '@/lib/news';
import { absoluteUrl, breadcrumbStructuredData, buildPageMetadata, jsonLdScript, SITE_NAME, SITE_URL } from '@/lib/seo';
import { createPublicClient } from '@/utils/supabase/public';

type NewsArticlePageProps = {
  params: Promise<{ slug: string }>;
};

function formatNewsDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export async function generateMetadata({ params }: NewsArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicClient();
  const post = await loadNewsPostBySlug(supabase, slug);

  if (!post) {
    return buildPageMetadata({
      title: 'News not found',
      description: 'This YORIAX news article is not available.',
      path: newsArticlePath(slug),
      noIndex: true,
    });
  }

  const description = post.excerpt || post.body?.slice(0, 155) || 'Latest YORIAX news and announcements.';

  return buildPageMetadata({
    title: post.title,
    description,
    path: newsArticlePath(post.slug),
    image: post.image_url,
    imageAlt: post.title,
  });
}

export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const post = await loadNewsPostBySlug(supabase, slug);

  if (!post) notFound();

  const path = newsArticlePath(post.slug);
  const publishedAt = post.published_at ?? post.created_at;
  const ctaUrl = post.cta_url?.trim();
  const isExternalCta = Boolean(ctaUrl && /^https?:\/\//i.test(ctaUrl));
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': `${SITE_URL}${path}#article`,
      headline: post.title,
      description: post.excerpt ?? undefined,
      image: post.image_url ? absoluteUrl(post.image_url) : undefined,
      datePublished: publishedAt,
      dateModified: post.updated_at,
      author: {
        '@type': 'Organization',
        name: SITE_NAME,
      },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        logo: {
          '@type': 'ImageObject',
          url: absoluteUrl('/brand/yoriax-logo-symbol.png'),
        },
      },
      mainEntityOfPage: `${SITE_URL}${path}`,
    },
    breadcrumbStructuredData([
      { name: 'YORIAX', path: '/' },
      { name: 'News', path: '/news' },
      { name: post.title, path },
    ]),
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <script id="yoriax-news-article-jsonld" type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <article className="relative overflow-hidden px-5 py-20 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-primary/30 blur-[130px]" />
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/18 blur-[150px]" />

        <div className="relative mx-auto max-w-4xl">
          <Link href="/news" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            News
          </Link>

          <header className="mt-10">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-accent">
              <Megaphone className="h-4 w-4" />
              YORIAX News
            </span>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">{post.title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-bold text-white/45">
              <span>YORIAX Team</span>
              {publishedAt ? <span>· {formatNewsDate(publishedAt)}</span> : null}
            </div>
            {post.excerpt ? (
              <p className="mt-6 text-xl font-semibold leading-8 text-white/62">{post.excerpt}</p>
            ) : null}
          </header>

          {post.image_url ? (
            <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
              <Image src={post.image_url} alt={post.title} fill sizes="(max-width: 1024px) 100vw, 900px" className="object-cover" priority />
            </div>
          ) : null}

          {post.body ? (
            <div className="mt-10 whitespace-pre-wrap rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-lg font-medium leading-9 text-white/70 sm:p-8">
              {post.body}
            </div>
          ) : null}

          {ctaUrl ? (
            <a
              href={ctaUrl}
              target={isExternalCta ? '_blank' : undefined}
              rel={isExternalCta ? 'noopener noreferrer' : undefined}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black transition-transform hover:scale-105"
            >
              {post.cta_label || 'Learn more'}
              <ChevronRight className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </article>
    </main>
  );
}
