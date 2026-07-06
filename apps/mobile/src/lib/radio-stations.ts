/**
 * Radio stations, v1: endless personal mixes.
 *
 * A station only assembles a shuffled starter queue — the endless part is the
 * existing autoplay engine in player-context, which keeps appending
 * genre-similar songs whenever the queue runs out. Station lineup follows the
 * actual catalogue (only genres/moods with enough approved songs).
 *
 * Deliberately its own module: music-data.ts is Codex's active workspace.
 */

import type { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import type { Song } from './types';
import { getGenreId, MUSIC_GENRES, type MusicGenre } from './genre-catalog';

const SONG_SELECT =
  'id, creator_id, title, artist_name, cover_url, audio_url, genre, secondary_genre, duration, plays, created_at, is_spotlight, spotlight_copy, is_approved, trending_sort_order';
const STATION_SIZE = 40;
const MIN_STATION_SONGS = 5;
const CANDIDATE_LIMIT = 400;

// Genres with a meaningful amount of approved songs (checked 2026-07-06).
const GENRE_STATION_IDS = [
  'deep-house',
  'hip-hop',
  'rnb',
  'chillhop',
  'phonk',
  'hardstyle',
  'latin',
  'afrobeat',
  'drum-and-bass',
] as const;

export const GENRE_STATIONS: MusicGenre[] = GENRE_STATION_IDS
  .map((id) => MUSIC_GENRES.find((genre) => genre.id === id))
  .filter((genre): genre is MusicGenre => Boolean(genre));

export type MoodStation = {
  id: string;
  dbValue: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export const MOOD_STATIONS: MoodStation[] = [
  { id: 'happy', dbValue: 'happy', labelKey: 'radio.moodHappy', icon: 'happy', color: '#f59e0b' },
  { id: 'chill', dbValue: 'chill', labelKey: 'radio.moodChill', icon: 'cafe', color: '#38bdf8' },
  { id: 'energetic', dbValue: 'energetic', labelKey: 'radio.moodEnergetic', icon: 'flash', color: '#ef4444' },
  { id: 'dark', dbValue: 'dark', labelKey: 'radio.moodDark', icon: 'moon', color: '#7c3aed' },
];

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// PostgREST or() needs quoted patterns so spaces/apostrophes survive.
function quotedPattern(value: string): string {
  return `"${value.replace(/["\\]/g, '')}"`;
}

function aliasFilter(aliases: string[], columns: string[]): string {
  return aliases
    .flatMap((alias) => columns.map((column) => `${column}.ilike.${quotedPattern(alias)}`))
    .join(',');
}

async function fetchApprovedSongs(orFilter: string | null): Promise<Song[]> {
  if (!supabase) return [];
  let query = supabase.from('songs').select(SONG_SELECT).eq('is_approved', true).limit(CANDIDATE_LIMIT);
  if (orFilter) query = query.or(orFilter);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Song[];
}

async function toStationQueue(orFilter: string | null): Promise<Song[]> {
  let songs = await fetchApprovedSongs(orFilter);
  if (songs.length < MIN_STATION_SONGS && orFilter) {
    // Thin station → widen to the whole catalogue instead of a dead tile.
    songs = await fetchApprovedSongs(null);
  }
  return shuffle(songs).slice(0, STATION_SIZE);
}

export async function fetchGenreStationSongs(station: MusicGenre): Promise<Song[]> {
  const aliases = Array.from(new Set([station.label, ...station.aliases]));
  return toStationQueue(aliasFilter(aliases, ['genre', 'secondary_genre']));
}

export async function fetchMoodStationSongs(station: MoodStation): Promise<Song[]> {
  return toStationQueue(`mood.ilike.${quotedPattern(station.dbValue)}`);
}

/** Personal station from the onboarding favorite genres; falls back to all. */
export async function fetchMixStationSongs(userId: string): Promise<Song[]> {
  let aliases: string[] = [];
  if (supabase) {
    const { data } = await supabase
      .from('user_music_preferences')
      .select('favorite_genres')
      .eq('user_id', userId)
      .maybeSingle();
    const favorites: string[] = Array.isArray(data?.favorite_genres) ? data.favorite_genres : [];
    aliases = Array.from(
      new Set(
        favorites.flatMap((favorite) => {
          const catalogEntry = MUSIC_GENRES.find((genre) => genre.id === getGenreId(favorite));
          return catalogEntry ? [catalogEntry.label, ...catalogEntry.aliases] : [favorite];
        }),
      ),
    );
  }
  return toStationQueue(aliases.length > 0 ? aliasFilter(aliases, ['genre', 'secondary_genre']) : null);
}
