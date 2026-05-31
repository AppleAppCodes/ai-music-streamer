'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { X, Plus, Music, Loader2 } from 'lucide-react';

interface AddToPlaylistModalProps {
  songId: string;
  onClose: () => void;
}

interface Playlist {
  id: string;
  title: string;
  cover_url: string | null;
}

export default function AddToPlaylistModal({ songId, onClose }: AddToPlaylistModalProps) {
  const supabase = createClient();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlaylists() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        onClose(); // Shouldn't happen if button is only visible when logged in, but just in case
        return;
      }

      const { data } = await supabase
        .from('playlists')
        .select('id, title, cover_url')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setPlaylists(data);
      }
      setLoading(false);
    }
    loadPlaylists();
  }, [supabase, onClose]);

  const handleAddToPlaylist = async (playlistId: string) => {
    setAddingTo(playlistId);
    try {
      // Check if already in playlist to avoid unique constraint error if we add one later, or just insert
      const { error } = await supabase
        .from('playlist_songs')
        .insert({ playlist_id: playlistId, song_id: songId });
      
      if (error && error.code !== '23505') { // 23505 is unique violation, ignore if already exists
        console.error('Error adding to playlist:', error);
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingTo(null);
    }
  };

  const handleCreateAndAdd = async () => {
    setAddingTo('new');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const newTitle = `Meine Playlist #${playlists.length + 1}`;
      
      const { data: newPlaylist, error: createError } = await supabase
        .from('playlists')
        .insert({ 
          user_id: session.user.id, 
          title: newTitle,
          is_public: false 
        })
        .select()
        .single();

      if (createError) throw createError;

      if (newPlaylist) {
        await supabase
          .from('playlist_songs')
          .insert({ playlist_id: newPlaylist.id, song_id: songId });
        onClose();
      }
    } catch (err) {
      console.error('Error creating playlist:', err);
    } finally {
      setAddingTo(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="bg-[#181818] rounded-xl w-full max-w-md shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Zur Playlist hinzufügen</h2>
          <button 
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 overflow-y-auto flex-1">
          <button 
            onClick={handleCreateAndAdd}
            disabled={addingTo !== null}
            className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-lg transition-colors text-left group disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              {addingTo === 'new' ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Plus className="w-6 h-6 text-white" />
              )}
            </div>
            <span className="text-base font-bold text-white">Neue Playlist erstellen</span>
          </button>

          <div className="my-2 border-t border-white/5" />

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center p-8 text-white/50 text-sm">
              Du hast noch keine Playlists.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {playlists.map(playlist => (
                <button
                  key={playlist.id}
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  disabled={addingTo !== null}
                  className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-lg transition-colors text-left group disabled:opacity-50"
                >
                  {playlist.cover_url ? (
                    <img src={playlist.cover_url} alt={playlist.title} className="w-12 h-12 rounded object-cover shadow-md bg-[#282828]" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-[#282828] flex items-center justify-center shadow-md">
                      <Music className="w-5 h-5 text-white/40" />
                    </div>
                  )}
                  <span className="text-base font-medium text-white truncate flex-1">{playlist.title}</span>
                  {addingTo === playlist.id && (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
