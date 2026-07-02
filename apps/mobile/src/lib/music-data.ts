import { getPersonalizedSongs, type PlaybackSignal, type SongSignal } from './recommendations';
import { supabase } from './supabase';
import type { DiscoverPlaylist, FeedClip, FeedPreviewSong, Playlist, Song } from './types';

const SONG_SELECT =
  'id, creator_id, title, artist_name, cover_url, audio_url, genre, duration, plays, created_at, is_spotlight, spotlight_copy, is_approved, trending_sort_order';
const SONG_SELECT_WITH_PROFILE = `${SONG_SELECT}, profiles!songs_creator_id_fkey(username)`;
export const DAILY_NEW_RELEASES_PLAYLIST_ID = 'da114eeb-ecea-5e55-9ee1-ea5e5da11111';

type ProfileJoin = { username?: string | null } | { username?: string | null }[] | null;
type SongRow = Song & { profiles?: ProfileJoin };
type PlaylistRow = Playlist & { profiles?: ProfileJoin };
type LikedSongRow = { created_at?: string | null; songs?: SongRow | SongRow[] | null };
type FeedStatsJoin = { likes_count?: number | null } | { likes_count?: number | null }[] | null;
type FeedRow = SongRow & {
  song_feed_stats?: FeedStatsJoin;
};
type StorageFile = {
  created_at?: string | null;
  metadata?: { mimetype?: string | null } | null;
  name: string;
  updated_at?: string | null;
};

export type ArtistMedia = {
  bannerUrl?: string | null;
  videoUrl?: string | null;
};

export interface SpotlightArtist {
  artist_name: string;
  cover_url: string | null;
  total_plays: number;
  song_count: number;
  spotlight_copy: string | null;
}

export interface SpotlightPlaylist {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  creatorName: string;
}

