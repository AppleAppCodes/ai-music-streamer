'use client';

import useSWR from 'swr';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { ArrowLeft, Play, Pause, Clock3, Heart, Shuffle, List, Check, Menu, Music } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import { useTranslation } from 'react-i18next';
import LikeButton from '@/components/ui/LikeButton';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import { useRouter } from 'next/navigation';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import Image from 'next/image';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

type SortBy = 'date' | 'title' | 'artist';
type ViewMode = 'list' | 'compact';

type LikedSong = Song & { liked_at: string };

export default function LikedSongsPage() {
  const { t } = useTranslation();
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue } = usePlayer();
  const router = useRouter();
  
  const [songs, setSongs] = useState<LikedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const supabase = useMemo(() => createClient(), []);

  const fetchLikedSongs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return { songs: [], user: null };
    }
    
    // Fetch liked songs joined with songs table
    const { data } = await supabase
      .from('liked_songs')
      .select(`
        created_at,
        songs (id, title, artist_name, cover_url, plays, audio_url, duration, genre)
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
      
    let validSongs: LikedSong[] = [];
    if (data) {
      validSongs = data
        .map(item => {
          if (!item.songs) return null;
          return { ...(item.songs as unknown as Song), liked_at: item.created_at } as LikedSong;
        })
        .filter(Boolean) as LikedSong[];
    }
    
    return { songs: validSongs, user: session.user };
  };

  const { data: swrData, isLoading } = useSWR('liked_songs_data', fetchLikedSongs, {
    revalidateOnFocus: false,
    dedupingInterval: 60000
  });

  useEffect(() => {
    if (swrData) {
      setSongs(swrData.songs);
      setUser(swrData.user);
      setLoading(false);
    } else if (!isLoading) {
      setLoading(false);
    }
  }, [swrData, isLoading]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'artist') return (a.artist_name || '').localeCompare(b.artist_name || '');
      if (sortBy === 'date') return new Date(b.liked_at).getTime() - new Date(a.liked_at).getTime();
      return 0;
    });
  }, [songs, sortBy]);

  const handlePlayAll = useCallback(() => {
    if (sortedSongs.length === 0) return;
    
    // Check if the first liked song is already playing
    if (currentSong?.id === sortedSongs[0].id) {
      togglePlayPause();
    } else {
      // Create a queue from all liked songs
      const queue = sortedSongs.map((s): Song => ({ ...s, creatorName: s.artist_name || t('player.creatorFallback') }));
      setQueue(queue, 0);
      playSong(queue[0]);
    }
  }, [sortedSongs, currentSong?.id, t, togglePlayPause, setQueue, playSong]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isAnyPlaying = sortedSongs.some(s => s.id === currentSong?.id) && isPlaying;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      {/* Background Gradient Header - Premium Glassmorphism (Not Spotify) */}
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-[#0A0A0A] blur-3xl pointer-events-none" />
      <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px] pointer-events-none md:left-auto md:right-20 md:top-20 md:h-96 md:w-96 md:translate-x-0" />

      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white md:left-8 md:top-8"
        aria-label="Zurück"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      
      {/* Header Content */}
      <div className="relative flex flex-col items-center gap-5 px-5 pb-7 pt-10 text-center md:flex-row md:items-end md:gap-10 md:px-10 md:pb-8 md:pt-24 md:text-left">
        <div className="flex h-36 w-36 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-md sm:h-44 sm:w-44 md:h-60 md:w-60">
          <Heart className="h-16 w-16 fill-white text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] sm:h-20 sm:w-20 md:h-24 md:w-24" />
        </div>
        <div className="flex max-w-full flex-col items-center gap-2 md:mt-0 md:items-start md:gap-3">
          <span className="text-xs font-bold text-white/50 tracking-[0.2em] uppercase">
            Playlist
          </span>
          <h1 className="max-w-full break-words bg-gradient-to-b from-white to-white/70 bg-clip-text text-center text-4xl font-black tracking-tighter text-transparent drop-shadow-2xl sm:text-5xl md:text-left md:text-8xl">
            Lieblingssongs
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-white/70 md:mt-3 md:justify-start md:gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center overflow-hidden shadow-inner">
              <span className="text-xs text-black font-bold">{user?.email?.charAt(0).toUpperCase()}</span>
            </div>
            <span className="font-bold text-white">{user?.email?.split('@')[0]}</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>{songs.length} {songs.length === 1 ? 'Song' : 'Songs'}</span>
          </div>
        </div>
      </div>

      {/* Background overlay for lower section */}
      <div className="relative min-h-screen border-t border-white/5 bg-black/40 px-4 py-6 backdrop-blur-xl md:px-10 md:py-8">
        
        {/* Action Bar */}
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex shrink-0 items-center gap-4 sm:gap-6">
            <button 
              onClick={handlePlayAll}
              disabled={songs.length === 0}
              className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-black hover:scale-105 hover:bg-primary-hover transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:hover:scale-100"
            >
              {isAnyPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current" />
              )}
            </button>
            <button className="text-white/40 hover:text-white transition-all hover:scale-110" title="Shuffle (Coming soon)">
              <Shuffle className="w-7 h-7" />
            </button>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1 text-right text-xs font-medium text-white/70 transition-colors hover:text-white sm:gap-2 sm:text-sm"
            >
              {sortBy === 'date' ? 'Kürzlich hinzugefügt' : sortBy === 'title' ? 'Titel' : 'Künstler*in'}
              {viewMode === 'list' ? <List className="ml-1 h-4 w-4 sm:ml-2" /> : <Menu className="ml-1 h-4 w-4 sm:ml-2" />}
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-56 bg-[#181818]/95 backdrop-blur-xl rounded-lg shadow-2xl z-50 p-2 border border-white/10 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-3 py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Sortieren nach</div>
                
                <button onClick={() => { setSortBy('title'); setDropdownOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-white/10 flex justify-between items-center transition-colors ${sortBy === 'title' ? 'text-primary font-medium' : 'text-white/90'}`}>
                  Titel {sortBy === 'title' && <Check className="w-4 h-4" />}
                </button>
                
                <button onClick={() => { setSortBy('date'); setDropdownOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-white/10 flex justify-between items-center transition-colors ${sortBy === 'date' ? 'text-primary font-medium' : 'text-white/90'}`}>
                  Kürzlich hinzugefügt {sortBy === 'date' && <Check className="w-4 h-4" />}
                </button>
                
                <button onClick={() => { setSortBy('artist'); setDropdownOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-white/10 flex justify-between items-center transition-colors ${sortBy === 'artist' ? 'text-primary font-medium' : 'text-white/90'}`}>
                  Künstler*in {sortBy === 'artist' && <Check className="w-4 h-4" />}
                </button>
                
                <div className="h-px bg-white/10 my-2 mx-1"></div>
                
                <div className="px-3 py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Ansicht</div>
                
                <button onClick={() => { setViewMode('compact'); setDropdownOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-white/10 flex justify-between items-center transition-colors ${viewMode === 'compact' ? 'text-primary font-medium' : 'text-white/90'}`}>
                  <span className="flex items-center gap-3"><Menu className="w-4 h-4" /> Kompakt</span> {viewMode === 'compact' && <Check className="w-4 h-4" />}
                </button>
                
                <button onClick={() => { setViewMode('list'); setDropdownOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-white/10 flex justify-between items-center transition-colors ${viewMode === 'list' ? 'text-primary font-medium' : 'text-white/90'}`}>
                  <span className="flex items-center gap-3"><List className="w-4 h-4" /> Liste</span> {viewMode === 'list' && <Check className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tracklist Table */}
        {sortedSongs.length > 0 ? (
          <div>
            {/* Table Header */}
            <div className={`grid ${viewMode === 'list' ? 'grid-cols-[16px_minmax(0,1fr)] sm:grid-cols-[16px_1fr_120px_40px] md:grid-cols-[16px_1fr_150px_40px]' : 'grid-cols-[16px_minmax(0,1fr)] sm:grid-cols-[16px_1fr_120px_40px] md:grid-cols-[16px_1fr_150px_40px]'} mb-2 gap-3 border-b border-white/5 px-2 py-2 text-sm text-white/50 sm:gap-4 sm:px-4`}>
              <div>#</div>
              <div>{t('song.title')}</div>
              <div className="hidden text-right sm:block">{t('song.plays')}</div>
              <div className="hidden justify-end sm:flex"><Clock3 className="w-4 h-4" /></div>
            </div>
            
            {/* Track Rows */}
            {sortedSongs.map((song, index) => {
              const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
              const displayArtist = song.artist_name || t('player.creatorFallback');
              
              return (
                <div 
                  key={song.id}
                  onClick={() => {
                    if (currentSong?.id !== song.id) {
                      const queueWithNames = sortedSongs.map(s => ({ ...s, creatorName: s.artist_name || t('player.creatorFallback') }));
                      setQueue(queueWithNames, index);
                      playSong({ ...song, creatorName: displayArtist });
                    } else {
                      togglePlayPause();
                    }
                  }}
                  className={`grid ${viewMode === 'list' ? 'grid-cols-[16px_minmax(0,1fr)] py-2.5 sm:grid-cols-[16px_1fr_120px_40px] sm:py-3 md:grid-cols-[16px_1fr_150px_40px]' : 'grid-cols-[16px_minmax(0,1fr)] py-1.5 sm:grid-cols-[16px_1fr_120px_40px] md:grid-cols-[16px_1fr_150px_40px]'} group cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors hover:bg-white/5 sm:gap-4 sm:px-4`}
                >
                  <div className="text-white/50 group-hover:text-white text-base">
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
                    {viewMode === 'list' && (
                       song.cover_url ? (
                         <Image src={song.cover_url} alt={song.title} width={40} height={40} className="object-cover rounded shadow-md" />
                       ) : (
                         <div className="w-10 h-10 bg-white/5 flex items-center justify-center rounded shadow-md">
                           <Music className="w-5 h-5 text-white/30" />
                         </div>
                       )
                    )}
                    <div className="flex flex-col truncate">
                      <span className={`text-base font-medium truncate ${currentSong?.id === song.id ? 'text-primary' : 'text-white/90'}`}>
                        {song.title}
                      </span>
                      <span className="text-sm text-white/50 truncate">{displayArtist}</span>
                    </div>
                  </div>
                  
                  <div className="hidden items-center justify-end text-right font-mono text-sm tracking-wider text-white/50 sm:flex">
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-4 mr-4">
                      <PlaylistAddButton songId={song.id} iconClassName="w-5 h-5" />
                      <LikeButton songId={song.id} iconClassName="w-5 h-5" />
                    </div>
                    {song.plays.toLocaleString()}
                  </div>
                  
                  <div className="hidden text-right text-sm text-white/50 sm:block">
                    {formatDuration(song.duration)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <Heart className="w-10 h-10 text-white/30" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Noch keine Lieblingssongs</h2>
            <p className="text-white/50 max-w-sm">Tippe auf das Herz bei einem Song, um ihn hier zu speichern und immer wieder zu hören.</p>
          </div>
        )}
      </div>
    </div>
  );
}
