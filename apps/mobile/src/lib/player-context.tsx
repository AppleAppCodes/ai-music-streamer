import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayerStatus } from 'expo-audio';
import type { AudioLockScreenOptions, AudioPlayer } from 'expo-audio';
import { activateExclusivePlaybackSession, addTrackRemoteCommandListeners, setTrackRemoteCommandsEnabled } from 'yoriax-remote-commands';
import type { Song } from './types';
import { useAuth } from './auth-context';
import { supabase } from './supabase';
import { useI18n } from './i18n';

interface StorageListItem {
  name: string;
}

interface PlayOptions {
  startAt?: number | null | (() => number);
  fadeInMs?: number;
}

const PLAYBACK_READY_TIMEOUT_MS = 2500;
const PLAYBACK_READY_POLL_MS = 50;
const PAUSE_FADE_OUT_MS = 90;
const NOW_PLAYING_REASSERT_DELAYS_MS = [160, 600] as const;

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
  isShuffling: boolean;
  isPlaying: boolean;
  pause: () => void;
  playSong: (song: Song, options?: PlayOptions) => Promise<void>;
  reset: () => void;
  setQueue: (songs: Song[], startIndex?: number) => void;
  toggle: () => void;
  toggleShuffle: () => void;
}

interface PlayerShellContextValue {
  hasActiveSong: boolean;
  isPlaying: boolean;
  reset: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);
const PlayerControlsContext = createContext<PlayerControlsContextValue | null>(null);
const PlayerShellContext = createContext<PlayerShellContextValue | null>(null);

const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  isLiveStream: false,
  showSeekBackward: false,
  showSeekForward: false,
};

