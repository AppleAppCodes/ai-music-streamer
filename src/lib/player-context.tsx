'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Song } from '@/lib/types';

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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

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

  const playSong = (song: Song) => {
    if (!audioRef.current) return;
    
    // If it's the same song, just toggle play
    if (currentSong?.id === song.id) {
      setIsPlaying(true);
      return;
    }

    // New song
    setCurrentSong(song);
    audioRef.current.src = song.audio_url;
    audioRef.current.load();
    setProgress(0);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const setQueue = (songs: Song[], startIndex = 0) => {
    setQueueState(songs);
    if (songs.length > 0 && startIndex >= 0 && startIndex < songs.length) {
      setQueueIndex(startIndex);
      // If we are setting a new queue, we probably want to let the caller call playSong()
      // or we could automatically play it here. For now we just set the queue.
    }
  };

  const playNext = () => {
    if (queue.length === 0 || queueIndex === -1) return;
    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex);
      playSong(queue[nextIndex]);
    }
  };

  const playPrevious = () => {
    if (queue.length === 0 || queueIndex === -1) return;
    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      setQueueIndex(prevIndex);
      playSong(queue[prevIndex]);
    }
  };

  // Handle song ended to play next
  useEffect(() => {
    const onSongEnded = () => {
      if (queue.length > 0 && queueIndex < queue.length - 1) {
        playNext();
      }
    };
    window.addEventListener('player-song-ended', onSongEnded);
    return () => window.removeEventListener('player-song-ended', onSongEnded);
  }, [queue, queueIndex]);

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
      playPrevious
    }}>
      {children}
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
