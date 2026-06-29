import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { createPublicClient } from '@/utils/supabase/public';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { getArtistStorageSlug, isArtistBannerFile } from '@/lib/artist-media';
import { absoluteUrl, breadcrumbStructuredData, buildPageMetadata, jsonLdScript, SITE_NAME, SITE_URL } from '@/lib/seo';
import ArtistPageClient from './ArtistPageClient';

interface ArtistPageProps {
  params: Promise<{ name: string }>;
}

function decodeArtistNameParam(value: string) {
  let decoded = value;

  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  return decoded;
}

async function loadArtistShareImage(artistName: string): Promise<string | null> {
  const supabase = createPublicClient();
  const artistStorageSlug = getArtistStorageSlug(artistName);

  const { data: bannerFiles } = await supabase.storage
    .from('covers')
    .list('banners', { search: artistStorageSlug });

  const banner = (bannerFiles ?? [])
    .filter((file) => isArtistBannerFile(file.name, artistStorageSlug))
    .sort((a, b) => {
      const ta = new Date(a.updated_at || a.created_at || 0).getTime();
      const tb = new Date(b.updated_at || b.created_at || 0).getTime();
      return tb - ta;
    })[0];

  if (banner) {
    const { data } = supabase.storage.from('covers').getPublicUrl(`banners/${banner.name}`);
    const cacheKey = banner.updated_at || banner.created_at || banner.name;
    return `${data.publicUrl}?v=${encodeURIComponent(cacheKey)}`;
  }

  // Fall back to the artist's most-played song cover so a share still has a relevant image.
  const { data: songRow } = await supabase
    .from('songs')
    .select('cover_url')
    .ilike('artist_name', artistName)
    .not('cover_url', 'is', null)
    .order('plays', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (songRow?.cover_url) {
    return songRow.cover_url as string;
  }

  return null;
}

async function loadArtistMetadata(artistName: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('songs')
    .select('artist_name, plays')
    .ilike('artist_name', artistName)
    .limit(50);

  if (error || !data || data.length === 0) {
    return { displayName: artistName, totalPlays: 0, songCount: 0 };
  }

  const displayName = (data[0]?.artist_name as string | undefined)?.trim() || artistName;
  const totalPlays = data.reduce((sum, row) => sum + ((row.plays as number | null) ?? 0), 0);
  return { displayName, totalPlays, songCount: data.length };
}

/**
 * The artist page is only publicly visible when the artist actually has at
 * least one approved song. Until then the profile (banner / video / socials)
 * stays hidden from everyone except the admins/mods and the creator who
 * uploaded the pending songs themselves — those callers see at least one
 * row thanks to the songs SELECT RLS policy.
 */
async function isArtistVisible(artistName: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('songs')
    .select('id')
    .ilike('artist_name', artistName)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { name } = await params;
  const artistName = decodeArtistNameParam(name);

  const [visible, { displayName, totalPlays, songCount }, shareImage] = await Promise.all([
    isArtistVisible(artistName),
    loadArtistMetadata(artistName),
    loadArtistShareImage(artistName),
  ]);

  if (!visible) {
    // Profile is not publicly visible yet (no approved songs). Don't index it.
    return buildPageMetadata({
      title: 'Artist not found',
      description: 'This artist is not publicly visible on YORIAX yet.',
      path: `/artist/${encodeURIComponent(artistName)}`,
      noIndex: true,
    });
  }

  const title = `${displayName} on YORIAX`;
  const descriptionParts: string[] = [];
  if (songCount > 0) descriptionParts.push(`${songCount} ${songCount === 1 ? 'song' : 'songs'}`);
  if (totalPlays > 0) descriptionParts.push(`${totalPlays.toLocaleString('en-US')} plays`);
  const description = descriptionParts.length > 0
    ? `${displayName} — ${descriptionParts.join(' · ')} on YORIAX.`
    : `Discover ${displayName} on YORIAX.`;

  const url = `${SITE_URL}/artist/${encodeURIComponent(displayName)}`;
  const imageUrl = absoluteUrl(shareImage);
  const imageAlt = `${displayName} on YORIAX`;

  return {
    ...buildPageMetadata({
      title,
      description,
      path: `/artist/${encodeURIComponent(displayName)}`,
      image: imageUrl,
      imageAlt,
    }),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'YORIAX',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
      locale: 'en_US',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [
        {
          url: imageUrl,
          alt: imageAlt,
        },
      ],
    },
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { name } = await params;
  const artistName = decodeArtistNameParam(name);
  if (!(await isArtistVisible(artistName))) {
    notFound();
  }
  const [{ displayName, totalPlays, songCount }, shareImage] = await Promise.all([
    loadArtistMetadata(artistName),
    loadArtistShareImage(artistName),
  ]);
  const url = `${SITE_URL}/artist/${encodeURIComponent(displayName)}`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      '@id': `${url}#artist`,
      name: displayName,
      url,
      image: absoluteUrl(shareImage),
      interactionStatistic: totalPlays > 0 ? {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ListenAction',
        userInteractionCount: totalPlays,
      } : undefined,
      track: songCount > 0 ? {
        '@type': 'ItemList',
        numberOfItems: songCount,
        name: `${displayName} songs on ${SITE_NAME}`,
      } : undefined,
    },
    breadcrumbStructuredData([
      { name: 'YORIAX', path: '/' },
      { name: 'AI Artists', path: '/artists' },
      { name: displayName, path: `/artist/${encodeURIComponent(displayName)}` },
    ]),
  ];

  return (
    <>
      <script
        id="yoriax-artist-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(jsonLd)}
      />
      <ArtistPageClient artistName={artistName} />
    </>
  );
}
