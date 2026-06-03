import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayerStatus } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import type { Song } from './types';

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
  pause: () => void;
  playSong: (song: Song, options?: PlayOptions) => Promise<void>;
  toggle: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useMemo<AudioPlayer>(() => createAudioPlayer(null, { updateInterval: 500 }), []);
  const status = useAudioPlayerStatus(player);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [activeSong?.id, player]);

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const toggle = useCallback(() => {
    if (!activeSong) return;

    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [activeSong, player, status.playing]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      activeSong,
      currentTime: status.currentTime || 0,
      duration: status.duration || activeSong?.duration || 0,
      error: error ?? status.error,
      isBuffering: status.isBuffering,
      isPlaying: status.playing,
      pause,
      playSong,
      toggle,
    }),
    [activeSong, error, pause, playSong, status.currentTime, status.duration, status.error, status.isBuffering, status.playing, toggle],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);

  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider.');
  }

  return context;
}
