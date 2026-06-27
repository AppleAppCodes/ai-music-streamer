import { createPublicClient } from '@/utils/supabase/public';

export type SeoSongPreview = {
  id: string;
  title: string | null;
  artist_name: string | null;
  cover_url: string | null;
};

export async function loadSeoSongPreviews(limit = 6): Promise<SeoSongPreview[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('songs')
      .select('id, title, artist_name, cover_url')
      .order('plays', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as SeoSongPreview[];
  } catch {
    return [];
  }
}
