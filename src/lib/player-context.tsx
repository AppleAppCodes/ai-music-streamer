'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Song } from '@/lib/types';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { clearNowPlayingMetadata, setNowPlayingMetadata } from '@/lib/media-session';
import { PLAYER_FORCE_SIGN_OUT_EVENT } from '@/lib/player-events';
import { COOKIE_CONSENT_CHANGED_EVENT, hasPreferenceStorageConsent } from '@/lib/cookie-consent';
import { initAuthChannel, initPlayerChannel, broadcastSignOut, broadcastPlaybackStarted } from '@/lib/cross-tab';

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
  pausePlayback: () => void;
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
  isPro: boolean;
  isAdPlaying: boolean;
}

const AD_SONG_TEMPLATE = {
  id: 'yoriax-audio-ad',
  title: 'WERBUNG',
  artist_name: 'YORIAX Pro',
  cover_url: '/brand/yoriax-symbol.png',
  plays: 0,
  created_at: new Date().toISOString(),
} as Song;

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const PLAYER_STORAGE_KEYS = [
  'player_currentSong',
  'player_queue',
  'player_queueIndex',
  'player_repeatMode',
  'player_isShuffling',
] as const;

function clearStoredPlayerState() {
  PLAYER_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

interface PlayerProviderProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

export function PlayerProvider({ children, isAuthenticated }: PlayerProviderProps) {
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
  const [isPro, setIsPro] = useState(false);
  const [songsPlayed, setSongsPlayed] = useState(0);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [adFrequency, setAdFrequency] = useState(3);
  const [pendingSongToPlayAfterAd, setPendingSongToPlayAfterAd] = useState<Song | null>(null);
  const [availableAds, setAvailableAds] = useState<any[]>([]);
  const [authResolved, setAuthResolved] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedSongIdRef = useRef<string | null>(null);

  const resetPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    loadedSongIdRef.current = null;
    setCurrentSong(null);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setQueueState([]);
    setQueueIndex(-1);
    setIsShuffling(false);
    setRepeatMode('none');
    setShowAuthModal(false);
    clearNowPlayingMetadata();

    try {
      clearStoredPlayerState();
    } catch (e) {
      console.error('Failed to clear player state', e);
    }
  }, []);

  const clearAuthenticatedPlayback = useCallback(() => {
    setUser(null);
    resetPlayback();
  }, [resetPlayback]);

  useEffect(() => {
    window.__YORIAX_STOP_PLAYBACK__ = clearAuthenticatedPlayback;

    return () => {
      if (window.__YORIAX_STOP_PLAYBACK__ === clearAuthenticatedPlayback) {
        delete window.__YORIAX_STOP_PLAYBACK__;
      }
    };
  }, [clearAuthenticatedPlayback]);

  // Fetch auth state
  useEffect(() => {
    if (!isAuthenticated) {
      const timeout = window.setTimeout(() => {
        clearAuthenticatedPlayback();
        setAuthResolved(true);
      }, 0);

      return () => window.clearTimeout(timeout);
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        supabase.from('profiles').select('subscription_tier').eq('id', data.user.id).single()
          .then(({ data: profileData }) => {
            setIsPro(profileData?.subscription_tier === 'pro');
          });
      } else {
        clearAuthenticatedPlayback();
      }
      setAuthResolved(true);
    }).catch((error) => {
      console.error('Failed to fetch auth user', error);
      clearAuthenticatedPlayback();
      setAuthResolved(true);
    });
    
    // Load available ads and global config when context initializes
    const loadAdsAndConfig = async () => {
      const { data: adsData } = await supabase.storage.from('ads').list();
      if (adsData) {
        setAvailableAds(adsData.filter(f => f.name !== '.emptyFolderPlaceholder'));
      }
      
      const { data: configData } = await supabase.from('app_settings').select('ad_frequency').eq('id', 'global').single();
      if (configData) setAdFrequency(configData.ad_frequency);
    };
    loadAdsAndConfig();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user || null;
      if (nextUser) {
        setUser(nextUser);
        supabase.from('profiles').select('subscription_tier').eq('id', nextUser.id).single()
          .then(({ data: profileData }) => {
            setIsPro(profileData?.subscription_tier === 'pro');
          });
      } else {
        clearAuthenticatedPlayback();
        if (event === 'SIGNED_OUT') {
          broadcastSignOut();
          window.location.href = '/login';
        }
      }
    });

    // Cross-tab: listen for logout from other tabs
    const cleanupAuthChannel = initAuthChannel(() => {
      clearAuthenticatedPlayback();
      window.location.href = '/login';
    });

    // Cross-tab: listen for playback starting in other tabs
    const cleanupPlayerChannel = initPlayerChannel(() => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }
      setIsPlaying(false);
    });

    return () => {
      subscription.unsubscribe();
      cleanupAuthChannel();
      cleanupPlayerChannel();
    };
  }, [clearAuthenticatedPlayback, isAuthenticated]);

  useEffect(() => {
    window.addEventListener(PLAYER_FORCE_SIGN_OUT_EVENT, clearAuthenticatedPlayback);

    return () => {
      window.removeEventListener(PLAYER_FORCE_SIGN_OUT_EVENT, clearAuthenticatedPlayback);
    };
  }, [clearAuthenticatedPlayback]);

  useEffect(() => {
    const handleConsentChange = () => {
      if (!hasPreferenceStorageConsent()) {
        clearStoredPlayerState();
      }
    };

    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, handleConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, handleConsentChange);
  }, []);

  // Load state from localStorage on mount
  useEffect(() => {
    if (!authResolved) return;

    if (!user || !hasPreferenceStorageConsent()) {
      const timeout = window.setTimeout(() => setIsMounted(true), 0);
      return () => clearTimeout(timeout);
    }

    let isActive = true;
    let savedSong: string | null = null;
    let savedQueue: string | null = null;
    let savedIndex: string | null = null;
    let savedRepeat: string | null = null;
    let savedShuffle: string | null = null;

    try {
      savedSong = localStorage.getItem('player_currentSong');
      savedQueue = localStorage.getItem('player_queue');
      savedIndex = localStorage.getItem('player_queueIndex');
      savedRepeat = localStorage.getItem('player_repeatMode');
      savedShuffle = localStorage.getItem('player_isShuffling');
    } catch (e) {
      console.error('Failed to load player state', e);
    }

    window.setTimeout(() => {
      if (!isActive) return;

      try {
        if (savedSong) setCurrentSong(JSON.parse(savedSong));
        if (savedQueue) setQueueState(JSON.parse(savedQueue));
        if (savedIndex) setQueueIndex(Number(savedIndex));
        if (savedRepeat) setRepeatMode(savedRepeat as 'none' | 'all' | 'one');
        if (savedShuffle) setIsShuffling(JSON.parse(savedShuffle));
      } catch (e) {
        console.error('Failed to restore player state', e);
      }
      setIsMounted(true);
    }, 0);

    return () => {
      isActive = false;
    };
  }, [authResolved, user]);

  // Save state to localStorage on change
  useEffect(() => {
    if (!isMounted) return;
    if (!hasPreferenceStorageConsent()) return;

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
      loadedSongIdRef.current = null;
    };
  }, []);

  const loadSongIntoAudio = useCallback((song: Song, resetPosition = true) => {
    const audio = audioRef.current;
    if (!audio) return false;

    if (loadedSongIdRef.current !== song.id || !audio.src) {
      audio.src = song.audio_url;
      audio.load();
      loadedSongIdRef.current = song.id;
    }

    if (resetPosition) {
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
    }

    return true;
  }, []);

  const startPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Notify all other tabs to stop their playback
    broadcastPlaybackStarted();

    setIsPlaying(true);
    audio.play().catch((error) => {
      console.error('Playback failed:', error);
      setIsPlaying(false);
    });
  }, []);

  // Keep the audio element in sync with externally restored player state.
  useEffect(() => {
    if (!currentSong || !audioRef.current) return;

    if (loadedSongIdRef.current !== currentSong.id) {
      loadSongIntoAudio(currentSong, false);
    }
  }, [currentSong, loadSongIntoAudio]);

  useEffect(() => {
    if (!currentSong) return;

    setNowPlayingMetadata({
      title: currentSong.title,
      artist: currentSong.artist_name || currentSong.creatorName || 'Creator',
      album: currentSong.album?.title || 'Yoriax',
      artworkUrl: currentSong.cover_url,
    });
  }, [currentSong]);

  const playSong = useCallback((song: Song) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    if (!audioRef.current) return;

    // Ad Logic: Check if we should play an ad
    if (!isPro && song.id !== 'yoriax-audio-ad' && songsPlayed >= adFrequency && availableAds.length > 0) {
      setPendingSongToPlayAfterAd(song);
      setIsAdPlaying(true);
      
      let selectedAdUrl = '';
      if (availableAds.length > 0) {
        const randomAd = availableAds[Math.floor(Math.random() * availableAds.length)];
        selectedAdUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ads/${randomAd.name}?t=${Date.now()}`;
      } else {
        // Fallback if bucket is empty or failed to load
        selectedAdUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ads/yoriax-ad.mp3?t=${Date.now()}`;
      }
      
      const freshAdSong = {
        ...AD_SONG_TEMPLATE,
        audio_url: selectedAdUrl,
      };

      if (currentSong?.id === AD_SONG_TEMPLATE.id) {
        loadSongIntoAudio(freshAdSong, false);
        startPlayback();
        return;
      }

      setCurrentSong(freshAdSong);
      loadSongIntoAudio(freshAdSong);
      startPlayback();
      return;
    }

    // Normal play
    if (song.id !== 'yoriax-audio-ad') {
      setIsAdPlaying(false);
      // Only increment if we actually start a new song (not resuming)
      if (currentSong?.id !== song.id) {
        setSongsPlayed(prev => prev + 1);
      }
    }
    
    if (currentSong?.id === song.id) {
      loadSongIntoAudio(song, false);
      startPlayback();
      return;
    }

    setCurrentSong(song);
    loadSongIntoAudio(song);
    startPlayback();
  }, [currentSong?.id, loadSongIntoAudio, startPlayback, user, isPro, songsPlayed]);

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
      if (isAdPlaying) {
        setIsAdPlaying(false);
        setSongsPlayed(0);

        // Fetch global ad frequency
        supabase.from('app_settings').select('ad_frequency').eq('id', 'global').single().then(({ data }) => {
          if (data) setAdFrequency(data.ad_frequency);
        });

        if (pendingSongToPlayAfterAd) {
          playSong(pendingSongToPlayAfterAd);
          setPendingSongToPlayAfterAd(null);
        } else {
          playNext();
        }
        return;
      }

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
  }, [playNext, repeatMode, isAdPlaying, pendingSongToPlayAfterAd, playSong]);

  const togglePlayPause = useCallback(() => {
    if (!currentSong || !audioRef.current) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    loadSongIntoAudio(currentSong, false);
    startPlayback();
  }, [currentSong, isPlaying, loadSongIntoAudio, startPlayback, user]);

  const pausePlayback = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!audioRef.current || isPlaying) return;
    audioRef.current.pause();
  }, [isPlaying]);

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
      pausePlayback,
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
      isPro,
      isAdPlaying,
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
