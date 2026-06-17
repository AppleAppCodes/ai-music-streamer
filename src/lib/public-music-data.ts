import type { SupabaseClient } from '@supabase/supabase-js';
import { getDailyTrendingSongs, getPersonalizedSongs, type PlaybackSignal, type SongSignal } from '@/lib/homeRecommendations';
import type { Song } from '@/lib/types';

const SONG_SELECT =
  'id, creator_id, title, artist_name, cover_url, audio_url, genre, duration, plays, created_at';

const SONG_SELECT_WITH_PROFILE = `${SONG_SELECT}, profiles!songs_creator_id_fkey(username)`;
const PUBLIC_CHART_SONG_SELECT =
  'id, title, artist_name, cover_url, plays, created_at, genre, duration, viral_sort_order';

type ProfileJoin = { username?: string | null } | { username?: string | null }[] | null;
type SongRow = Song & { profiles?: ProfileJoin; viral_sort_order?: number | null };
type DailyPlay = { song_id: string; plays: number };

type HomeInitialData = {
  artistCovers: string[];
  trendingSongs: Song[];
  recommendedSongs: Song[];
};

export type PublicChartsData = {
  songs: Song[];
  dailyPlays: DailyPlay[];
  weeklyPlays: DailyPlay[];
};

function getProfileUsername(profiles: ProfileJoin): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.username ?? null;
  return profiles.username ?? null;
}

function mapSong(row: SongRow): Song {
  const profileName = getProfileUsername(row.profiles ?? null);

  return {
    ...row,
    creatorName: profileName || row.artist_name || 'Creator',
    artist_name: row.artist_name ?? profileName ?? undefined,
    plays: row.plays ?? 0,
  } as Song;
}

function mapPublicChartSong(row: SongRow): Song {
  return {
    ...row,
    creator_id: row.creator_id ?? '',
    audio_url: row.audio_url ?? '',
    cover_url: row.cover_url ?? '',
    genre: row.genre ?? '',
    duration: row.duration ?? undefined,
    plays: row.plays ?? 0,
    created_at: row.created_at ?? '',
  } as Song;
}

function mergeSongs(...groups: Song[][]): Song[] {
  const merged = new Map<string, Song>();

  groups.flat().forEach((song) => {
    if (!merged.has(song.id)) {
      merged.set(song.id, song);
    }
  });

  return Array.from(merged.values());
}

async function loadSongsByPopularity(client: SupabaseClient, limit: number) {
  const { data, error } = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .order('plays', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data || []) as SongRow[]).map(mapSong);
}

async function loadSongsByDate(client: SupabaseClient, limit: number) {
  const { data, error } = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data || []) as SongRow[]).map(mapSong);
}

async function loadPublicChartSongsByPopularity(client: SupabaseClient, limit: number) {
  const { data, error } = await client
    .from('songs')
    .select(PUBLIC_CHART_SONG_SELECT)
    .order('plays', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data || []) as SongRow[]).map(mapPublicChartSong);
}

async function loadPublicCuratedViralSongs(client: SupabaseClient, limit: number) {
  const { data, error } = await client
    .from('songs')
    .select(PUBLIC_CHART_SONG_SELECT)
    .not('viral_sort_order', 'is', null)
    .order('viral_sort_order', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data || []) as SongRow[]).map(mapPublicChartSong);
}

async function loadPublicChartSongsByIds(client: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from('songs')
    .select(PUBLIC_CHART_SONG_SELECT)
    .in('id', ids);

  if (error) throw new Error(error.message);

  const rowsById = new Map(((data || []) as SongRow[]).map((row) => [row.id, mapPublicChartSong(row)]));
  return ids.map((id) => rowsById.get(id)).filter((song): song is Song => Boolean(song));
}

async function loadSongSignals(client: SupabaseClient, userId: string) {
  const [{ data: likedSongs }, { data: playlists }, { data: savedSongs }, { data: playbackHistory }] = await Promise.all([
    client.from('liked_songs').select('song_id').eq('user_id', userId),
    client.from('playlists').select('id').eq('user_id', userId),
    client.from('feed_saves').select('song_id').eq('user_id', userId),
    client.from('user_song_plays').select('song_id, play_count, last_played_at').eq('user_id', userId),
  ]);

  const playlistIds = ((playlists || []) as Array<{ id: string }>).map(({ id }) => id);
  const { data: playlistSongs } = playlistIds.length > 0
    ? await client.from('playlist_songs').select('song_id').in('playlist_id', playlistIds)
    : { data: [] };

  return {
    likedSongs: (likedSongs || []) as SongSignal[],
    playlistSongs: (playlistSongs || []) as SongSignal[],
    savedSongs: (savedSongs || []) as SongSignal[],
    playbackHistory: (playbackHistory || []) as PlaybackSignal[],
  };
}

export async function loadHomeInitialData(client: SupabaseClient, userId: string): Promise<HomeInitialData> {
  const [popularSongs, recentSongs, signals] = await Promise.all([
    loadSongsByPopularity(client, 96),
    loadSongsByDate(client, 48),
    loadSongSignals(client, userId),
  ]);

  const songs = mergeSongs(popularSongs, recentSongs);
  const artistCovers = Array.from(new Set(songs.map((song) => song.cover_url).filter(Boolean))).slice(0, 4) as string[];
  const trendingSongs = getDailyTrendingSongs(songs, 8);
  const rankedRecommendations = getPersonalizedSongs(songs, signals, songs.length);
  const trendingIds = new Set(trendingSongs.map(({ id }) => id));
  const distinctRecommendations = rankedRecommendations.filter(({ id }) => !trendingIds.has(id));

  return {
    artistCovers,
    trendingSongs,
    recommendedSongs: (distinctRecommendations.length >= 8 ? distinctRecommendations : rankedRecommendations).slice(0, 8),
  };
}

export async function loadPublicChartsData(client: SupabaseClient): Promise<PublicChartsData> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoUtc = sevenDaysAgo.toISOString().slice(0, 10);

  const [
    popularSongs,
    curatedSongs,
    { data: dailyData, error: dailyError },
    { data: weeklyData, error: weeklyError },
  ] = await Promise.all([
    loadPublicChartSongsByPopularity(client, 160),
    loadPublicCuratedViralSongs(client, 80),
    client
      .from('song_daily_plays')
      .select('song_id, plays')
      .eq('play_date', todayUtc)
      .order('plays', { ascending: false })
      .limit(50),
    client
      .from('song_daily_plays')
      .select('song_id, plays')
      .gte('play_date', sevenDaysAgoUtc)
      .order('plays', { ascending: false })
      .limit(240),
  ]);

  if (dailyError) throw new Error(dailyError.message);
  if (weeklyError) throw new Error(weeklyError.message);

  const dailyPlays = (dailyData || []) as DailyPlay[];
  const weeklyPlays = (weeklyData || []) as DailyPlay[];
  const dailySongs = await loadPublicChartSongsByIds(client, dailyPlays.map(({ song_id }) => song_id));

  return {
    songs: mergeSongs(curatedSongs, dailySongs, popularSongs),
    dailyPlays,
    weeklyPlays,
  };
}
