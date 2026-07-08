// Shared types and pure helpers for the admin dashboard.
// The page component owns all state/handlers; the tab components in ./tabs
// are presentation-only and receive everything via props.

export type AdminTab = 'users' | 'songs' | 'approvals' | 'moderation' | 'ads' | 'bot' | 'spotlight' | 'analytics' | 'push' | 'artists';

export type MetricsDailyRow = {
  day: string;
  total_users: number | null;
  new_users: number | null;
  dau: number | null;
  plays: number | null;
  total_plays: number | null;
  new_likes: number | null;
  total_likes: number | null;
  new_songs: number | null;
  total_songs: number | null;
  active_creators: number | null;
  minutes_streamed?: number | null;
  pro_users?: number | null;
};

export interface McpLog {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  response_summary: string;
  created_at: string;
}

export interface ProfileData {
  id: string;
  username: string;
  email?: string;
  last_active_at?: string;
  country?: string;
  created_at: string;
  subscription_tier: string;
  followers_count: number;
  avatar_url?: string;
  is_banned?: boolean;
  role?: string;
  // Device metadata (set by the app's activity ping)
  app_version?: string | null;
  os_version?: string | null;
  device_model?: string | null;
  // Acquisition attribution (set once per install by the app)
  acquisition_source?: string | null;
  acquisition_campaign_id?: string | null;
  // Engagement (merged from get_admin_user_engagement)
  songs_played?: number;
  total_plays?: number;
  last_played_at?: string | null;
  likes?: number;
  follows?: number;
  playlists?: number;
  // Onboarding (from user_music_preferences): null skip = never reached it.
  favorite_genres?: string[] | null;
  onboarding_skipped?: boolean | null;
}

export interface SongData {
  id: string;
  title: string;
  artist_name: string;
  plays: number;
  ai_tool?: string;
  created_at: string;
  is_approved?: boolean;
  audio_url?: string;
  cover_url?: string;
  is_spotlight?: boolean;
  spotlight_copy?: string | null;
  genre?: string | null;
  trending_sort_order?: number | null;
  plays_tracked_total?: number;
  starts_total?: number;
  plays_24h?: number;
  plays_7d?: number;
  plays_30d?: number;
  previous_7d?: number;
  trend_percent?: number;
  unique_listeners?: number;
  likes_count?: number;
  playlist_adds?: number;
  last_played_at?: string | null;
}

export type SongPerformanceRow = {
  song_id: string;
  plays_total: number | string | null;
  plays_tracked_total: number | string | null;
  starts_total: number | string | null;
  plays_24h: number | string | null;
  plays_7d: number | string | null;
  plays_30d: number | string | null;
  previous_7d: number | string | null;
  trend_percent: number | string | null;
  unique_listeners: number | string | null;
  likes: number | string | null;
  playlist_adds: number | string | null;
  last_played_at: string | null;
};

export type HighlightNewsForm = {
  id: string | null;
  enabled: boolean;
  slug: string;
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type NewsPostData = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  is_published: boolean;
  is_featured: boolean;
  published_at?: string | null;
  created_at?: string | null;
};

export interface Report {
  id: string;
  status: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  created_at: string;
  [key: string]: unknown;
}

export interface AdFile {
  id?: string | number;
  name: string;
  created_at?: string;
  metadata?: { size?: number; [key: string]: unknown };
  [key: string]: unknown;
}

export function toAdminNumber(value?: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAdminNumber(value?: number | null) {
  return (value ?? 0).toLocaleString('de-DE');
}

export function formatTrendPercent(value?: number | null) {
  const number = value ?? 0;
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%`;
}

export function getTrendClasses(value?: number | null) {
  const number = value ?? 0;
  if (number > 0) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
  if (number < 0) return 'border-red-400/25 bg-red-400/10 text-red-300';
  return 'border-white/10 bg-white/5 text-white/45';
}

export function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function openTrustedExternalUrl(value?: string | null) {
  if (!value) return;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  } catch {
    // Ignore malformed URLs from pending creator submissions.
  }
}

// Reads the real duration (seconds) of an audio File via its metadata, client-side.
export function readAudioFileDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      audio.src = url;
    } catch {
      resolve(null);
    }
  });
}
