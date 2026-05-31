export interface User {
  id: string;
  email: string;
  created_at: string;
  role: 'user' | 'admin';
}

export interface CreatorProfile {
  id: string; // references user.id
  username: string;
  bio: string;
  avatar_url: string;
  followers_count: number;
}

export interface Song {
  id: string;
  creator_id: string;
  artist_name?: string;
  title: string;
  cover_url: string;
  audio_url: string;
  genre: string;
  mood: string;
  language: string;
  description: string;
  ai_tool?: string | null;
  human_edit?: number;
  vocals_type?: string;
  credits?: { role: string; name: string }[];
  duration?: number;
  plays: number;
  created_at: string;
  creatorName?: string;
}

export interface Playlist {
  id: string;
  user_id: string;
  title: string;
  cover_url: string;
  is_public: boolean;
  created_at: string;
}

export interface PlaylistSong {
  playlist_id: string;
  song_id: string;
  added_at: string;
}

declare global {
  interface Window {
    addSongToPlaylistPage?: (playlistId: string, songId: string) => void | Promise<void>;
    removeSongFromPlaylistPage?: (playlistId: string, songId: string) => void;
  }
}
