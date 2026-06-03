import type { Song } from './types';

export interface SongSignal {
  song_id: string;
}

export interface PlaybackSignal extends SongSignal {
  play_count: number;
  last_played_at: string;
}

interface RecommendationSignals {
  likedSongs: SongSignal[];
  playlistSongs: SongSignal[];
  savedSongs: SongSignal[];
  playbackHistory: PlaybackSignal[];
}

function getLocalDateSeed(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededUnit(value: string): number {
  return stableHash(value) / 4294967295;
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() || '';
}

function increase(map: Map<string, number>, key: string, amount: number) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function dailyShuffle(songs: Song[], namespace: string, date: Date): Song[] {
  const seed = `${namespace}:${getLocalDateSeed(date)}`;
  return [...songs].sort(
    (left, right) => stableHash(`${seed}:${left.id}`) - stableHash(`${seed}:${right.id}`),
  );
}

export function getDailyTrendingSongs(songs: Song[], limit = 4, date = new Date()): Song[] {
  return dailyShuffle(songs, 'trending', date).slice(0, limit);
}

export function getPersonalizedSongs(
  songs: Song[],
  signals: RecommendationSignals,
  limit = 4,
  date = new Date(),
): Song[] {
  const songsById = new Map(songs.map((song) => [song.id, song]));
  const genreAffinity = new Map<string, number>();
  const artistAffinity = new Map<string, number>();
  const playbackCounts = new Map<string, number>();
  const likedIds = new Set(signals.likedSongs.map((item) => item.song_id));
  const playlistIds = new Set(signals.playlistSongs.map((item) => item.song_id));
  const savedIds = new Set(signals.savedSongs.map((item) => item.song_id));
  const dateSeed = getLocalDateSeed(date);

  const addAffinity = (songId: string, genreWeight: number, artistWeight: number) => {
    const song = songsById.get(songId);
    if (!song) return;
    increase(genreAffinity, normalize(song.genre), genreWeight);
    increase(artistAffinity, normalize(song.artist_name || song.creatorName), artistWeight);
  };

  signals.likedSongs.forEach(({ song_id }) => addAffinity(song_id, 12, 9));
  signals.playlistSongs.forEach(({ song_id }) => addAffinity(song_id, 7, 5));
  signals.savedSongs.forEach(({ song_id }) => addAffinity(song_id, 9, 7));

  signals.playbackHistory.forEach(({ song_id, play_count, last_played_at }) => {
    const daysSincePlay = Math.max(0, (date.getTime() - new Date(last_played_at).getTime()) / 86_400_000);
    const recencyMultiplier = Math.max(0.35, 1 - Math.min(daysSincePlay, 60) / 90);
    const strength = Math.min(4, Math.log2(Math.max(1, play_count) + 1)) * recencyMultiplier;
    playbackCounts.set(song_id, play_count);
    addAffinity(song_id, strength * 4, strength * 3);
  });

  const hasTasteProfile = genreAffinity.size > 0 || artistAffinity.size > 0;
  if (!hasTasteProfile) {
    return dailyShuffle(songs, 'recommendations', date).slice(0, limit);
  }

  return [...songs]
    .map((song) => {
      const repeatedPlays = playbackCounts.get(song.id) || 0;
      const popularity = Math.log10(Math.max(0, song.plays || 0) + 1) * 1.25;
      const discoveryBonus = likedIds.has(song.id) || playlistIds.has(song.id) || savedIds.has(song.id) ? 0 : 4;
      const score =
        (genreAffinity.get(normalize(song.genre)) || 0) +
        (artistAffinity.get(normalize(song.artist_name || song.creatorName)) || 0) +
        (likedIds.has(song.id) ? 2 : 0) +
        (playlistIds.has(song.id) ? 1 : 0) +
        (savedIds.has(song.id) ? 1.5 : 0) +
        discoveryBonus +
        popularity -
        Math.min(repeatedPlays, 8) * 1.25 +
        seededUnit(`recommendations:${dateSeed}:${song.id}`) * 3;

      return { song, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ song }) => song);
}
