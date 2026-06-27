import type { Metadata } from 'next';

import { createPublicClient } from '@/utils/supabase/public';
import { absoluteUrl, buildPageMetadata, jsonLdScript, secondsToIsoDuration, SITE_NAME, SITE_URL } from '@/lib/seo';
import SongPageClient from './SongPageClient';

interface SongPageProps {
  params: Promise<{ id: string }>;
}

type SongMetadataRow = {
  id: string;
  title: string | null;
  artist_name: string | null;
  cover_url: string | null;
  created_at: string | null;
  duration: number | null;
  genre: string | null;
};

async function loadSongMetadata(id: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('songs')
    .select('id, title, artist_name, cover_url, created_at, duration, genre')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as SongMetadataRow;
}

export async function generateMetadata({ params }: SongPageProps): Promise<Metadata> {
  const { id } = await params;
  const song = await loadSongMetadata(id);

  if (!song) {
    return buildPageMetadata({
      title: 'Song auf YORIAX',
      description: 'Entdecke AI-Musik auf YORIAX.',
      path: `/song/${id}`,
      noIndex: true,
    });
  }

  const title = song.title?.trim() || 'YORIAX Song';
  const artist = song.artist_name?.trim() || 'YORIAX Artist';
  const year = song.created_at ? new Date(song.created_at).getFullYear() : null;
  const genre = song.genre?.trim();
  const description = `Listen to "${title}" by ${artist} on YORIAX${genre ? `, a ${genre} AI music track` : ''}${year ? ` released in ${year}` : ''}.`;
  const url = `${SITE_URL}/song/${encodeURIComponent(song.id)}`;
  const imageUrl = absoluteUrl(song.cover_url);
  const imageAlt = `${title} von ${artist}`;

  return {
    ...buildPageMetadata({
      title: `${title} by ${artist}`,
      description,
      path: `/song/${song.id}`,
      image: imageUrl,
      imageAlt,
    }),
    title: `${title} by ${artist}`,
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
  const song = await loadSongMetadata(id);
  const title = song?.title?.trim() || 'YORIAX Song';
  const artist = song?.artist_name?.trim() || 'YORIAX Artist';
  const url = `${SITE_URL}/song/${encodeURIComponent(id)}`;

  const songJsonLd = song ? {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    '@id': `${url}#recording`,
    name: title,
    url,
    image: absoluteUrl(song.cover_url),
    datePublished: song.created_at ?? undefined,
    genre: song.genre ?? undefined,
    duration: secondsToIsoDuration(song.duration),
    byArtist: {
      '@type': 'MusicGroup',
      name: artist,
      url: `${SITE_URL}/artist/${encodeURIComponent(artist)}`,
    },
    inAlbum: {
      '@type': 'MusicAlbum',
      name: SITE_NAME,
    },
  } : null;

  return (
    <>
      {songJsonLd ? (
        <script
          id="yoriax-song-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(songJsonLd)}
        />
      ) : null}
      <SongPageClient songId={id} />
    </>
  );
}