export interface HomeMusicData {
  totalSongs: number;
  trendingSongs: Song[];
  recommendedSongs: Song[];
  latestSongs: Song[];
  officialPlaylists: DiscoverPlaylist[];
  spotlightSong: Song | null;
  spotlightArtist: SpotlightArtist | null;
  spotlightPlaylist: SpotlightPlaylist | null;
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

function getArtistMediaSlug(artistName: string) {
  return artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function getStorageFileBaseName(fileName: string) {
  return fileName.split('/').pop() ?? fileName;
}

function getStorageFileTimestamp(file: StorageFile) {
  return new Date(file.updated_at || file.created_at || 0).getTime();
}

function isVideoStorageFile(file: StorageFile) {
  const fileName = file.name.toLowerCase();
  const mimeType = file.metadata?.mimetype?.toLowerCase() ?? '';
  return mimeType.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/.test(fileName);
}

function isImageStorageFile(file: StorageFile) {
  const fileName = file.name.toLowerCase();
  const mimeType = file.metadata?.mimetype?.toLowerCase() ?? '';
  return mimeType.startsWith('image/') || /\.(avif|heic|jpe?g|png|webp)$/.test(fileName);
}

function findLatestArtistMediaFile(
  files: StorageFile[],
  artistName: string,
  predicate: (file: StorageFile) => boolean,
) {
  const slug = getArtistMediaSlug(artistName);

  return files
    .filter((file) => getStorageFileBaseName(file.name).toLowerCase().startsWith(slug))
    .filter(predicate)
    .sort((a, b) => getStorageFileTimestamp(b) - getStorageFileTimestamp(a))[0] ?? null;
}

function getCoverPublicUrl(fileName: string) {
  const client = requireClient();
  const storagePath = fileName.startsWith('banners/') ? fileName : `banners/${fileName}`;
  const { data } = client.storage.from('covers').getPublicUrl(storagePath);
  return data.publicUrl;
}

function resolveArtistMediaFromFiles(files: StorageFile[], artistName: string): ArtistMedia {
  const latestVideo = findLatestArtistMediaFile(files, artistName, isVideoStorageFile);
  const latestBanner = findLatestArtistMediaFile(files, artistName, isImageStorageFile);

  return {
    bannerUrl: latestBanner ? getCoverPublicUrl(latestBanner.name) : null,
    videoUrl: latestVideo ? getCoverPublicUrl(latestVideo.name) : null,
  };
}

export async function loadArtistMedia(artistName: string): Promise<ArtistMedia> {
  const client = requireClient();
  const slug = getArtistMediaSlug(artistName);
  const { data: files, error } = await client.storage
    .from('covers')
    .list('banners', {
      limit: 100,
      search: slug,
    });

  if (error || !files) return {};

  return resolveArtistMediaFromFiles(files as StorageFile[], artistName);
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
    is_spotlight: row.is_spotlight ?? false,
    spotlight_copy: row.spotlight_copy ?? null,
    is_approved: row.is_approved ?? true,
    trending_sort_order: row.trending_sort_order ?? null,
  };
}

function isOfficialPlaylist(row: PlaylistRow, creatorName: string): boolean {
  if (row.is_official === true) return true;
  const haystack = [row.title, row.description, creatorName].filter(Boolean).join(' ').toLowerCase();
  return OFFICIAL_PLAYLIST_SIGNALS.some((signal) => haystack.includes(signal));
}

function mapDiscoverPlaylist(row: PlaylistRow): DiscoverPlaylist {
  const isDailyNewReleases = row.id === DAILY_NEW_RELEASES_PLAYLIST_ID;
  const isOfficial = isDailyNewReleases || isOfficialPlaylist(row, getProfileUsername(row.profiles ?? null) || '');
  const creatorName = isOfficial ? 'YORIAX Team' : (getProfileUsername(row.profiles ?? null) || 'Unbekannt');

  return {
    id: row.id,
    user_id: row.user_id ?? null,
    title: row.title,
    description: isDailyNewReleases ? null : (row.description ?? null),
    cover_url: isDailyNewReleases && !row.cover_url ? 'local://yoriax-symbol' : (row.cover_url ?? null),
    is_public: row.is_public ?? null,
    created_at: row.created_at ?? null,
    creatorName,
    isOfficial,
  };
}

function getSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
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

async function loadSongs(limit = 80, orderBy: 'created_at' | 'plays' = 'created_at'): Promise<Song[]> {
  const client = requireClient();
  const withProfile = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .eq('is_approved', true)
    .order(orderBy, { ascending: false })
    .limit(limit);

  if (!withProfile.error) {
    return ((withProfile.data || []) as SongRow[]).map(mapSong);
  }

  const fallback = await client
    .from('songs')
    .select(SONG_SELECT)
    .eq('is_approved', true)
    .order(orderBy, { ascending: false })
    .limit(limit);

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return ((fallback.data || []) as SongRow[]).map(mapSong);
}

async function loadCuratedTrendingSongs(limit = 6): Promise<Song[]> {
  const client = requireClient();
  const withProfile = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .eq('is_approved', true)
    .not('trending_sort_order', 'is', null)
    .order('trending_sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!withProfile.error) {
    return ((withProfile.data || []) as SongRow[]).map(mapSong);
  }

  const fallback = await client
    .from('songs')
    .select(SONG_SELECT)
    .eq('is_approved', true)
    .not('trending_sort_order', 'is', null)
    .order('trending_sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return ((fallback.data || []) as SongRow[]).map(mapSong);
}

export async function loadSongById(songId: string): Promise<Song> {
  const client = requireClient();
  const withProfile = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .eq('id', songId)
    .maybeSingle();

  if (!withProfile.error && withProfile.data) {
    return mapSong(withProfile.data as SongRow);
  }

  const fallback = await client
    .from('songs')
    .select(SONG_SELECT)
    .eq('id', songId)
    .maybeSingle();

  if (fallback.error || !fallback.data) {
    throw new Error(fallback.error?.message || 'Song nicht gefunden');
  }

  return mapSong(fallback.data as SongRow);
}

async function loadSongSignals(userId: string) {
  const client = requireClient();
  const [
    { data: likedSongs },
    { data: playlists },
    { data: savedSongs },
    { data: playbackHistory },
    { data: preferences, error: preferencesError },
  ] =
    await Promise.all([
      client.from('liked_songs').select('song_id').eq('user_id', userId),
      client.from('playlists').select('id').eq('user_id', userId),
      client.from('feed_saves').select('song_id').eq('user_id', userId),
      client.from('user_song_plays').select('song_id, play_count, last_played_at').eq('user_id', userId),
      client
        .from('user_music_preferences')
        .select('favorite_genres')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  if (preferencesError) throw new Error(preferencesError.message);

  const playlistIds = ((playlists || []) as Array<{ id: string }>).map(({ id }) => id);
  const { data: playlistSongs } =
    playlistIds.length > 0
      ? await client.from('playlist_songs').select('song_id').in('playlist_id', playlistIds)
      : { data: [] };

  return {
    favoriteGenres: Array.isArray(preferences?.favorite_genres) ? preferences.favorite_genres : [],
    likedSongs: (likedSongs || []) as SongSignal[],
    playlistSongs: (playlistSongs || []) as SongSignal[],
    savedSongs: (savedSongs || []) as SongSignal[],
    playbackHistory: (playbackHistory || []) as PlaybackSignal[],
  };
}

export async function loadHomeMusic(userId: string): Promise<HomeMusicData> {
  const [curatedTrendingSongs, popularSongs, latestSongs, signals, discoverPlaylistsData, spotlightSong, spotlightArtist, spotlightPlaylist] = await Promise.all([
    loadCuratedTrendingSongs(6),
    loadSongs(96, 'plays'),
    loadSongs(48, 'created_at'),
    loadSongSignals(userId),
    loadDiscoverPlaylists(),
    loadSpotlightSong(),
    loadSpotlightArtist(),
    loadSpotlightPlaylist(),
  ]);
  const songs = mergeSongs(curatedTrendingSongs, popularSongs, latestSongs);
  const trendingSongs = curatedTrendingSongs.slice(0, 6);
  const rankedRecommendations = getPersonalizedSongs(songs, signals, songs.length);
  const trendingIds = new Set(trendingSongs.map(({ id }) => id));
  const distinctRecommendations = rankedRecommendations.filter(({ id }) => !trendingIds.has(id));

  return {
    totalSongs: songs.length,
    trendingSongs,
    recommendedSongs: (distinctRecommendations.length >= 6 ? distinctRecommendations : rankedRecommendations).slice(0, 6),
    latestSongs: latestSongs.slice(0, 6),
    officialPlaylists: discoverPlaylistsData.officialPlaylists,
    spotlightSong,
    spotlightArtist,
    spotlightPlaylist,
  };
}

async function loadSpotlightSong(): Promise<Song | null> {
  const client = requireClient();
  const withProfile = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .eq('is_spotlight', true)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!withProfile.error && withProfile.data) {
    return mapSong(withProfile.data as SongRow);
  }

  const fallback = await client
    .from('songs')
    .select(SONG_SELECT)
    .eq('is_spotlight', true)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallback.error || !fallback.data) {
    return null;
  }

  return mapSong(fallback.data as SongRow);
}

async function loadSpotlightArtist(): Promise<SpotlightArtist | null> {
  const client = requireClient();
  const { data: profile, error: profileError } = await client
    .from('artist_profiles')
    .select('artist_name, spotlight_copy')
    .eq('is_spotlight', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (profileError || !profile?.artist_name) return null;

  const artistName = profile.artist_name as string;
  const spotlightCopy = (profile as { spotlight_copy?: string | null }).spotlight_copy ?? null;

  const { data: songs, error: songsError } = await client
    .from('songs')
    .select('cover_url, plays')
    .ilike('artist_name', artistName)
    .eq('is_approved', true)
    .order('plays', { ascending: false });
  if (songsError) return null;

  const rows = (songs ?? []) as Array<{ cover_url: string | null; plays: number | null }>;
  if (rows.length === 0) return null;

  const totalPlays = rows.reduce((sum, row) => sum + (row.plays ?? 0), 0);
  const cover = rows.find((row) => Boolean(row.cover_url))?.cover_url ?? null;

  return {
    artist_name: artistName,
    cover_url: cover,
    total_plays: totalPlays,
    song_count: rows.length,
    spotlight_copy: spotlightCopy,
  };
}

async function loadSpotlightPlaylist(): Promise<SpotlightPlaylist | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('playlists')
    .select('id, title, description, cover_url, profiles!playlists_user_id_fkey(username)')
    .eq('is_spotlight', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const profiles = (data as { profiles?: ProfileJoin }).profiles ?? null;
  return {
    id: data.id as string,
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? null,
    cover_url: (data.cover_url as string) ?? null,
    creatorName: getProfileUsername(profiles) ?? 'YORIAX Team',
  };
}

// Picks a genre-similar approved song to keep playback going (Spotify-style radio)
// when the queue runs out. Widens the net step by step so it never returns nothing
// for a non-empty catalog: same genre → any genre → repeats allowed.
export async function fetchRadioNextSong(seed: Song, excludeIds: string[]): Promise<Song | null> {
  const client = requireClient();

  const fetchCandidates = async (sameGenre: boolean, exclude: Set<string>): Promise<Song[]> => {
    let query = client
      .from('songs')
      .select(SONG_SELECT)
      .eq('is_approved', true)
      .neq('id', seed.id)
      .limit(60);
    if (sameGenre && seed.genre) query = query.eq('genre', seed.genre);
    const { data } = await query;
    return ((data || []) as SongRow[])
      .map(mapSong)
      .filter((song) => Boolean(song.audio_url) && !exclude.has(song.id));
  };

  const avoidRecent = new Set<string>([seed.id, ...excludeIds]);
  let candidates = await fetchCandidates(true, avoidRecent);
  if (candidates.length === 0) candidates = await fetchCandidates(false, avoidRecent);
  if (candidates.length === 0) candidates = await fetchCandidates(false, new Set<string>([seed.id]));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (b.plays || 0) - (a.plays || 0));
  const pool = candidates.slice(0, Math.min(20, candidates.length));
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
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
    .select('id, user_id, title, description, cover_url, is_public, is_official, created_at, profiles(username)')
    .eq('is_public', true)
    .order('official_sort_order', { ascending: true, nullsFirst: false })
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

function getLikes(row: FeedRow): number {
  return getSingle(row.song_feed_stats)?.likes_count ?? 0;
}

async function loadFeedClipMap(): Promise<Map<string, FeedClip>> {
  const client = requireClient();
  const { data, error } = await client
    .from('song_feed_clips')
    .select('song_id, video_url, hook_start_seconds, hook_end_seconds');

  if (error) {
    throw new Error(error.message);
  }

  const clips = ((data || []) as FeedClip[]).flatMap((clip) => {
    const start = Number(clip.hook_start_seconds);
    const end = Number(clip.hook_end_seconds);

    if (!clip.song_id || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      return [];
    }

    return [{
      ...clip,
      hook_start_seconds: start,
      hook_end_seconds: end,
    }];
  });

  return new Map(clips.map((clip) => [clip.song_id, clip]));
}

export async function loadFeedPreview(userId: string): Promise<FeedPreviewSong[]> {
  const client = requireClient();
  const signalsPromise = loadSongSignals(userId);
  const clipMap = await loadFeedClipMap();
  const configuredSongIds = Array.from(clipMap.keys());

  if (configuredSongIds.length === 0) return [];

  const feedQuery = await client
    .from('songs')
    .select(`${SONG_SELECT_WITH_PROFILE}, song_feed_stats(song_id, likes_count)`)
    .eq('is_approved', true)
    .in('id', configuredSongIds)
    .order('plays', { ascending: false });

  if (feedQuery.error) {
    throw new Error(feedQuery.error.message);
  }

  const feedRows = (feedQuery.data || []) as FeedRow[];
  const songs = feedRows.map(mapSong);
  const signals = await signalsPromise;
  const ranked = getPersonalizedSongs(songs, signals, songs.length)
    .slice(0, 12);
  const rowById = new Map(feedRows.map((row) => [row.id, row]));

  const likedSongsSet = new Set(signals.likedSongs.map(l => l.song_id));

  return ranked.flatMap((song) => {
    const row = rowById.get(song.id);
    const clip = clipMap.get(song.id);

    if (!clip) return [];

    return [{
      ...song,
      clip,
      likes_count: row ? getLikes(row) : 0,
      isLiked: likedSongsSet.has(song.id),
    }];
  });
}

export async function loadFollowingFeed(userId: string): Promise<FeedPreviewSong[]> {
  const client = requireClient();
  const signalsPromise = loadSongSignals(userId);

  const { data: followsData, error: followsError } = await client
    .from('follows')
    .select('artist_name')
    .eq('user_id', userId);
    
  if (followsError) throw new Error(followsError.message);
  
  const followingNames = (followsData || []).map(f => f.artist_name);
  
  if (followingNames.length === 0) return [];

  const clipMap = await loadFeedClipMap();
  const configuredSongIds = Array.from(clipMap.keys());

  if (configuredSongIds.length === 0) return [];

  const feedQuery = await client
    .from('songs')
    .select(`${SONG_SELECT_WITH_PROFILE}, song_feed_stats(song_id, likes_count)`)
    .eq('is_approved', true)
    .in('id', configuredSongIds)
    .in('artist_name', followingNames)
    .order('created_at', { ascending: false })
    .limit(30);

  if (feedQuery.error) throw new Error(feedQuery.error.message);

  const feedRows = (feedQuery.data || []) as FeedRow[];
  const songs = feedRows.map(mapSong);
  const signals = await signalsPromise;
  const likedSongsSet = new Set(signals.likedSongs.map(l => l.song_id));
  
  const rowById = new Map(feedRows.map((row) => [row.id, row]));

  return songs.flatMap((song) => {
    const row = rowById.get(song.id);
    const clip = clipMap.get(song.id);

    if (!clip) return [];

    return [{
      ...song,
      clip,
      likes_count: row ? getLikes(row) : 0,
      isLiked: likedSongsSet.has(song.id),
    }];
  });
}

export async function loadExploreFeed(userId: string): Promise<FeedPreviewSong[]> {
  const client = requireClient();
  const signalsPromise = loadSongSignals(userId);

  const clipMap = await loadFeedClipMap();
  const configuredSongIds = Array.from(clipMap.keys());

  if (configuredSongIds.length === 0) return [];

  const feedQuery = await client
    .from('songs')
    .select(`${SONG_SELECT_WITH_PROFILE}, song_feed_stats(song_id, likes_count)`)
    .eq('is_approved', true)
    .in('id', configuredSongIds)
    .order('created_at', { ascending: false })
    .limit(50);

  if (feedQuery.error) throw new Error(feedQuery.error.message);

  const feedRows = (feedQuery.data || []) as FeedRow[];
  const songs = feedRows.map(mapSong);
  const signals = await signalsPromise;
  const likedSongsSet = new Set(signals.likedSongs.map(l => l.song_id));
  
  const shuffled = [...songs].sort(() => 0.5 - Math.random()).slice(0, 15);
  
  const rowById = new Map(feedRows.map((row) => [row.id, row]));

  return shuffled.flatMap((song) => {
    const row = rowById.get(song.id);
    const clip = clipMap.get(song.id);

    if (!clip) return [];

    return [{
      ...song,
      clip,
      likes_count: row ? getLikes(row) : 0,
      isLiked: likedSongsSet.has(song.id),
    }];
  });
}

export async function searchMusic(query: string): Promise<Song[]> {
  if (!query || query.trim() === '') return [];
  const client = requireClient();
  const searchPattern = `%${query}%`;

  const { data, error } = await client
    .from('songs')
    .select(SONG_SELECT_WITH_PROFILE)
    .eq('is_approved', true)
    .or(`title.ilike.${searchPattern},artist_name.ilike.${searchPattern},genre.ilike.${searchPattern}`)
    .order('plays', { ascending: false })
    .limit(30);

  if (error) {
    // Falls profiles-Join fehlt, Fallback:
    const fallback = await client
      .from('songs')
      .select(SONG_SELECT)
      .eq('is_approved', true)
      .or(`title.ilike.${searchPattern},artist_name.ilike.${searchPattern},genre.ilike.${searchPattern}`)
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
    .eq('is_approved', true)
    .or(`artist_name.eq."${artistName}",creator_id.in.(select id from profiles where username = "${artistName}")`)
    .order('plays', { ascending: false });

  if (error) {
    // Fallback if subquery fails
    const fallback = await client
      .from('songs')
      .select(SONG_SELECT)
      .eq('is_approved', true)
      .eq('artist_name', artistName)
      .order('plays', { ascending: false });

    if (fallback.error) throw new Error(fallback.error.message);
    return ((fallback.data || []) as SongRow[]).map(mapSong);
  }

  return ((data || []) as SongRow[]).map(mapSong);
}

export async function loadPlaylistDetails(playlistId: string): Promise<{ playlist: Playlist; songs: Song[] }> {
  const client = requireClient();

  if (playlistId === DAILY_NEW_RELEASES_PLAYLIST_ID || playlistId === 'daily-new-releases') {
    let coverUrl: string | null = null;
    let videoUrl: string | null = null;
    let videoStoragePath: string | null = null;
    try {
      const { data: dbPlaylist } = await client
        .from('playlists')
        .select('cover_url, video_url, video_storage_path')
        .eq('id', DAILY_NEW_RELEASES_PLAYLIST_ID)
        .maybeSingle();
      if (dbPlaylist) {
        coverUrl = dbPlaylist.cover_url;
        videoUrl = dbPlaylist.video_url;
        videoStoragePath = dbPlaylist.video_storage_path;
      }
    } catch (err) {
      console.error('Failed to load DB daily playlist data:', err);
    }

    const playlist: Playlist = {
      id: DAILY_NEW_RELEASES_PLAYLIST_ID,
      user_id: 'system',
      title: 'Daily New Releases',
      description: null,
      cover_url: coverUrl || 'local://yoriax-symbol',
      is_public: true,
      is_official: true,
      video_url: videoUrl,
      video_storage_path: videoStoragePath,
      created_at: new Date().toISOString(),
      creatorName: 'YORIAX Team',
    };

    const { data: latestSongs, error } = await client
      .from('songs')
      .select(SONG_SELECT_WITH_PROFILE)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(150);

    if (error) throw new Error(error.message);

    const uniqueSongs: Song[] = [];
    const seenArtists = new Set<string>();

    if (latestSongs) {
      const songRows = latestSongs as SongRow[];
      for (const s of songRows) {
        const artist = (s.artist_name || '').trim().toLowerCase();
        if (artist && !seenArtists.has(artist)) {
          seenArtists.add(artist);
          uniqueSongs.push(mapSong(s));
          if (uniqueSongs.length >= 20) {
            break;
          }
        }
      }
    }

    return { playlist, songs: uniqueSongs };
  }

  const { data: playlistRow, error: playlistError } = await client
    .from('playlists')
    .select('id, user_id, title, description, cover_url, is_public, is_official, created_at, video_url, video_storage_path, profiles(username)')
    .eq('id', playlistId)
    .single();

  if (playlistError || !playlistRow) {
    throw new Error(playlistError?.message || 'Playlist nicht gefunden');
  }

  const isOfficial = playlistRow.id === DAILY_NEW_RELEASES_PLAYLIST_ID || isOfficialPlaylist(playlistRow, getProfileUsername(playlistRow.profiles ?? null) || '');
  const creatorName = isOfficial ? 'YORIAX Team' : (getProfileUsername(playlistRow.profiles ?? null) || 'Unbekannt');

  const playlist: Playlist = {
    id: playlistRow.id,
    user_id: playlistRow.user_id,
    title: playlistRow.title,
    description: playlistRow.description,
    cover_url: playlistRow.cover_url,
    is_public: playlistRow.is_public,
    is_official: isOfficial,
    video_url: playlistRow.video_url,
    video_storage_path: playlistRow.video_storage_path,
    created_at: playlistRow.created_at,
    creatorName,
  };

  const { data: mappingData } = await client
    .from('playlist_songs')
    .select('song_id, added_at, position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true, nullsFirst: false })
    .order('added_at', { ascending: false });

  let songs: Song[] = [];

  if (mappingData && mappingData.length > 0) {
    const songIds = mappingData.map((m) => m.song_id);
    const { data: songsData } = await client
      .from('songs')
      .select(SONG_SELECT_WITH_PROFILE)
      .eq('is_approved', true)
      .in('id', songIds);

    if (songsData) {
      const songRows = songsData as SongRow[];
      const songsById = new Map(songRows.map((song) => [song.id, song]));
      const orderedSongs = mappingData
        .map((m) => {
          const s = songsById.get(m.song_id);
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
  if (songId === 'yoriax-audio-ad') return false;
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
  if (songId === 'yoriax-audio-ad') return false;
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
    if (error && error.code !== '23505') throw new Error(error.message);
    return true;
  }
}

export async function loadFeedLikeCount(songId: string): Promise<number> {
  const client = requireClient();

  const { data, error } = await client
    .from('song_feed_stats')
    .select('likes_count')
    .eq('song_id', songId)
    .maybeSingle();

  if (!error && data) {
    return Math.max(0, data.likes_count ?? 0);
  }

  const { count, error: countError } = await client
    .from('liked_songs')
    .select('song_id', { count: 'exact', head: true })
    .eq('song_id', songId);

  if (countError) throw new Error(countError.message);
  return Math.max(0, count ?? 0);
}

export async function loadFollowedArtistNames(userId: string): Promise<string[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('follows')
    .select('artist_name')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  return (data || [])
    .map((item) => item.artist_name?.trim())
    .filter((artistName): artistName is string => Boolean(artistName));
}

export async function toggleArtistFollow(userId: string, artistName: string, isFollowing: boolean): Promise<boolean> {
  const normalizedArtistName = artistName.trim();
  if (!normalizedArtistName) return false;
  const client = requireClient();

  if (isFollowing) {
    const { error } = await client
      .from('follows')
      .delete()
      .eq('user_id', userId)
      .eq('artist_name', normalizedArtistName);

    if (error) throw new Error(error.message);
    return false;
  }

  const { error } = await client
    .from('follows')
    .insert({ user_id: userId, artist_name: normalizedArtistName });

  if (error && error.code !== '23505') throw new Error(error.message);
  return true;
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

export async function removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('song_id', songId);

  if (error) throw new Error(error.message);
}

export async function getPlaylistIdsForSong(playlistIds: string[], songId: string): Promise<string[]> {
  const client = requireClient();
  if (playlistIds.length === 0) return [];

  const { data, error } = await client
    .from('playlist_songs')
    .select('playlist_id')
    .eq('song_id', songId)
    .in('playlist_id', playlistIds);

  if (error) throw new Error(error.message);
  return (data || []).map((row) => row.playlist_id);
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

const CHARTS_CACHE_TTL_MS = 60_000;
let chartsCache: { data: ChartsData; loadedAt: number } | null = null;

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
  if (chartsCache && Date.now() - chartsCache.loadedAt < CHARTS_CACHE_TTL_MS) {
    return chartsCache.data;
  }

  const client = requireClient();
  const todayUtc = new Date().toISOString().slice(0, 10);

  const [viralQuery, artistQuery, dailyQuery] = await Promise.all([
    client.from('songs').select(SONG_SELECT_WITH_PROFILE).eq('is_approved', true).order('plays', { ascending: false }).limit(80),
    client.from('songs').select(SONG_SELECT_WITH_PROFILE).eq('is_approved', true).order('plays', { ascending: false }).limit(200),
    client.from('song_daily_plays').select('song_id, plays').eq('play_date', todayUtc).order('plays', { ascending: false }).limit(50),
  ]);

  if (viralQuery.error) throw new Error(viralQuery.error.message);
  if (artistQuery.error) throw new Error(artistQuery.error.message);
  if (dailyQuery.error) throw new Error(dailyQuery.error.message);

  const viralPool = ((viralQuery.data || []) as SongRow[]).map(mapSong);
  const artistPool = ((artistQuery.data || []) as SongRow[]).map(mapSong);
  const dailyPlays = (dailyQuery.data || []) as { song_id: string; plays: number }[];

  const dailyPlayMap: Record<string, number> = {};
  for (const { song_id, plays } of dailyPlays) {
    dailyPlayMap[song_id] = plays;
  }

  const dailySongIds = dailyPlays.map(({ song_id }) => song_id);
  const dailySongRows =
    dailySongIds.length > 0
      ? await client.from('songs').select(SONG_SELECT_WITH_PROFILE).eq('is_approved', true).in('id', dailySongIds)
      : { data: [], error: null };

  if (dailySongRows.error) throw new Error(dailySongRows.error.message);

  const viralSongs = viralPool.slice(0, 20);
  const songById = new Map<string, Song>();

  [...viralPool, ...((dailySongRows.data || []) as SongRow[]).map(mapSong)].forEach((song) => {
    songById.set(song.id, song);
  });

  const dailySongsFromToday = dailySongIds
    .map((songId) => songById.get(songId))
    .filter((song): song is Song => Boolean(song));
  const dailyIds = new Set(dailySongsFromToday.map(({ id }) => id));
  const dailySongs = [...dailySongsFromToday, ...viralPool.filter((song) => !dailyIds.has(song.id))].slice(0, 50);
  const artistCharts = buildArtistStatsFromSongs(artistPool).slice(0, 30);
  const data = { viralSongs, dailySongs, artistCharts, dailyPlayMap };

  chartsCache = { data, loadedAt: Date.now() };
  return data;
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
    .select('artist_name, plays, cover_url, created_at')
    .eq('is_approved', true);

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

  const { data: banners } = await client.storage.from('covers').list('banners', { limit: 500 });
  if (banners) {
    artistArray.forEach(artist => {
      const artistMedia = resolveArtistMediaFromFiles(banners as StorageFile[], artist.name);
      artist.coverUrl = artistMedia.bannerUrl || artist.coverUrl;
      artist.videoUrl = artistMedia.videoUrl || artist.videoUrl;
    });
  }

  return artistArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
