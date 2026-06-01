'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Song } from '@/lib/types';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number; // 0 to 100
  currentTime: number;
  duration: number;
  volume: number; // 0 to 1
  queue: Song[];
  queueIndex: number;
  playSong: (song: Song) => void;
  togglePlayPause: () => void;
  setVolume: (val: number) => void;
  seekTo: (percentage: number) => void;
  setQueue: (songs: Song[], startIndex?: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  isShuffling: boolean;
  toggleShuffle: () => void;
  repeatMode: 'none' | 'all' | 'one';
  toggleRepeat: () => void;
  user: SupabaseUser | null;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [queue, setQueueState] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isShuffling, setIsShuffling] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load state from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedSong = localStorage.getItem('player_currentSong');
      const savedQueue = localStorage.getItem('player_queue');
      const savedIndex = localStorage.getItem('player_queueIndex');
      const savedRepeat = localStorage.getItem('player_repeatMode');
      const savedShuffle = localStorage.getItem('player_isShuffling');

      if (savedSong) setCurrentSong(JSON.parse(savedSong));
      if (savedQueue) setQueueState(JSON.parse(savedQueue));
      if (savedIndex) setQueueIndex(Number(savedIndex));
      if (savedRepeat) setRepeatMode(savedRepeat as 'none' | 'all' | 'one');
      if (savedShuffle) setIsShuffling(JSON.parse(savedShuffle));
    } catch (e) {
      console.error('Failed to load player state', e);
    }
  }, []);

  // Save state to localStorage on change
  useEffect(() => {
    if (!isMounted) return;
    try {
      if (currentSong) localStorage.setItem('player_currentSong', JSON.stringify(currentSong));
      localStorage.setItem('player_queue', JSON.stringify(queue));
      localStorage.setItem('player_queueIndex', String(queueIndex));
      localStorage.setItem('player_repeatMode', repeatMode);
      localStorage.setItem('player_isShuffling', JSON.stringify(isShuffling));
    } catch (e) {
      console.error('Failed to save player state', e);
    }
  }, [currentSong, queue, queueIndex, repeatMode, isShuffling, isMounted]);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = 1;

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      
      // Future: we will trigger playNext here, but we need to do it outside of this closure 
      // or use a ref for queue/queueIndex to have the latest state.
      // For now, let's dispatch a custom event that we can listen to in a separate effect.
      window.dispatchEvent(new Event('player-song-ended'));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Handle Play/Pause
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.play().catch(e => console.error("Playback failed:", e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentSong]); // depend on currentSong to trigger play when song changes

  const playSong = useCallback((song: Song) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    if (!audioRef.current) return;
    
    // If it's the same song, just toggle play
    if (currentSong?.id === song.id) {
      setIsPlaying(true);
      return;
    }

    // New song
    setCurrentSong(song);
    
    // Set src and load immediately
    audioRef.current.src = song.audio_url;
    audioRef.current.load();
    setProgress(0);
    setCurrentTime(0);
    setIsPlaying(true);
  }, [currentSong?.id, user]);

  const setQueue = useCallback((songs: Song[], startIndex = 0) => {
    setQueueState(songs);
    if (songs.length > 0 && startIndex >= 0 && startIndex < songs.length) {
      setQueueIndex(startIndex);
    }
  }, []);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    
    if (isShuffling && queue.length > 1) {
      let nextIndex = Math.floor(Math.random() * queue.length);
      while (nextIndex === queueIndex) {
        nextIndex = Math.floor(Math.random() * queue.length);
      }
      setQueueIndex(nextIndex);
      playSong(queue[nextIndex]);
      return;
    }

    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex);
      playSong(queue[nextIndex]);
    } else if (repeatMode === 'all') {
      setQueueIndex(0);
      playSong(queue[0]);
    } else {
      setIsPlaying(false);
    }
  }, [playSong, queue, queueIndex, isShuffling, repeatMode]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      return;
    }
    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      setQueueIndex(prevIndex);
      playSong(queue[prevIndex]);
    } else if (repeatMode === 'all') {
      setQueueIndex(queue.length - 1);
      playSong(queue[queue.length - 1]);
    }
  }, [playSong, queue, queueIndex, currentTime, repeatMode]);

  // Handle song ended to play next or repeat
  useEffect(() => {
    const onSongEnded = () => {
      if (repeatMode === 'one' && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      } else {
        playNext();
      }
    };
    window.addEventListener('player-song-ended', onSongEnded);
    return () => window.removeEventListener('player-song-ended', onSongEnded);
  }, [playNext, repeatMode]);

  const togglePlayPause = () => {
    if (!currentSong) return;
    setIsPlaying(!isPlaying);
  };

  const setVolume = (val: number) => {
    if (!audioRef.current) return;
    const clamped = Math.max(0, Math.min(1, val));
    audioRef.current.volume = clamped;
    setVolumeState(clamped);
  };

  const seekTo = (percentage: number) => {
    if (!audioRef.current || !currentSong) return;
    const time = (percentage / 100) * duration;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    setProgress(percentage);
  };

  return (
    <PlayerContext.Provider value={{
      currentSong,
      isPlaying,
      progress,
      currentTime,
      duration,
      volume,
      queue,
      queueIndex,
      playSong,
      togglePlayPause,
      setVolume,
      seekTo,
      setQueue,
      playNext,
      playPrevious,
      isShuffling,
      toggleShuffle: () => setIsShuffling(s => !s),
      repeatMode,
      toggleRepeat: () => {
        setRepeatMode(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none');
      },
      user,
    }}>
      {children}
      
      {showAuthModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#181818] rounded-xl p-8 max-w-md w-full text-center shadow-2xl border border-white/10 relative">
            <h2 className="text-2xl font-black text-white mb-4 tracking-tight">Jetzt mit einem kostenlosen YORIAX Konto hören</h2>
            <p className="text-white/70 mb-8 text-sm">Registriere dich kostenlos, um unbegrenzt Musik zu streamen und eigene Playlists zu erstellen.</p>
            <Link href="/login" onClick={() => setShowAuthModal(false)} className="block w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-4 rounded-full transition-colors mb-4 text-sm">
              Kostenlos registrieren
            </Link>
            <div className="text-sm text-white/50 mb-6">
              Du hast schon ein Konto? <Link href="/login" onClick={() => setShowAuthModal(false)} className="text-white hover:underline font-semibold ml-1">Anmelden</Link>
            </div>
            <button onClick={() => setShowAuthModal(false)} className="text-white/40 hover:text-white text-xs font-medium uppercase tracking-wider transition-colors">
              Schließen
            </button>
          </div>
        </div>
      )}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
