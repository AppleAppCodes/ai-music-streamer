import { getDailyTrendingSongs, getPersonalizedSongs, type PlaybackSignal, type SongSignal } from './recommendations';
import { supabase } from './supabase';
import type { DiscoverPlaylist, FeedClip, FeedPreviewSong, Playlist, Song } from './types';

const SONG_SELECT =
  'id, creator_id, title, artist_name, cover_url, audio_url, genre, duration, plays, created_at';
const SONG_SELECT_WITH_PROFILE = `${SONG_SELECT}, profiles!songs_creator_id_fkey(username)`;

type ProfileJoin = { username?: string | null } | { username?: string | null }[] | null;
type SongRow = Song & { profiles?: ProfileJoin };
type PlaylistRow = Playlist & { profiles?: ProfileJoin };
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

export interface DiscoverPlaylistsData {
  communityPlaylists: DiscoverPlaylist[];
  officialPlaylists: DiscoverPlaylist[];
}

const OFFICIAL_PLAYLIST_SIGNALS = ['yoriax', 'official', 'offiziell', 'kuratiert', 'curated', 'admin', 'david', 'heindavid'];

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

function isOfficialPlaylist(row: PlaylistRow, creatorName: string): boolean {
  const haystack = [row.title, row.description, creatorName].filter(Boolean).join(' ').toLowerCase();
  return OFFICIAL_PLAYLIST_SIGNALS.some((signal) => haystack.includes(signal));
}

