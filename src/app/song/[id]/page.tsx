import type { Metadata } from 'next';

import { createPublicClient } from '@/utils/supabase/public';
import SongPageClient from './SongPageClient';

interface SongPageProps {
  params: Promise<{ id: string }>;
}

const SITE_URL = 'https://www.yoriax.com';
const FALLBACK_OG_IMAGE = '/brand/yoriax-og.png';

type SongMetadataRow = {
  id: string;
  title: string | null;
  artist_name: string | null;
  cover_url: string | null;
  created_at: string | null;
  profiles?: { username?: string | null } | { username?: string | null }[] | null;
};

function getProfileUsername(profiles: SongMetadataRow['profiles']) {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.username ?? null;
  return profiles.username ?? null;
}

function absoluteUrl(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return `${SITE_URL}${FALLBACK_OG_IMAGE}`;

  try {
    return new URL(pathOrUrl, SITE_URL).toString();
  } catch {
    return `${SITE_URL}${FALLBACK_OG_IMAGE}`;
  }
}

async function loadSongMetadata(id: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('songs')
    .select('id, title, artist_name, cover_url, created_at, profiles!songs_creator_id_fkey(username)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as SongMetadataRow;
}

export async function generateMetadata({ params }: SongPageProps): Promise<Metadata> {
  const { id } = await params;
  const song = await loadSongMetadata(id);

  if (!song) {
    return {
      title: 'Song auf YORIAX',
      description: 'Entdecke AI-Musik auf YORIAX.',
      alternates: { canonical: `/song/${id}` },
    };
  }

  const title = song.title?.trim() || 'YORIAX Song';
  const artist = song.artist_name?.trim() || getProfileUsername(song.profiles)?.trim() || 'YORIAX Artist';
  const year = song.created_at ? new Date(song.created_at).getFullYear() : null;
  const description = `${artist} · Song${year ? ` · ${year}` : ''}`;
  const url = `${SITE_URL}/song/${encodeURIComponent(song.id)}`;
  const imageUrl = absoluteUrl(song.cover_url);
  const imageAlt = `${title} von ${artist}`;

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
          height: 1200,
          alt: imageAlt,
        },
      ],
      locale: 'de_DE',
      type: 'website',
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

export default async function SongPage({ params }: SongPageProps) {
  const { id } = await params;
  return <SongPageClient songId={id} />;
}
