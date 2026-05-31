'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { X, Plus, Music, Loader2, Check, Trash2 } from 'lucide-react';

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
  const [alreadyIn, setAlreadyIn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlaylists() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        onClose();
        return;
      }

      // Fetch playlists of the user
      const { data: plData, error: plError } = await supabase
        .from('playlists')
        .select('id, title, cover_url')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      // Fetch which of these playlists already contain the song
      const { data: songPlData, error: spError } = await supabase
        .from('playlist_songs')
        .select('playlist_id')
        .eq('song_id', songId);

      if (plData) {
        setPlaylists(plData);
      }
      if (songPlData) {
        const ids = songPlData.map((rec: any) => rec.playlist_id);
        setAlreadyIn(new Set(ids));
      }
      setLoading(false);
    }
    loadPlaylists();
  }, [supabase, onClose]);

  const handleAddToPlaylist = async (playlistId: string) => {
    setAddingTo(playlistId);
    try {
      const { error } = await supabase
        .from('playlist_songs')
        .insert({ playlist_id: playlistId, song_id: songId });
      if (error && error.code !== '23505') {
        console.error('Error adding to playlist:', error);
      } else {
        // Update state to show it as already added
        setAlreadyIn(prev => new Set(prev).add(playlistId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingTo(null);
    }
  };

  const handleRemoveFromPlaylist = async (playlistId: string) => {
    setAddingTo(playlistId);
    try {
      const { error } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('song_id', songId);
      if (error) {
        console.error('Error removing from playlist:', error);
      } else {
        // Update state to remove from alreadyIn set
        setAlreadyIn(prev => {
          const newSet = new Set(prev);
          newSet.delete(playlistId);
          return newSet;
        });
      }
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
                  onClick={() => {
                    if (alreadyIn.has(playlist.id)) {
                      handleRemoveFromPlaylist(playlist.id);
                    } else {
                      handleAddToPlaylist(playlist.id);
                    }
                  }}
                  disabled={addingTo !== null}
                  className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-lg transition-colors text-left group disabled:opacity-50"
                >
                  {alreadyIn.has(playlist.id) ? (
                    <Trash2 className="w-5 h-5 text-red-400" />
                  ) : (
                    <Plus className="w-5 h-5 text-white" />
                  )}
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
