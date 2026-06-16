import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayerStatus } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import type { Song } from './types';
import { useAuth } from './auth-context';
import { supabase } from './supabase';

interface StorageListItem {
  name: string;
}

interface PlayOptions {
  startAt?: number | null;
}

interface PlayerContextValue {
  activeSong: Song | null;
  currentTime: number;
  duration: number;
  error: string | null;
  isBuffering: boolean;
  isPlaying: boolean;
  isAdPlaying: boolean;
  pause: () => void;
  playSong: (song: Song, options?: PlayOptions) => Promise<void>;
  playNext: () => void;
  playPrevious: () => void;
  queue: Song[];
  queueIndex: number;
  reset: () => void;
  isShuffling: boolean;
  repeatMode: 'none' | 'all' | 'one';
  setQueue: (songs: Song[], startIndex?: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  seekTo: (seconds: number) => Promise<void>;
  toggle: () => void;
}

interface PlayerControlsContextValue {
  activeSong: Song | null;
  isPlaying: boolean;
  pause: () => void;
  playSong: (song: Song, options?: PlayOptions) => Promise<void>;
  setQueue: (songs: Song[], startIndex?: number) => void;
  toggle: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);
const PlayerControlsContext = createContext<PlayerControlsContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useMemo<AudioPlayer>(() => createAudioPlayer(null, { updateInterval: 500 }), []);
  const status = useAudioPlayerStatus(player);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Queue State
  const [queue, setQueueState] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isShuffling, setIsShuffling] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');

  // Ad & User State
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [songsPlayed, setSongsPlayed] = useState(0);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [adFrequency, setAdFrequency] = useState(3);
  const [pendingSongToPlayAfterAd, setPendingSongToPlayAfterAd] = useState<Song | null>(null);
  const [availableAds, setAvailableAds] = useState<StorageListItem[]>([]);

  useEffect(() => {
    if (user && supabase) {
      supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
        .then(({ data }) => setIsPro(data?.subscription_tier === 'pro'));
    }
    const loadAdsAndConfig = async () => {
      if (!supabase) return;
      const { data } = await supabase.storage.from('ads').list();
      if (data) {
        setAvailableAds(data.filter(f => f.name !== '.emptyFolderPlaceholder'));
      }
      
      const { data: configData } = await supabase.from('app_settings').select('ad_frequency').eq('id', 'global').single();
      if (configData) setAdFrequency(configData.ad_frequency);
    };
    void loadAdsAndConfig();
  }, [user]);

  useEffect(() => {
    void setAudioModeAsync({
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
    void setIsAudioActiveAsync(true);

    return () => {
      player.clearLockScreenControls();
      player.remove();
    };
  }, [player]);

  const playSong = useCallback(async (song: Song, options: PlayOptions = {}) => {
    if (!song.audio_url) {
      setError('Dieser Song hat keine Audio-Datei.');
      return;
    }

    setError(null);

    try {
      const isSameSong = activeSong?.id === song.id;
      const startAt = Math.max(0, options.startAt ?? 0);

      // AD LOGIC
      if (!isPro && song.id !== 'yoriax-audio-ad' && songsPlayed >= adFrequency && availableAds.length > 0) {
        setPendingSongToPlayAfterAd(song);
        setIsAdPlaying(true);

        let selectedAdUrl = '';
        if (availableAds.length > 0 && supabase) {
          const randomAd = availableAds[Math.floor(Math.random() * availableAds.length)];
          selectedAdUrl = supabase.storage.from('ads').getPublicUrl(randomAd.name).data.publicUrl;
        } else if (supabase) {
          selectedAdUrl = supabase.storage.from('ads').getPublicUrl('yoriax-ad.mp3').data.publicUrl;
        }

        const adSong: Song = {
          id: 'yoriax-audio-ad',
          title: 'WERBUNG',
          artist_name: 'YORIAX Pro',
          cover_url: 'https://www.yoriax.com/brand/yoriax-symbol.png',
          audio_url: selectedAdUrl,
          plays: 0,
          created_at: new Date().toISOString(),
        } as Song;

        player.replace({ name: adSong.title, uri: adSong.audio_url });
        setActiveSong(adSong);
        player.setActiveForLockScreen(true, {
          artist: adSong.artist_name || undefined,
          artworkUrl: adSong.cover_url || undefined,
          title: adSong.title,
        });
        player.play();
        return;
      }

      if (song.id !== 'yoriax-audio-ad') {
        setIsAdPlaying(false);
        if (!isSameSong) {
          setSongsPlayed(prev => prev + 1);
        }
      }

      if (!isSameSong) {
        player.replace({
          name: song.title,
          uri: song.audio_url,
        });
        setActiveSong(song);
      }

      player.setActiveForLockScreen(true, {
        artist: song.artist_name || song.creatorName || 'Yoriax',
        artworkUrl: song.cover_url || undefined,
        title: song.title,
      });

      if (!isSameSong || options.startAt != null) {
        await player.seekTo(startAt, 0, 0);
      }

      player.play();
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Playback konnte nicht gestartet werden.');
    }
  }, [activeSong, player, isPro, songsPlayed, availableAds, adFrequency]);

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const reset = useCallback(() => {
    player.pause();
    player.clearLockScreenControls();
    setActiveSong(null);
    setError(null);
    setQueueState([]);
    setQueueIndex(-1);
    setIsShuffling(false);
    setRepeatMode('none');
    setSongsPlayed(0);
    setIsAdPlaying(false);
    setPendingSongToPlayAfterAd(null);
  }, [player]);

  const toggle = useCallback(() => {
    if (!activeSong) return;

    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [activeSong, player, status.playing]);

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
      void playSong(queue[nextIndex]);
      return;
    }

    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex);
      void playSong(queue[nextIndex]);
    } else if (repeatMode === 'all') {
      setQueueIndex(0);
      void playSong(queue[0]);
    } else {
      player.pause();
    }
  }, [playSong, queue, queueIndex, isShuffling, repeatMode, player]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;
    if ((status.currentTime || 0) > 3) {
      void player.seekTo(0, 0, 0);
      return;
    }
    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      setQueueIndex(prevIndex);
      void playSong(queue[prevIndex]);
    } else if (repeatMode === 'all') {
      setQueueIndex(queue.length - 1);
      void playSong(queue[queue.length - 1]);
    }
  }, [playSong, queue, queueIndex, status.currentTime, repeatMode, player]);

  const toggleShuffle = useCallback(() => setIsShuffling(s => !s), []);
  const toggleRepeat = useCallback(() => setRepeatMode(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'), []);

  const seekTo = useCallback(async (seconds: number) => {
    if (!activeSong) return;
    await player.seekTo(seconds, 0, 0);
  }, [activeSong, player]);

  // Handle auto play next when song finishes.
  useEffect(() => {
    const didReachEnd = activeSong && !status.playing && status.duration > 0 && Math.abs(status.currentTime - status.duration) < 1.0;
    if (!didReachEnd) return;

    const timeout = setTimeout(() => {
      if (isAdPlaying) {
        setIsAdPlaying(false);
        setSongsPlayed(0);
        
        // Refetch config
        if (supabase) {
          supabase.from('app_settings').select('ad_frequency').eq('id', 'global').single().then(({ data }) => {
            if (data) setAdFrequency(data.ad_frequency);
          });
        }

        if (pendingSongToPlayAfterAd) {
          void playSong(pendingSongToPlayAfterAd);
          setPendingSongToPlayAfterAd(null);
        } else {
          playNext();
        }
        return;
      }

      if (repeatMode === 'one') {
        void player.seekTo(0, 0, 0);
        player.play();
      } else {
        playNext();
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [activeSong, status.playing, status.currentTime, status.duration, repeatMode, playNext, player, isAdPlaying, pendingSongToPlayAfterAd, playSong]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      activeSong,
      currentTime: status.currentTime || 0,
      duration: status.duration || activeSong?.duration || 0,
      error: error ?? status.error,
      isBuffering: status.isBuffering,
      isPlaying: status.playing,
      isAdPlaying,
      pause,
      playSong,
      playNext,
      playPrevious,
      queue,
      queueIndex,
      reset,
      isShuffling,
      repeatMode,
      setQueue,
      toggleShuffle,
      toggleRepeat,
      seekTo,
      toggle,
    }),
    [activeSong, error, isAdPlaying, pause, playSong, playNext, playPrevious, queue, queueIndex, reset, isShuffling, repeatMode, setQueue, toggleShuffle, toggleRepeat, seekTo, status.currentTime, status.duration, status.error, status.isBuffering, status.playing, toggle],
  );

  const controlsValue = useMemo<PlayerControlsContextValue>(
    () => ({
      activeSong,
      isPlaying: status.playing,
      pause,
      playSong,
      setQueue,
      toggle,
    }),
    [activeSong, pause, playSong, setQueue, status.playing, toggle],
  );

  return (
    <PlayerControlsContext.Provider value={controlsValue}>
      <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
    </PlayerControlsContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);

  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider.');
  }

  return context;
}

export function usePlayerControls() {
  const context = useContext(PlayerControlsContext);

  if (!context) {
    throw new Error('usePlayerControls must be used within PlayerProvider.');
  }

  return context;
}
