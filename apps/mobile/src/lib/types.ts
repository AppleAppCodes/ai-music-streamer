export interface Song {
  id: string;
  title: string;
  creator_id?: string | null;
  creatorName?: string | null;
  artist_name?: string | null;
  cover_url: string;
  audio_url: string;
  genre?: string | null;
  duration?: number | null;
  plays: number;
  created_at?: string | null;
}

export interface FeedClip {
  song_id: string;
  video_url?: string | null;
  hook_start_seconds: number;
  hook_end_seconds: number;
}

export interface FeedPreviewSong extends Song {
  clip: FeedClip;
  likes_count?: number;
  isLiked?: boolean;
  isFollowingArtist?: boolean;
}

export interface Playlist {
  id: string;
  user_id?: string | null;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  is_public?: boolean | null;
  created_at?: string | null;
}

export interface DiscoverPlaylist extends Playlist {
  creatorName: string;
  isOfficial: boolean;
}
