import { Song } from '@/lib/types';

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
  return [...songs].sort((left, right) => (
    stableHash(`${seed}:${left.id}`) - stableHash(`${seed}:${right.id}`)
  ));
}

// Trending must never include House or Chillhop, and should lean heavily toward RnB.
const EXCLUDED_TRENDING_GENRES = /house|chillhop/i;

function isRnbGenre(song: Song): boolean {
  const g = normalize(song.genre);
  return g === 'rnb' || g === 'r&b' || g === 'r and b';
}

export function getDailyTrendingSongs(songs: Song[], limit = 4, date = new Date()): Song[] {
  // Never surface House (e.g. "Deephouse") or Chillhop in Trending.
  const eligible = songs.filter((song) => !EXCLUDED_TRENDING_GENRES.test(song.genre || ''));
  const shuffled = dailyShuffle(eligible, 'trending', date);

  const rnb = shuffled.filter(isRnbGenre);
  const others = shuffled.filter((song) => !isRnbGenre(song));

  // Mostly RnB: aim for ~70% of the slots, then fill the rest with variety.
  const rnbTarget = Math.min(rnb.length, Math.max(1, Math.ceil(limit * 0.7)));
  const selection = [
    ...rnb.slice(0, rnbTarget),
    ...others.slice(0, Math.max(0, limit - rnbTarget)),
  ];

  // Top up from whatever remains if a bucket was short, so we still return up to `limit`.
  if (selection.length < limit) {
    const used = new Set(selection.map((song) => song.id));
    for (const song of [...rnb, ...others]) {
      if (selection.length >= limit) break;
      if (!used.has(song.id)) {
        used.add(song.id);
        selection.push(song);
      }
    }
  }

  // Re-shuffle (daily) so the RnB-heavy mix isn't a rigid block but rotates.
  return dailyShuffle(selection.slice(0, limit), 'trending-order', date);
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
    increase(artistAffinity, normalize(song.artist_name), artistWeight);
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
        (artistAffinity.get(normalize(song.artist_name)) || 0) +
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
