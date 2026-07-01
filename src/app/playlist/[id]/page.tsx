import type { Metadata } from 'next';

import PlaylistPageClient from './PlaylistPageClient';
import { createPublicClient } from '@/utils/supabase/public';
import { absoluteUrl, breadcrumbStructuredData, buildPageMetadata, jsonLdScript, SITE_NAME, SITE_URL } from '@/lib/seo';

interface PlaylistPageProps {
  params: Promise<{ id: string }>;
}

type PlaylistMetadataRow = {
  id: string;
  title: string | null;
  description: string | null;
  cover_url: string | null;
  is_public: boolean | null;
  is_official: boolean | null;
  created_at: string | null;
  profiles?: { username?: string | null } | { username?: string | null }[] | null;
};

const DAILY_NEW_RELEASES_ID = 'da114eeb-ecea-5e55-9ee1-ea5e5da11111';

function getProfileUsername(profiles: PlaylistMetadataRow['profiles']) {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.username ?? null;
  return profiles.username ?? null;
}

function normalizePlaylistId(id: string) {
  return id === 'daily-new-releases' ? DAILY_NEW_RELEASES_ID : id;
}

async function loadPlaylistMetadata(id: string) {
  if (id === 'daily-new-releases') {
    return {
      playlist: {
        id,
        title: 'Daily New Releases',
        description: 'Fresh AI songs from the latest YORIAX releases, updated daily.',
        cover_url: null,
        is_public: true,
        is_official: true,
        created_at: new Date().toISOString(),
        profiles: { username: 'YORIAX Team' },
      } satisfies PlaylistMetadataRow,
      trackCount: 20,
    };
  }

  const supabase = createPublicClient();
  const dbId = normalizePlaylistId(id);
  const [{ data: playlist, error }, { count }] = await Promise.all([
    supabase
      .from('playlists')
      .select('id, title, description, cover_url, is_public, is_official, created_at, profiles!playlists_user_id_fkey(username)')
      .eq('id', dbId)
      .maybeSingle(),
    supabase
      .from('playlist_songs')
      .select('song_id', { count: 'exact', head: true })
      .eq('playlist_id', dbId),
  ]);

  if (error || !playlist) return null;
  return {
    playlist: playlist as PlaylistMetadataRow,
    trackCount: count ?? 0,
  };
}

export async function generateMetadata({ params }: PlaylistPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await loadPlaylistMetadata(id);

  if (!data || !data.playlist.is_public) {
    return buildPageMetadata({
      title: 'Playlist not found',
      description: 'This playlist is not publicly visible on YORIAX.',
      path: `/playlist/${encodeURIComponent(id)}`,
      noIndex: true,
    });
  }

  const { playlist, trackCount } = data;
  const title = playlist.title?.trim() || 'YORIAX Playlist';
  const creator = playlist.is_official ? 'YORIAX Team' : getProfileUsername(playlist.profiles) ?? 'YORIAX Creator';
  const description = playlist.description?.trim()
    || `${title} by ${creator} on YORIAX${trackCount ? ` with ${trackCount} AI music tracks` : ''}.`;
  const path = `/playlist/${id === DAILY_NEW_RELEASES_ID ? 'daily-new-releases' : playlist.id}`;

  return buildPageMetadata({
    title,
    description,
    path,
    image: playlist.cover_url,
    imageAlt: `${title} playlist on ${SITE_NAME}`,
  });
}

export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const { id } = await params;
  const data = await loadPlaylistMetadata(id);
  const playlistPath = `/playlist/${id === DAILY_NEW_RELEASES_ID ? 'daily-new-releases' : id}`;

  const jsonLd = data?.playlist.is_public ? [
    {
      '@context': 'https://schema.org',
      '@type': 'MusicPlaylist',
      '@id': `${SITE_URL}${playlistPath}#playlist`,
      name: data.playlist.title ?? 'YORIAX Playlist',
      description: data.playlist.description ?? undefined,
      url: `${SITE_URL}${playlistPath}`,
      image: absoluteUrl(data.playlist.cover_url),
      numTracks: data.trackCount,
      creator: {
        '@type': data.playlist.is_official ? 'Organization' : 'Person',
        name: data.playlist.is_official ? SITE_NAME : getProfileUsername(data.playlist.profiles) ?? 'YORIAX Creator',
      },
      datePublished: data.playlist.created_at ?? undefined,
    },
    breadcrumbStructuredData([
      { name: 'YORIAX', path: '/' },
      { name: 'AI Music Playlists', path: '/discover/playlists' },
      { name: data.playlist.title ?? 'YORIAX Playlist', path: playlistPath },
    ]),
  ] : null;

  return (
    <>
      {jsonLd ? (
        <script
          id="yoriax-playlist-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(jsonLd)}
        />
      ) : null}
      <PlaylistPageClient />
    </>
  );
}
