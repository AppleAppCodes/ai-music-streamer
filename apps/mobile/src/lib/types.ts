export interface Song {
  id: string;
  title: string;
  artist_name?: string | null;
  cover_url: string;
  audio_url: string;
  genre?: string | null;
  duration?: number | null;
  plays: number;
}

export interface FeedClip {
  song_id: string;
  video_url?: string | null;
  hook_start_seconds: number;
  hook_end_seconds: number;
}
