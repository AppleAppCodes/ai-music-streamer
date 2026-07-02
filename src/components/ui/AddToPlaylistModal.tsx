'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/utils/supabase/client';
import { X, Plus, Minus, Music, Loader2, Search } from 'lucide-react';
import Image from 'next/image';

interface AddToPlaylistModalProps {
  songId: string;
  onClose: () => void;
  currentPlaylistId?: string;
  onRemoveFromCurrent?: () => void;
}

interface Playlist {
  id: string;
  title: string;
  cover_url: string | null;
}

interface PlaylistSongRef {
  playlist_id: string;
}

export default function AddToPlaylistModal({ songId, onClose, currentPlaylistId, onRemoveFromCurrent }: AddToPlaylistModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [alreadyIn, setAlreadyIn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadPlaylists() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        onClose();
        return;
      }

      const { data: plData } = await supabase
        .from('playlists')
        .select('id, title, cover_url')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      const playlistIds = (plData || []).map((playlist) => playlist.id);
      const { data: songPlData } = playlistIds.length > 0
        ? await supabase
          .from('playlist_songs')
          .select('playlist_id')
          .eq('song_id', songId)
          .in('playlist_id', playlistIds)
        : { data: [] };

      if (plData) {
        setPlaylists(plData);
      }
      if (songPlData) {
        const ids = (songPlData as PlaylistSongRef[]).map((rec) => rec.playlist_id);
        setAlreadyIn(new Set(ids));
      }
      setLoading(false);
    }
    loadPlaylists();
  }, [supabase, onClose, songId]);

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
        // Notify other components (e.g., playlist detail) about the addition
        if (typeof window.addSongToPlaylistPage === 'function') {
          window.addSongToPlaylistPage(playlistId, songId);
        }
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
        // Notify playlist page to remove the song instantly
        if (currentPlaylistId === playlistId && onRemoveFromCurrent) {
          onRemoveFromCurrent();
        }
        if (typeof window.removeSongFromPlaylistPage === 'function') {
          window.removeSongFromPlaylistPage(playlistId, songId);
        }
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

  const filteredPlaylists = playlists.filter((playlist) =>
    playlist.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const modal = (
    <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div 
        className="yoriax-card mb-[env(safe-area-inset-bottom)] flex max-h-[84dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] sm:mb-0 sm:max-h-[720px] sm:rounded-[1.75rem]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-playlist-title"
      >
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <h2 id="add-to-playlist-title" className="text-xl font-bold text-white">Zur Playlist hinzufügen</h2>
          <button 
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            aria-label="Playlist-Auswahl schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Playlist suchen"
              aria-label="Playlist suchen"
              className="yoriax-input w-full rounded-xl py-2 pl-9 pr-3 text-sm placeholder:text-white/45"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-4">
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
          ) : filteredPlaylists.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/50">
              Keine passende Playlist gefunden.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredPlaylists.map(playlist => (
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
                    <Minus className="w-5 h-5 text-red-400" />
                  ) : (
                    <Plus className="w-5 h-5 text-white" />
                  )}
                  {playlist.cover_url ? (
                    <Image src={playlist.cover_url} alt={playlist.title} width={48} height={48} className="h-12 w-12 rounded-xl bg-surface-hover object-cover shadow-md" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-hover shadow-md">
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

  if (typeof document === 'undefined') return null;

  return createPortal(modal, document.body);
}
