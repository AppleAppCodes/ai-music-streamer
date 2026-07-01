import { Mic2, Sparkles, Heart, Globe, Zap, Coffee, Moon, Guitar, Flame, Star, Music, Car, Headphones, Compass, Activity, LucideIcon } from 'lucide-react';

export interface GenreDef {
  name: string;
  icon: LucideIcon;
  color: string;
  glow: string;
}

export const GENRES: GenreDef[] = [
  { name: 'Hip-Hop', icon: Mic2, color: 'bg-orange-500', glow: 'rgba(249, 115, 22, 0.58)' },
  { name: 'Pop', icon: Sparkles, color: 'bg-pink-500', glow: 'rgba(236, 72, 153, 0.58)' },
  { name: 'RnB', icon: Heart, color: 'bg-purple-500', glow: 'rgba(168, 85, 247, 0.58)' },
  { name: 'Afrobeat', icon: Globe, color: 'bg-emerald-500', glow: 'rgba(16, 185, 129, 0.58)' },
  { name: 'Chillhop', icon: Coffee, color: 'bg-amber-700', glow: 'rgba(180, 83, 9, 0.58)' },
  { name: 'Sleep', icon: Moon, color: 'bg-indigo-800', glow: 'rgba(55, 48, 163, 0.58)' },
  { name: 'Country', icon: Guitar, color: 'bg-amber-600', glow: 'rgba(217, 119, 6, 0.58)' },
  { name: 'Latin', icon: Flame, color: 'bg-red-500', glow: 'rgba(239, 68, 68, 0.58)' },
  { name: 'K-Pop', icon: Star, color: 'bg-rose-400', glow: 'rgba(251, 113, 133, 0.58)' },
  { name: 'Classic', icon: Music, color: 'bg-blue-600', glow: 'rgba(37, 99, 235, 0.58)' },
  { name: 'Phonk', icon: Car, color: 'bg-purple-900', glow: 'rgba(88, 28, 135, 0.58)' },
  { name: 'Deephouse', icon: Headphones, color: 'bg-teal-500', glow: 'rgba(20, 184, 166, 0.58)' },
  { name: 'Oriental', icon: Compass, color: 'bg-orange-600', glow: 'rgba(234, 88, 12, 0.58)' },
  { name: 'Hardstyle', icon: Activity, color: 'bg-red-700', glow: 'rgba(185, 28, 28, 0.58)' },
  { name: 'House', icon: Zap, color: 'bg-indigo-500', glow: 'rgba(99, 102, 241, 0.58)' },
  { name: 'Drum \'n\' Bass', icon: Activity, color: 'bg-cyan-600', glow: 'rgba(8, 145, 178, 0.58)' }
];

export const MOODS = ['Happy', 'Sad', 'Energetic', 'Chill', 'Dark', 'Romantic'];
