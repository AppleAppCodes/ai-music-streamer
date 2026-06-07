import { MetadataRoute } from 'next';
import { createClient } from '@/utils/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const baseUrl = 'https://www.yoriax.com';

  // Fetch top 1000 songs for the sitemap
  const { data: songs } = await supabase
    .from('songs')
    .select('id, created_at')
    .order('plays', { ascending: false })
    .limit(1000);

  const songUrls = (songs || []).map((song) => ({
    url: `${baseUrl}/song/${song.id}`,
    lastModified: new Date(song.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/charts/viral`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/discover/playlists`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...songUrls,
  ];
}