function mapDiscoverPlaylist(row: PlaylistRow): DiscoverPlaylist {
  const creatorName = getProfileUsername(row.profiles ?? null) || 'Unbekannt';

  return {
    id: row.id,
    user_id: row.user_id ?? null,
    title: row.title,
    description: row.description ?? null,
    cover_url: row.cover_url ?? null,
    is_public: row.is_public ?? null,
    created_at: row.created_at ?? null,
    creatorName,
    isOfficial: isOfficialPlaylist(row, creatorName),
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

export async function loadDiscoverPlaylists(searchQuery = ''): Promise<DiscoverPlaylistsData> {
  const client = requireClient();
  const trimmedQuery = searchQuery.trim();
  let query = client
    .from('playlists')
    .select('id, user_id, title, description, cover_url, is_public, created_at, profiles(username)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(80);

  if (trimmedQuery) {
    query = query.ilike('title', `%${trimmedQuery}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const playlists = ((data || []) as PlaylistRow[]).map(mapDiscoverPlaylist);

  return {
    officialPlaylists: playlists.filter((playlist) => playlist.isOfficial),
    communityPlaylists: playlists.filter((playlist) => !playlist.isOfficial),
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

export async function searchMusic(query: string): Promise<Song[]> {
  if (!query || query.trim() === '') return [];
  const client = requireClient();
  const searchPattern = `%${query}%`;

  const { data, error } = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .or(`title.ilike.${searchPattern},artist_name.ilike.${searchPattern}`)
    .order('plays', { ascending: false })
    .limit(30);

  if (error) {
    // Falls profiles-Join fehlt, Fallback:
    const fallback = await client
      .from('songs')
      .select(SONG_SELECT)
      .or(`title.ilike.${searchPattern},artist_name.ilike.${searchPattern}`)
      .order('plays', { ascending: false })
      .limit(30);

    if (fallback.error) throw new Error(fallback.error.message);
    return ((fallback.data || []) as SongRow[]).map(mapSong);
  }

  return ((data || []) as SongRow[]).map(mapSong);
}

export async function loadArtistSongs(artistName: string): Promise<Song[]> {
  const client = requireClient();

  const { data, error } = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .or(`artist_name.eq."${artistName}",creator_id.in.(select id from profiles where username = "${artistName}")`)
    .order('plays', { ascending: false });

  if (error) {
    // Fallback if subquery fails
    const fallback = await client
      .from('songs')
      .select(SONG_SELECT)
      .eq('artist_name', artistName)
      .order('plays', { ascending: false });

    if (fallback.error) throw new Error(fallback.error.message);
    return ((fallback.data || []) as SongRow[]).map(mapSong);
  }

  return ((data || []) as SongRow[]).map(mapSong);
}

export async function loadPlaylistDetails(playlistId: string): Promise<{ playlist: Playlist; songs: Song[] }> {
  const client = requireClient();

  const { data: playlistRow, error: playlistError } = await client
    .from('playlists')
    .select('id, user_id, title, description, cover_url, is_public, created_at')
    .eq('id', playlistId)
    .single();

  if (playlistError || !playlistRow) {
    throw new Error(playlistError?.message || 'Playlist nicht gefunden');
  }

  const playlist: Playlist = {
    id: playlistRow.id,
    user_id: playlistRow.user_id,
    title: playlistRow.title,
    description: playlistRow.description,
    cover_url: playlistRow.cover_url,
    is_public: playlistRow.is_public,
    created_at: playlistRow.created_at,
  };

  const { data: mappingData } = await client
    .from('playlist_songs')
    .select('song_id, added_at')
    .eq('playlist_id', playlistId)
    .order('added_at', { ascending: false });

  let songs: Song[] = [];

  if (mappingData && mappingData.length > 0) {
    const songIds = mappingData.map((m) => m.song_id);
    const { data: songsData } = await client
      .from('songs')
      .select(SONG_SELECT_WITH_PROFILE)
      .in('id', songIds);

    if (songsData) {
      const songRows = songsData as SongRow[];
      const orderedSongs = mappingData
        .map((m) => {
          const s = songRows.find((s) => s.id === m.song_id);
          if (s) return mapSong(s);
          return null;
        })
        .filter((s): s is Song => Boolean(s));
      songs = orderedSongs;
    }
  }

  return { playlist, songs };
}

export async function checkIsLiked(userId: string, songId: string): Promise<boolean> {
  const client = requireClient();
  const { data, error } = await client
    .from('liked_songs')
    .select('song_id')
    .eq('user_id', userId)
    .eq('song_id', songId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking like status:', error);
    return false;
  }

  return !!data;
}

export async function toggleLike(userId: string, songId: string, isLiked: boolean): Promise<boolean> {
  const client = requireClient();

  if (isLiked) {
    const { error } = await client
      .from('liked_songs')
      .delete()
      .eq('user_id', userId)
      .eq('song_id', songId);
    if (error) throw new Error(error.message);
    return false;
  } else {
    const { error } = await client
      .from('liked_songs')
      .insert({ user_id: userId, song_id: songId });
    if (error) throw new Error(error.message);
    return true;
  }
}

export async function getUserPlaylists(userId: string): Promise<Playlist[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('playlists')
    .select('id, user_id, title, description, cover_url, is_public, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Playlist[];
}

export async function createPlaylist(userId: string, title: string): Promise<Playlist> {
  const client = requireClient();
  const { data, error } = await client
    .from('playlists')
    .insert({
      user_id: userId,
      title,
      is_public: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Playlist;
}

export async function addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
  const client = requireClient();

  // check if already in playlist
  const { data: existing } = await client
    .from('playlist_songs')
    .select('song_id')
    .eq('playlist_id', playlistId)
    .eq('song_id', songId)
    .single();

  if (existing) return; // already added

  const { error } = await client
    .from('playlist_songs')
    .insert({ playlist_id: playlistId, song_id: songId });
  if (error) throw new Error(error.message);
}

export async function loadCreatedSongs(userId: string): Promise<Song[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .eq('creator_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching created songs:', error);
    return [];
  }

  if (!data) return [];
  return (data as SongRow[]).map(mapSong);
}

export interface ChartsData {
  viralSongs: Song[];
  dailySongs: Song[];
  artistCharts: ArtistStat[];
  dailyPlayMap: Record<string, number>;
}

function buildArtistStatsFromSongs(songs: Song[]): ArtistStat[] {
  const artistMap = new Map<string, ArtistStat & { topSongPlays: number }>();

  songs.forEach((song) => {
    const name = song.artist_name || song.creatorName || 'Unbekannt';
    if (name === 'Unbekannt') return;

    if (!artistMap.has(name)) {
      artistMap.set(name, {
        name,
        plays: 0,
        songsCount: 0,
        coverUrl: song.cover_url || '',
        createdAt: song.created_at || new Date(0).toISOString(),
        topSongPlays: song.plays || 0,
      });
    }

    const artist = artistMap.get(name)!;
    artist.plays += song.plays || 0;
    artist.songsCount += 1;

    if ((song.plays || 0) > artist.topSongPlays) {
      artist.coverUrl = song.cover_url || artist.coverUrl;
      artist.topSongPlays = song.plays || 0;
    }

    if (song.created_at && new Date(song.created_at).getTime() > new Date(artist.createdAt).getTime()) {
      artist.createdAt = song.created_at;
    }
  });

  return Array.from(artistMap.values())
    .sort((a, b) => b.plays - a.plays || b.songsCount - a.songsCount)
    .map((artist) => ({
      name: artist.name,
      plays: artist.plays,
      songsCount: artist.songsCount,
      coverUrl: artist.coverUrl,
      videoUrl: artist.videoUrl,
      createdAt: artist.createdAt,
    }));
}

export async function loadChartsData(): Promise<ChartsData> {
  const client = requireClient();
  const todayUtc = new Date().toISOString().slice(0, 10);

  const [{ data: songsData }, { data: dailyData }] = await Promise.all([
    client.from('songs').select(SONG_SELECT_WITH_PROFILE),
    client.from('song_daily_plays').select('song_id, plays').eq('play_date', todayUtc),
  ]);

  const allSongs = ((songsData || []) as SongRow[]).map(mapSong);
  const dailyPlays = (dailyData || []) as { song_id: string; plays: number }[];

  const dailyPlayMap: Record<string, number> = {};
  for (const { song_id, plays } of dailyPlays) {
    dailyPlayMap[song_id] = plays;
  }

  const viralSongs = [...allSongs]
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 20);

  const dailySongs = [...allSongs]
    .sort((a, b) => {
      const playDiff = (dailyPlayMap[b.id] || 0) - (dailyPlayMap[a.id] || 0);
      return playDiff || b.plays - a.plays;
    })
    .slice(0, 50);
  const artistCharts = buildArtistStatsFromSongs(allSongs).slice(0, 30);

  return { viralSongs, dailySongs, artistCharts, dailyPlayMap };
}

export interface ArtistStat {
  name: string;
  plays: number;
  songsCount: number;
  coverUrl: string;
  videoUrl?: string;
  createdAt: string;
}

export async function loadArtistsData(): Promise<ArtistStat[]> {
  const client = requireClient();

  const { data: songsData, error: songsError } = await client
    .from('songs')
    .select('artist_name, plays, cover_url, created_at');

  if (songsError) throw new Error(songsError.message);

  const artistMap = new Map<string, ArtistStat>();

  (songsData || []).forEach(song => {
    const name = song.artist_name || 'Unbekannt';
    if (name === 'Unbekannt') return;

    if (!artistMap.has(name)) {
      artistMap.set(name, {
        name,
        plays: 0,
        songsCount: 0,
        coverUrl: song.cover_url || '',
        createdAt: song.created_at || new Date(0).toISOString()
      });
    }
    const artist = artistMap.get(name)!;
    artist.plays += (song.plays || 0);
    artist.songsCount += 1;

    if (song.created_at && new Date(song.created_at).getTime() > new Date(artist.createdAt).getTime()) {
      artist.createdAt = song.created_at;
    }
  });

  const artistArray = Array.from(artistMap.values());

  const { data: banners } = await client.storage.from('covers').list('banners', { limit: 100 });
  if (banners) {
    artistArray.forEach(artist => {
      const sanitizedName = artist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const videoFiles = banners.filter(f => f.name.startsWith(sanitizedName + '_video'));
      if (videoFiles.length > 0) {
        videoFiles.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        const videoFile = videoFiles[0];
        const { data: urlData } = client.storage
          .from('covers')
          .getPublicUrl(`banners/${videoFile.name}`);
        artist.videoUrl = urlData.publicUrl;
      }
    });
  }

  return artistArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
