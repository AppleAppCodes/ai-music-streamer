import { getDailyTrendingSongs, getPersonalizedSongs, type PlaybackSignal, type SongSignal } from './recommendations';
import { supabase } from './supabase';
import type { FeedClip, FeedPreviewSong, Playlist, Song } from './types';

const SONG_SELECT =
  'id, creator_id, title, artist_name, cover_url, audio_url, genre, duration, plays, created_at';
const SONG_SELECT_WITH_PROFILE = `${SONG_SELECT}, profiles!songs_creator_id_fkey(username)`;

type ProfileJoin = { username?: string | null } | { username?: string | null }[] | null;
type SongRow = Song & { profiles?: ProfileJoin };
type LikedSongRow = { created_at?: string | null; songs?: SongRow | SongRow[] | null };
type FeedClipJoin = FeedClip | FeedClip[] | null;
type FeedStatsJoin = { likes_count?: number | null } | { likes_count?: number | null }[] | null;
type FeedRow = SongRow & {
  song_feed_clips?: FeedClipJoin;
  song_feed_stats?: FeedStatsJoin;
};

export interface HomeMusicData {
  totalSongs: number;
  trendingSongs: Song[];
  recommendedSongs: Song[];
  latestSongs: Song[];
}

export interface LibraryMusicData {
  likedSongs: Song[];
  playlists: Playlist[];
}

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase Env fehlt.');
  }

  return supabase;
}

function getProfileUsername(profiles: ProfileJoin): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.username ?? null;
  return profiles.username ?? null;
}

function mapSong(row: SongRow): Song {
  const profileName = getProfileUsername(row.profiles ?? null);

  return {
    id: row.id,
    creator_id: row.creator_id ?? null,
    creatorName: profileName || row.artist_name || 'Creator',
    title: row.title,
    artist_name: row.artist_name ?? profileName,
    cover_url: row.cover_url,
    audio_url: row.audio_url,
    genre: row.genre ?? null,
    duration: row.duration ?? null,
    plays: row.plays ?? 0,
    created_at: row.created_at ?? null,
  };
}

function getSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function loadSongs(limit = 200): Promise<Song[]> {
  const client = requireClient();
  const withProfile = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!withProfile.error) {
    return ((withProfile.data || []) as SongRow[]).map(mapSong);
  }

  const fallback = await client
    .from('songs')
    .select(SONG_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return ((fallback.data || []) as SongRow[]).map(mapSong);
}

async function loadSongSignals(userId: string) {
  const client = requireClient();
  const [{ data: likedSongs }, { data: playlists }, { data: savedSongs }, { data: playbackHistory }] =
    await Promise.all([
      client.from('liked_songs').select('song_id').eq('user_id', userId),
      client.from('playlists').select('id').eq('user_id', userId),
      client.from('feed_saves').select('song_id').eq('user_id', userId),
      client.from('user_song_plays').select('song_id, play_count, last_played_at').eq('user_id', userId),
    ]);

  const playlistIds = ((playlists || []) as Array<{ id: string }>).map(({ id }) => id);
  const { data: playlistSongs } =
    playlistIds.length > 0
      ? await client.from('playlist_songs').select('song_id').in('playlist_id', playlistIds)
      : { data: [] };

  return {
    likedSongs: (likedSongs || []) as SongSignal[],
    playlistSongs: (playlistSongs || []) as SongSignal[],
    savedSongs: (savedSongs || []) as SongSignal[],
    playbackHistory: (playbackHistory || []) as PlaybackSignal[],
  };
}

export async function loadHomeMusic(userId: string): Promise<HomeMusicData> {
  const songs = await loadSongs();
  const trendingSongs = getDailyTrendingSongs(songs, 6);
  const signals = await loadSongSignals(userId);
  const rankedRecommendations = getPersonalizedSongs(songs, signals, songs.length);
  const trendingIds = new Set(trendingSongs.map(({ id }) => id));
  const distinctRecommendations = rankedRecommendations.filter(({ id }) => !trendingIds.has(id));

  return {
    totalSongs: songs.length,
    trendingSongs,
    recommendedSongs: (distinctRecommendations.length >= 6 ? distinctRecommendations : rankedRecommendations).slice(0, 6),
    latestSongs: songs.slice(0, 6),
  };
}

export async function loadLibraryMusic(userId: string): Promise<LibraryMusicData> {
  const client = requireClient();
  const [{ data: likedRows, error: likedError }, { data: playlistRows, error: playlistsError }] =
    await Promise.all([
      client
        .from('liked_songs')
        .select(`created_at, songs (${SONG_SELECT})`)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      client
        .from('playlists')
        .select('id, title, cover_url, is_public, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

  if (likedError) throw new Error(likedError.message);
  if (playlistsError) throw new Error(playlistsError.message);

  const likedSongs = ((likedRows || []) as LikedSongRow[])
    .map((item) => getSingle(item.songs))
    .filter((song): song is SongRow => Boolean(song))
    .map(mapSong);

  return {
    likedSongs,
    playlists: (playlistRows || []) as Playlist[],
  };
}

function getClip(row: FeedRow): FeedClip | null {
  return getSingle(row.song_feed_clips);
}

function getLikes(row: FeedRow): number {
  return getSingle(row.song_feed_stats)?.likes_count ?? 0;
}

export async function loadFeedPreview(userId: string): Promise<FeedPreviewSong[]> {
  const client = requireClient();
  const signalsPromise = loadSongSignals(userId);
  const feedQuery = await client
    .from('songs')
    .select(
      `${SONG_SELECT_WITH_PROFILE}, song_feed_clips(song_id, video_url, hook_start_seconds, hook_end_seconds), song_feed_stats(song_id, likes_count)`,
    )
    .order('plays', { ascending: false })
    .limit(80);

  if (feedQuery.error) {
    throw new Error(feedQuery.error.message);
  }

  const feedRows = (feedQuery.data || []) as FeedRow[];
  const songs = feedRows.map(mapSong);
  const signals = await signalsPromise;
  const ranked = getPersonalizedSongs(songs, signals, songs.length)
    .filter((song) => song.genre?.trim().toLocaleLowerCase() !== 'chillhop')
    .slice(0, 12);
  const rowById = new Map(feedRows.map((row) => [row.id, row]));

  return ranked.map((song) => {
    const row = rowById.get(song.id);

    return {
      ...song,
      clip: row ? getClip(row) : null,
      likes_count: row ? getLikes(row) : 0,
    };
  });
}
