import { Mic2, Sparkles, Heart, Globe, Zap, Coffee, Moon, Guitar, Flame, Star, Skull, Music, LucideIcon } from 'lucide-react';

export interface GenreDef {
  name: string;
  icon: LucideIcon;
  color: string;
}

export const GENRES: GenreDef[] = [
  { name: 'Hip-Hop', icon: Mic2, color: 'bg-orange-500' },
  { name: 'Pop', icon: Sparkles, color: 'bg-pink-500' },
  { name: 'RnB', icon: Heart, color: 'bg-purple-500' },
  { name: 'Afrobeat', icon: Globe, color: 'bg-emerald-500' },
  { name: 'EDM', icon: Zap, color: 'bg-cyan-500' },
  { name: 'Chillhop', icon: Coffee, color: 'bg-amber-700' },
  { name: 'Sleep', icon: Moon, color: 'bg-indigo-800' },
  { name: 'Country', icon: Guitar, color: 'bg-amber-600' },
  { name: 'Latin', icon: Flame, color: 'bg-red-500' },
  { name: 'K-Pop', icon: Star, color: 'bg-rose-400' },
  { name: 'Metal', icon: Skull, color: 'bg-stone-600' },
  { name: 'Classic', icon: Music, color: 'bg-blue-600' }
];

export const MOODS = ['Happy', 'Sad', 'Energetic', 'Chill', 'Dark', 'Romantic'];
