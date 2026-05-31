'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, Clock3, MoreHorizontal, Edit2, Loader2, Trash2, Music } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import LikeButton from '@/components/ui/LikeButton';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import Link from 'next/link';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface PlaylistData {
  id: string;
  user_id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
}

export default function PlaylistPage() {
  const params = useParams();
  const playlistId = params.id as string;
  const router = useRouter();
  
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue } = usePlayer();
  const supabase = createClient();
  
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  
  // Editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadPlaylistData() {
      if (!playlistId) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Fetch Playlist details
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .single();
        
      if (playlistError || !playlistData) {
        console.error('Playlist not found:', playlistError);
        router.push('/playlists');
        return;
      }
      
      setPlaylist(playlistData);
      setEditTitle(playlistData.title);
      
      const owner = session?.user?.id === playlistData.user_id;
      setIsOwner(owner);
      
      // 2. Fetch Songs in playlist
      const { data: mappingData } = await supabase
        .from('playlist_songs')
        .select('song_id, added_at')
        .eq('playlist_id', playlistId)
        .order('added_at', { ascending: false });
        
      if (mappingData && mappingData.length > 0) {
        const songIds = mappingData.map(m => m.song_id);
        const { data: songsData } = await supabase
          .from('songs')
          .select('*')
          .in('id', songIds);
          
        if (songsData) {
          // Reorder songs based on added_at mapping
          const orderedSongs = mappingData.map(m => 
            songsData.find(s => s.id === m.song_id)
          ).filter(Boolean) as Song[];
          setSongs(orderedSongs);
        }
      }
      
      setLoading(false);
    }
    
    loadPlaylistData();
  }, [playlistId, supabase, router]);

  useEffect(() => {
    const handleRemoved = (pid: string, sid: string) => {
      if (pid === playlistId) {
        setSongs(prev => prev.filter(s => s.id !== sid));
      }
    };
    
    const handleAdded = async (pid: string, sid: string) => {
      if (pid === playlistId) {
        const { data } = await supabase.from('songs').select('*').eq('id', sid).single();
        if (data) {
          setSongs(prev => [data, ...prev]);
        }
      }
    };
    
    // Assign to window for direct synchronous calls
    (window as any).removeSongFromPlaylistPage = handleRemoved;
    (window as any).addSongToPlaylistPage = handleAdded;
    
    return () => {
      (window as any).removeSongFromPlaylistPage = null;
      (window as any).addSongToPlaylistPage = null;
    };
  }, [playlistId]);

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    
    if (songs.some(s => s.id === currentSong?.id)) {
      togglePlayPause();
    } else {
      setQueue(songs);
      playSong(songs[0]);
    }
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim() || editTitle === playlist?.title) {
      setIsEditingTitle(false);
      setEditTitle(playlist?.title || '');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('playlists')
        .update({ title: editTitle.trim() })
        .eq('id', playlistId);
        
      if (!error && playlist) {
        setPlaylist({ ...playlist, title: editTitle.trim() });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !playlist) return;

    setIsUploadingCover(true);
    const ext = file.name.split('.').pop();
    const path = `playlists/${playlistId}.${ext}`;

    try {
      const { error } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from('covers')
        .getPublicUrl(path);
        
      const newUrl = `${data.publicUrl}?t=${Date.now()}`;
      
      await supabase
        .from('playlists')
        .update({ cover_url: newUrl })
        .eq('id', playlistId);
        
      setPlaylist({ ...playlist, cover_url: newUrl });
    } catch (err: any) {
      console.error('Error uploading cover:', err);
      alert('Fehler beim Hochladen des Covers: ' + err.message);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleRemoveSong = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Song aus der Playlist entfernen?')) return;
    
    try {
      await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('song_id', songId);
        
      setSongs(songs.filter(s => s.id !== songId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!confirm('Möchtest du diese Playlist wirklich löschen?')) return;
    
    try {
      await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId);
        
      router.push('/playlists');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!playlist) return null;

  const isAnyPlaying = songs.some(s => s.id === currentSong?.id) && isPlaying;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      {/* Background Gradient matching cover or generic */}
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none z-0">
        <div className="w-full h-full bg-gradient-to-b from-blue-900/40 via-[#0A0A0A]/80 to-[#0A0A0A]" />
      </div>
      
      {/* Hero Content */}
      <div className="relative pt-24 px-6 md:px-10 pb-8 flex items-end gap-6 z-10 group">
        
        {/* Cover Art */}
        <div 
          className="relative w-48 h-48 md:w-56 md:h-56 shadow-2xl shrink-0 group/cover cursor-pointer rounded-xl overflow-hidden bg-[#282828] flex items-center justify-center"
          onClick={() => isOwner && fileInputRef.current?.click()}
        >
          {playlist.cover_url ? (
            <img src={playlist.cover_url} alt={playlist.title} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-20 h-20 text-white/20" />
          )}
          
          {isOwner && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
              {isUploadingCover ? (
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              ) : (
                <>
                  <Edit2 className="w-8 h-8 text-white mb-2" />
                  <span className="text-sm font-medium text-white">Cover ändern</span>
                </>
              )}
            </div>
          )}
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleCoverUpload} />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-3 pb-2 w-full">
          <span className="text-sm font-bold text-white uppercase tracking-wider">Playlist</span>
          
          {isEditingTitle ? (
            <input 
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
              autoFocus
              className="bg-transparent border-b border-white/50 text-5xl md:text-7xl font-black text-white focus:outline-none focus:border-white w-full"
            />
          ) : (
            <h1 
              className={`text-5xl md:text-7xl font-black text-white tracking-tighter truncate ${isOwner ? 'cursor-pointer hover:underline' : ''}`}
              onClick={() => isOwner && setIsEditingTitle(true)}
              title={isOwner ? "Klicken zum Bearbeiten" : ""}
            >
              {playlist.title}
            </h1>
          )}
          
          <div className="flex items-center gap-2 text-sm text-white/70 font-medium mt-2">
            <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center text-xs text-white">
              U
            </div>
            <span className="text-white hover:underline cursor-pointer">Du</span>
            <span>•</span>
            <span>{songs.length} {songs.length === 1 ? 'Song' : 'Songs'}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative bg-[#0A0A0A] px-6 md:px-10 py-6 min-h-screen z-10">
        
        {/* Action Bar */}
        <div className="flex items-center gap-6 mb-10">
          <button 
            onClick={handlePlayAll}
            disabled={songs.length === 0}
            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white hover:scale-105 transition-transform shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isAnyPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>
          
          <button className="text-white/40 hover:text-white transition-colors">
            <MoreHorizontal className="w-8 h-8" />
          </button>

          {isOwner && (
            <button 
              onClick={handleDeletePlaylist}
              className="ml-auto text-white/30 hover:text-red-500 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Playlist löschen
            </button>
          )}
        </div>

        {/* Songs List */}
        <div className="mb-12">
          {songs.length > 0 ? (
            <div className="flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-[16px_1fr_150px_40px] md:grid-cols-[24px_1fr_200px_80px_40px] gap-4 px-4 py-2 border-b border-white/10 text-xs text-white/40 uppercase tracking-wider mb-2">
                <div>#</div>
                <div>Titel</div>
                <div className="hidden md:block">Künstler</div>
                <div className="text-right flex items-center justify-end md:col-span-2"><Clock3 className="w-4 h-4" /></div>
              </div>

              {songs.map((song, index) => {
                const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
                const displayArtist = song.artist_name || 'Unbekannt';
                
                return (
                  <div 
                    key={song.id}
                    onClick={() => {
                      if (currentSong?.id !== song.id) playSong({ ...song, creatorName: displayArtist } as any);
                      else togglePlayPause();
                    }}
                    className="grid grid-cols-[16px_1fr_150px_40px] md:grid-cols-[24px_1fr_200px_80px_40px] gap-4 px-4 py-2.5 rounded-lg hover:bg-white/5 group cursor-pointer items-center transition-colors"
                  >
                    <div className="text-white/50 group-hover:text-white text-base font-mono">
                      {isThisSongPlaying ? (
                        <div className="w-4 h-4 flex items-end justify-between">
                          <div className="w-1 bg-primary h-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1 bg-primary h-2/3 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1 bg-primary h-4/5 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      ) : (
                        <span className="group-hover:hidden">{index + 1}</span>
                      )}
                      {!isThisSongPlaying && <Play className="w-4 h-4 hidden group-hover:block fill-current" />}
                    </div>
                    
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img src={song.cover_url} alt={song.title} className="w-10 h-10 object-cover rounded shadow-md" />
                      <div className="flex flex-col overflow-hidden">
                        <span className={`text-base font-medium truncate ${currentSong?.id === song.id ? 'text-primary' : 'text-white/90'}`}>
                          {song.title}
                        </span>
                        <Link href={`/artist/${encodeURIComponent(displayArtist)}`} onClick={e => e.stopPropagation()} className="text-sm text-white/50 hover:underline hover:text-white truncate md:hidden">
                          {displayArtist}
                        </Link>
                      </div>
                    </div>
                    
                    <div className="hidden md:flex items-center">
                      <Link href={`/artist/${encodeURIComponent(displayArtist)}`} onClick={e => e.stopPropagation()} className="text-sm text-white/50 hover:underline hover:text-white truncate">
                        {displayArtist}
                      </Link>
                    </div>

                    <div className="text-right text-sm text-white/50 tracking-wider flex items-center justify-end gap-3 md:col-span-2">
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-4 mr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlaylistAddButton 
                          songId={song.id} 
                          iconClassName="w-5 h-5" 
                          currentPlaylistId={playlistId}
                          onRemoveFromCurrent={() => setSongs(prev => prev.filter(s => s.id !== song.id))}
                        />
                        <LikeButton songId={song.id} iconClassName="w-5 h-5" />
                      </div>
                      
                      <span className="w-12 text-right">{formatDuration(song.duration)}</span>
                      
                      {isOwner && (
                        <button 
                          onClick={(e) => handleRemoveSong(song.id, e)}
                          className="w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white ml-2"
                          title="Aus Playlist entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border-t border-white/5">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Music className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Lass uns etwas Musik finden für deine Playlist</h3>
              <p className="text-white/50 text-sm mb-6">Gehe auf Entdecken, um Songs zu finden und sie mit dem "+"-Icon hinzuzufügen.</p>
              <Link href="/charts/viral" className="px-6 py-2.5 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform">
                Charts durchstöbern
              </Link>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
