import type { Ionicons } from '@expo/vector-icons';

export interface MusicGenre {
  aliases: string[];
  color: string;
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

export const MUSIC_GENRES: MusicGenre[] = [
  { id: 'pop', label: 'Pop', aliases: ['pop'], color: '#ec4899', icon: 'sparkles' },
  { id: 'hip-hop', label: 'Hip-Hop', aliases: ['hip-hop', 'hip hop', 'rap', 'trap'], color: '#f97316', icon: 'flame' },
  { id: 'rnb', label: 'R&B', aliases: ['r&b', 'rnb', 'r and b', 'rhythm and blues'], color: '#a855f7', icon: 'heart' },
  { id: 'afrobeat', label: 'Afrobeat', aliases: ['afrobeat', 'afrobeats'], color: '#14b8a6', icon: 'globe' },
  { id: 'amapiano', label: 'Amapiano', aliases: ['amapiano'], color: '#10b981', icon: 'pulse' },
  { id: 'edm', label: 'EDM', aliases: ['edm', 'electronic dance music'], color: '#06b6d4', icon: 'flash' },
  { id: 'house', label: 'House', aliases: ['house'], color: '#6366f1', icon: 'headset' },
  { id: 'deep-house', label: 'Deep House', aliases: ['deep house', 'deephouse'], color: '#0d9488', icon: 'water' },
  { id: 'techno', label: 'Techno', aliases: ['techno'], color: '#8b5cf6', icon: 'radio' },
  { id: 'hardstyle', label: 'Hardstyle', aliases: ['hardstyle'], color: '#dc2626', icon: 'speedometer' },
  { id: 'drum-and-bass', label: 'Drum & Bass', aliases: ['drum & bass', 'drum and bass', 'dnb'], color: '#0891b2', icon: 'stats-chart' },
  { id: 'phonk', label: 'Phonk', aliases: ['phonk'], color: '#7c3aed', icon: 'car-sport' },
  { id: 'rock', label: 'Rock', aliases: ['rock'], color: '#ef4444', icon: 'musical-notes' },
  { id: 'indie', label: 'Indie', aliases: ['indie', 'indie pop', 'indie rock'], color: '#f59e0b', icon: 'color-palette' },
  { id: 'metal', label: 'Metal', aliases: ['metal', 'heavy metal'], color: '#78716c', icon: 'skull' },
  { id: 'country', label: 'Country', aliases: ['country'], color: '#d97706', icon: 'musical-notes' },
  { id: 'latin', label: 'Latin', aliases: ['latin', 'reggaeton'], color: '#ef4444', icon: 'sunny' },
  { id: 'k-pop', label: 'K-Pop', aliases: ['k-pop', 'kpop'], color: '#fb7185', icon: 'star' },
  { id: 'jazz', label: 'Jazz', aliases: ['jazz'], color: '#f59e0b', icon: 'cafe' },
  { id: 'soul', label: 'Soul', aliases: ['soul'], color: '#c084fc', icon: 'heart-circle' },
  { id: 'reggae', label: 'Reggae', aliases: ['reggae'], color: '#22c55e', icon: 'leaf' },
  { id: 'classical', label: 'Klassik', aliases: ['klassik', 'classic', 'classical'], color: '#2563eb', icon: 'musical-note' },
  { id: 'chillhop', label: 'Chillhop', aliases: ['chillhop', 'lofi', 'lo-fi', 'lo fi'], color: '#b45309', icon: 'cafe-outline' },
  { id: 'sleep', label: 'Sleep', aliases: ['sleep', 'ambient'], color: '#4338ca', icon: 'moon' },
  { id: 'oriental', label: 'Oriental', aliases: ['oriental', 'arabic', 'middle eastern'], color: '#ea580c', icon: 'compass' },
  { id: 'schlager', label: 'Schlager', aliases: ['schlager'], color: '#eab308', icon: 'happy' },
  { id: 'gospel', label: 'Gospel', aliases: ['gospel'], color: '#38bdf8', icon: 'people' },
];

const GENRE_ID_BY_ALIAS = new Map(
  MUSIC_GENRES.flatMap((genre) => (
    [genre.id, genre.label, ...genre.aliases]
      .map((alias) => [normalizeGenreText(alias), genre.id] as const)
  )),
);

function normalizeGenreText(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ') || '';
}

export function getGenreId(value: string | null | undefined): string {
  const normalized = normalizeGenreText(value);
  return GENRE_ID_BY_ALIAS.get(normalized) ?? normalized;
}
