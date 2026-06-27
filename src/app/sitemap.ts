import { MetadataRoute } from 'next';
import { GENRES } from '@/lib/constants';
import { SITE_URL } from '@/lib/seo';
import { createPublicClient } from '@/utils/supabase/public';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/charts/viral`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/discover/playlists`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ai-music`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/ai-songs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/ki-musik`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/genres`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/artists`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/download`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/pro`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/playlist/daily-new-releases`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...GENRES.map((genre) => ({
      url: `${baseUrl}/genre/${encodeURIComponent(genre.name)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    })),
  ];

  try {
    const supabase = createPublicClient();

    const [{ data: songs }, { data: playlists }, { data: artistRows }] = await Promise.all([
      supabase
        .from('songs')
        .select('id, created_at')
        .order('plays', { ascending: false })
        .limit(2000),
      supabase
        .from('playlists')
        .select('id, created_at, is_public')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('songs')
        .select('artist_name, created_at, plays')
        .not('artist_name', 'is', null)
        .order('plays', { ascending: false })
        .limit(2000),
    ]);

    const songUrls = (songs || []).map((song) => ({
      url: `${baseUrl}/song/${song.id}`,
      lastModified: new Date(song.created_at),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));

    const playlistUrls = (playlists || [])
      .filter((playlist) => playlist.id !== 'da114eeb-ecea-5e55-9ee1-ea5e5da11111')
      .map((playlist) => ({
        url: `${baseUrl}/playlist/${playlist.id}`,
        lastModified: new Date(playlist.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));

    const artistMap = new Map<string, Date>();
    (artistRows || []).forEach((row) => {
      const artist = row.artist_name?.trim();
      if (!artist) return;
      if (!artistMap.has(artist)) {
        artistMap.set(artist, row.created_at ? new Date(row.created_at) : now);
      }
    });

    const artistUrls = Array.from(artistMap.entries()).slice(0, 500).map(([artist, lastModified]) => ({
      url: `${baseUrl}/artist/${encodeURIComponent(artist)}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    }));

    return [...staticRoutes, ...songUrls, ...playlistUrls, ...artistUrls];
  } catch {
    return staticRoutes;
  }
}
