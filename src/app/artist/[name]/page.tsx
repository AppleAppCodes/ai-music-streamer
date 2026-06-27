import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { createPublicClient } from '@/utils/supabase/public';
import { createClient as createServerClient } from '@/utils/supabase/server';
import ArtistPageClient from './ArtistPageClient';

interface ArtistPageProps {
  params: Promise<{ name: string }>;
}

const SITE_URL = 'https://www.yoriax.com';
const FALLBACK_OG_IMAGE = '/brand/yoriax-og.png';

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

function sanitizedStorageName(artistName: string) {
  return artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function absoluteUrl(url: string | null | undefined) {
  if (!url) return `${SITE_URL}${FALLBACK_OG_IMAGE}`;
  try {
    return new URL(url, SITE_URL).toString();
  } catch {
    return `${SITE_URL}${FALLBACK_OG_IMAGE}`;
  }
}

async function loadArtistShareImage(artistName: string): Promise<string | null> {
  const supabase = createPublicClient();
  const sanitized = sanitizedStorageName(artistName);

  const { data: bannerFiles } = await supabase.storage
    .from('covers')
    .list('banners', { search: sanitized });

  const banner = (bannerFiles ?? [])
    .filter((file) => file.name.startsWith(sanitized) && !file.name.includes('_video'))
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
    return {
      title: 'Künstler nicht gefunden',
      robots: { index: false, follow: false },
    };
  }

  const title = `${displayName} auf YORIAX`;
  const descriptionParts: string[] = [];
  if (songCount > 0) descriptionParts.push(`${songCount} ${songCount === 1 ? 'Song' : 'Songs'}`);
  if (totalPlays > 0) descriptionParts.push(`${totalPlays.toLocaleString('de-DE')} Aufrufe`);
  const description = descriptionParts.length > 0
    ? `${displayName} — ${descriptionParts.join(' · ')} auf YORIAX.`
    : `Entdecke ${displayName} auf YORIAX.`;

  const url = `${SITE_URL}/artist/${encodeURIComponent(displayName)}`;
  const imageUrl = absoluteUrl(shareImage);
  const imageAlt = `${displayName} auf YORIAX`;

  return {
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
      locale: 'de_DE',
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
  return <ArtistPageClient artistName={artistName} />;
}