const EXCLUSIVE_AUDIO_MODE = {
  allowsRecording: false,
  interruptionMode: 'doNotMix',
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  shouldRouteThroughEarpiece: false,
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampVolume(volume: number) {
  return Math.max(0, Math.min(1, volume));
}

function getPlayerVolume(player: AudioPlayer) {
  const volume = Reflect.get(player, 'volume');
  return typeof volume === 'number' ? clampVolume(volume) : 1;
}

function setAudioPlayerVolume(player: AudioPlayer, volume: number) {
  Reflect.set(player, 'volume', clampVolume(volume));
}

async function waitForPlayerReady(player: AudioPlayer, isCurrentRequest: () => boolean) {
  const startedAt = Date.now();

  while (isCurrentRequest() && Date.now() - startedAt < PLAYBACK_READY_TIMEOUT_MS) {
    const currentStatus = player.currentStatus;

    if (currentStatus.isLoaded && !currentStatus.didJustFinish) {
      return true;
    }

    await sleep(PLAYBACK_READY_POLL_MS);
  }

  return false;
}

function setLockScreenMetadata(player: AudioPlayer, song: Song) {
  try {
    player.setActiveForLockScreen(true, {
      artist: song.artist_name || song.creatorName || 'Yoriax',
      artworkUrl: song.cover_url || undefined,
      title: song.title,
    }, LOCK_SCREEN_OPTIONS);
  } catch (metadataError) {
    console.warn('Could not update lock screen metadata.', metadataError);
  }
}

async function activateYoriaxPlaybackSession() {
  await setAudioModeAsync(EXCLUSIVE_AUDIO_MODE);
  await setIsAudioActiveAsync(true);
  activateExclusivePlaybackSession();
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const player = useMemo<AudioPlayer>(
    () => createAudioPlayer(null, { keepAudioSessionActive: true, updateInterval: 1000 }),
    [],
  );
  const status = useAudioPlayerStatus(player);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreparingPlayback, setIsPreparingPlayback] = useState(false);

  // Queue State
  const [queue, setQueueState] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isShuffling, setIsShuffling] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');
  const finishEventConsumedRef = useRef(false);
  const intendsToPlayRef = useRef(false);
  const playNextRef = useRef<() => void>(() => {});
  const playPreviousRef = useRef<() => void>(() => {});
  const playRequestIdRef = useRef(0);
  const pauseFadeIdRef = useRef(0);
  const pauseFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nowPlayingRefreshIdRef = useRef(0);
  const nowPlayingRefreshTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const volumeRampRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedSongIdRef = useRef<string | null>(null);
  const activeSongRef = useRef<Song | null>(null);

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
    void activateYoriaxPlaybackSession();

    return () => {
      if (volumeRampRef.current) {
        clearInterval(volumeRampRef.current);
      }
      if (pauseFadeTimeoutRef.current) {
        clearTimeout(pauseFadeTimeoutRef.current);
        pauseFadeTimeoutRef.current = null;
      }
      nowPlayingRefreshTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      nowPlayingRefreshTimeoutsRef.current = [];
      player.clearLockScreenControls();
      player.remove();
    };
  }, [player]);

  const setPlayerVolume = useCallback((volume: number) => {
    if (volumeRampRef.current) {
      clearInterval(volumeRampRef.current);
      volumeRampRef.current = null;
    }

    setAudioPlayerVolume(player, volume);
  }, [player]);

  const rampPlayerVolume = useCallback((targetVolume: number, durationMs = 180) => {
    if (volumeRampRef.current) {
      clearInterval(volumeRampRef.current);
      volumeRampRef.current = null;
    }

    const target = clampVolume(targetVolume);
    const start = getPlayerVolume(player);

    if (durationMs <= 0 || Math.abs(start - target) < 0.01) {
      setAudioPlayerVolume(player, target);
      return;
    }

    const startedAt = Date.now();
    volumeRampRef.current = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      setAudioPlayerVolume(player, start + (target - start) * progress);

      if (progress >= 1 && volumeRampRef.current) {
        clearInterval(volumeRampRef.current);
        volumeRampRef.current = null;
      }
    }, 16);
  }, [player]);

  const clearNowPlayingRefreshes = useCallback(() => {
    nowPlayingRefreshIdRef.current += 1;
    nowPlayingRefreshTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    nowPlayingRefreshTimeoutsRef.current = [];
  }, []);

  const reassertNowPlaying = useCallback((song: Song) => {
    activateExclusivePlaybackSession();
    setLockScreenMetadata(player, song);
  }, [player]);

  const scheduleNowPlayingRefresh = useCallback((song: Song, requestId = playRequestIdRef.current) => {
    clearNowPlayingRefreshes();
    const refreshId = nowPlayingRefreshIdRef.current;

    const run = () => {
      if (nowPlayingRefreshIdRef.current !== refreshId) return;
      if (playRequestIdRef.current !== requestId) return;
      if (!intendsToPlayRef.current) return;

      const currentSong = activeSongRef.current;
      if (!currentSong || currentSong.id !== song.id) return;

      reassertNowPlaying(song);
    };

    run();
    nowPlayingRefreshTimeoutsRef.current = NOW_PLAYING_REASSERT_DELAYS_MS.map((delay) => setTimeout(run, delay));
  }, [clearNowPlayingRefreshes, reassertNowPlaying]);

  const playSong = useCallback(async (song: Song, options: PlayOptions = {}) => {
    if (!song.audio_url) {
      setError(t('player.audioMissing'));
      return;
    }

    const playRequestId = playRequestIdRef.current + 1;
    playRequestIdRef.current = playRequestId;
    pauseFadeIdRef.current += 1;
    if (pauseFadeTimeoutRef.current) {
      clearTimeout(pauseFadeTimeoutRef.current);
      pauseFadeTimeoutRef.current = null;
    }
    const isCurrentRequest = () => playRequestIdRef.current === playRequestId;

    setError(null);
    setIsPreparingPlayback(true);

    try {
      await activateYoriaxPlaybackSession();

      const isSameSong = loadedSongIdRef.current === song.id;
      const fadeInMs = Math.max(0, options.fadeInMs ?? 0);

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

        setPlayerVolume(1);
        player.replace({ name: adSong.title, uri: adSong.audio_url });
        activeSongRef.current = adSong;
        setActiveSong(adSong);
        await waitForPlayerReady(player, isCurrentRequest);
        if (!isCurrentRequest()) return;
        loadedSongIdRef.current = adSong.id;
        player.play();
        intendsToPlayRef.current = true;
        scheduleNowPlayingRefresh(adSong, playRequestId);
        return;
      }

      if (song.id !== 'yoriax-audio-ad') {
        setIsAdPlaying(false);
        if (!isSameSong) {
          setSongsPlayed(prev => prev + 1);
        }
      }

      if (!isSameSong) {
        if (fadeInMs <= 0) {
          setPlayerVolume(1);
        }

        player.replace({
          name: song.title,
          uri: song.audio_url,
        });
        activeSongRef.current = song;
        setActiveSong(song);
        // Do not update lock screen controls until the new source is ready and playing.
        // Doing it early triggers native route adjustments that interrupt active audio.
        await waitForPlayerReady(player, isCurrentRequest);
        if (!isCurrentRequest()) return;

        loadedSongIdRef.current = song.id;
        if (fadeInMs > 0) {
          setPlayerVolume(0);
        }
      }

      const resolvedStartAt = typeof options.startAt === 'function'
        ? options.startAt()
        : (options.startAt ?? 0);
      const startAt = Math.max(0, resolvedStartAt);

      const shouldSeekBeforePlay = options.startAt != null && (startAt > 0 || isSameSong);
      if (shouldSeekBeforePlay) {
        await player.seekTo(startAt, 0, 0);
      }

      player.play();
      intendsToPlayRef.current = true;
      if (fadeInMs > 0) {
        rampPlayerVolume(1, fadeInMs);
      } else {
        setPlayerVolume(1);
      }
      scheduleNowPlayingRefresh(song, playRequestId);
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : t('player.playbackFailed'));
    } finally {
      if (isCurrentRequest()) {
        setIsPreparingPlayback(false);
      }
    }
  }, [player, isPro, songsPlayed, availableAds, adFrequency, rampPlayerVolume, scheduleNowPlayingRefresh, setPlayerVolume, t]);

  const pause = useCallback(() => {
    pauseFadeIdRef.current += 1;
    const pauseFadeId = pauseFadeIdRef.current;

    if (pauseFadeTimeoutRef.current) {
      clearTimeout(pauseFadeTimeoutRef.current);
      pauseFadeTimeoutRef.current = null;
    }

    rampPlayerVolume(0, PAUSE_FADE_OUT_MS);

    pauseFadeTimeoutRef.current = setTimeout(() => {
      if (pauseFadeIdRef.current !== pauseFadeId) return;

      player.pause();
      intendsToPlayRef.current = false;
      setPlayerVolume(1);
      pauseFadeTimeoutRef.current = null;
    }, PAUSE_FADE_OUT_MS);
  }, [player, rampPlayerVolume, setPlayerVolume]);

  const reset = useCallback(() => {
    playRequestIdRef.current += 1;
    pauseFadeIdRef.current += 1;
    if (pauseFadeTimeoutRef.current) {
      clearTimeout(pauseFadeTimeoutRef.current);
      pauseFadeTimeoutRef.current = null;
    }
    clearNowPlayingRefreshes();
    setPlayerVolume(1);
    player.pause();
    intendsToPlayRef.current = false;
    player.clearLockScreenControls();
    activeSongRef.current = null;
    setActiveSong(null);
    loadedSongIdRef.current = null;
    setError(null);
    setIsPreparingPlayback(false);
    setQueueState([]);
    setQueueIndex(-1);
    setIsShuffling(false);
    setRepeatMode('none');
    setSongsPlayed(0);
    setIsAdPlaying(false);
    setPendingSongToPlayAfterAd(null);
    finishEventConsumedRef.current = false;
  }, [clearNowPlayingRefreshes, player, setPlayerVolume]);

  const toggle = useCallback(() => {
    if (!activeSong) return;

    if (status.playing) {
      pause();
    } else {
      pauseFadeIdRef.current += 1;
      if (pauseFadeTimeoutRef.current) {
        clearTimeout(pauseFadeTimeoutRef.current);
        pauseFadeTimeoutRef.current = null;
      }
      setPlayerVolume(1);
      void activateYoriaxPlaybackSession(); // Ensure session is active when resuming from pause
      player.play();
      intendsToPlayRef.current = true;
      scheduleNowPlayingRefresh(activeSong);
    }
  }, [activeSong, pause, player, scheduleNowPlayingRefresh, setPlayerVolume, status.playing]);

  const setQueue = useCallback((songs: Song[], startIndex = 0) => {
    setQueueState(songs);
    if (songs.length > 0 && startIndex >= 0 && startIndex < songs.length) {
      setQueueIndex(startIndex);
    }
  }, []);

  const playQueueSong = useCallback((song: Song, index: number) => {
    setQueueIndex(index);
    void playSong(song, activeSong?.id === song.id ? { startAt: 0 } : undefined);
  }, [activeSong?.id, playSong]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;

    if (isShuffling && queue.length > 1) {
      let nextIndex = Math.floor(Math.random() * queue.length);
      while (nextIndex === queueIndex) {
        nextIndex = Math.floor(Math.random() * queue.length);
      }
      playQueueSong(queue[nextIndex], nextIndex);
      return;
    }

    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      playQueueSong(queue[nextIndex], nextIndex);
    } else if (repeatMode === 'all') {
      playQueueSong(queue[0], 0);
    } else {
      player.pause();
      intendsToPlayRef.current = false;
    }
  }, [queue, isShuffling, queueIndex, repeatMode, player, playQueueSong]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;

    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      playQueueSong(queue[prevIndex], prevIndex);
    } else if (repeatMode === 'all') {
      playQueueSong(queue[queue.length - 1], queue.length - 1);
    } else {
      void player.seekTo(0, 0, 0);
    }
  }, [queue, queueIndex, repeatMode, player, playQueueSong]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  useEffect(() => {
    playPreviousRef.current = playPrevious;
  }, [playPrevious]);

  useEffect(() => {
    setTrackRemoteCommandsEnabled(true);
    const removeListeners = addTrackRemoteCommandListeners({
      onNextTrack: () => playNextRef.current(),
      onPreviousTrack: () => playPreviousRef.current(),
    });

    return () => {
      removeListeners();
      setTrackRemoteCommandsEnabled(false);
    };
  }, []);

  const toggleShuffle = useCallback(() => setIsShuffling(s => !s), []);
  const toggleRepeat = useCallback(() => setRepeatMode(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'), []);

  const seekTo = useCallback(async (seconds: number) => {
    if (!activeSong) return;
    await player.seekTo(seconds, 0, 0);
  }, [activeSong, player]);

  useEffect(() => {
    activeSongRef.current = activeSong;
  }, [activeSong]);

  useEffect(() => {
    const song = activeSongRef.current;
    if (!song || (!status.playing && !intendsToPlayRef.current)) return;
    scheduleNowPlayingRefresh(song);
  }, [scheduleNowPlayingRefresh, status.playing]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;

      const song = activeSongRef.current;
      if (!song || (!status.playing && !intendsToPlayRef.current)) return;

      scheduleNowPlayingRefresh(song);
    });

    return () => {
      subscription.remove();
    };
  }, [scheduleNowPlayingRefresh, status.playing]);

  const isAdPlayingRef = useRef(isAdPlaying);
  useEffect(() => {
    isAdPlayingRef.current = isAdPlaying;
  }, [isAdPlaying]);

  const pendingSongToPlayAfterAdRef = useRef(pendingSongToPlayAfterAd);
  useEffect(() => {
    pendingSongToPlayAfterAdRef.current = pendingSongToPlayAfterAd;
  }, [pendingSongToPlayAfterAd]);

  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const playSongRef = useRef(playSong);
  useEffect(() => {
    playSongRef.current = playSong;
  }, [playSong]);

  // Handle native end-of-track notifications once.
  // We attach a direct listener to the native player object instead of using a React hook (useAudioPlayerStatus),
  // because React hooks do not update/execute when the app is in the background or screen is locked.
  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) {
        finishEventConsumedRef.current = false;
        return;
      }

      if (!activeSongRef.current || finishEventConsumedRef.current) return;
      finishEventConsumedRef.current = true;

      // Handle track completion
      setTimeout(() => {
        if (isAdPlayingRef.current) {
          setIsAdPlaying(false);
          setSongsPlayed(0);

          if (supabase) {
            supabase.from('app_settings').select('ad_frequency').eq('id', 'global').single().then(({ data }) => {
              if (data) setAdFrequency(data.ad_frequency);
            });
          }

          if (pendingSongToPlayAfterAdRef.current) {
            void playSongRef.current(pendingSongToPlayAfterAdRef.current);
            setPendingSongToPlayAfterAd(null);
          } else {
            playNextRef.current();
          }
          return;
        }

        if (repeatModeRef.current === 'one') {
          void player.seekTo(0, 0, 0).then(() => {
            player.play();
          });
          return;
        }

        playNextRef.current();
      }, 0);
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      activeSong,
      currentTime: isPreparingPlayback ? 0 : Math.max(0, Math.min(status.currentTime || 0, status.duration || activeSong?.duration || 0)),
      duration: status.duration || activeSong?.duration || 0,
      error: error ?? status.error,
      isBuffering: isPreparingPlayback || status.isBuffering,
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
    [activeSong, error, isAdPlaying, isPreparingPlayback, pause, playSong, playNext, playPrevious, queue, queueIndex, reset, isShuffling, repeatMode, setQueue, toggleShuffle, toggleRepeat, seekTo, status.currentTime, status.duration, status.error, status.isBuffering, status.playing, toggle],
  );

  const controlsValue = useMemo<PlayerControlsContextValue>(
    () => ({
      activeSong,
      isShuffling,
      isPlaying: status.playing,
      pause,
      playSong,
      reset,
      setQueue,
      toggle,
      toggleShuffle,
    }),
    [activeSong, isShuffling, pause, playSong, reset, setQueue, status.playing, toggle, toggleShuffle],
  );

  const hasActiveSong = activeSong !== null;
  const shellValue = useMemo<PlayerShellContextValue>(
    () => ({
      hasActiveSong,
      isPlaying: status.playing,
      reset,
    }),
    [hasActiveSong, reset, status.playing],
  );

  return (
    <PlayerShellContext.Provider value={shellValue}>
      <PlayerControlsContext.Provider value={controlsValue}>
        <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
      </PlayerControlsContext.Provider>
    </PlayerShellContext.Provider>
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

export function usePlayerShell() {
  const context = useContext(PlayerShellContext);

  if (!context) {
    throw new Error('usePlayerShell must be used within PlayerProvider.');
  }

  return context;
}
