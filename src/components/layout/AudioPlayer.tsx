'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Mic2, Shuffle, Repeat } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import LikeButton from '@/components/ui/LikeButton';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function AudioPlayer() {
  const {
    currentSong,
    isPlaying,
    togglePlayPause,
    progress,
    currentTime,
    duration,
    volume,
    setVolume,
    seekTo,
    queue,
    queueIndex,
    playNext,
    playPrevious,
    isRepeating,
    toggleRepeat
  } = usePlayer();
  const { t } = useTranslation();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const countedSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    import('@/utils/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsLoggedIn(!!session);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(!!session);
      });
      return () => subscription.unsubscribe();
    });
  }, []);

  // Count play when song has played for 30 seconds
  useEffect(() => {
    if (!currentSong || countedSongIdRef.current === currentSong.id) return;

    if (currentTime >= 30 || (duration > 0 && duration < 30 && currentTime >= duration - 0.5)) {
      countedSongIdRef.current = currentSong.id;
      fetch(`/api/songs/${currentSong.id}/play`, { method: 'POST' }).catch(console.error);
    }
  }, [currentTime, currentSong, duration]);

  if (!currentSong && !isLoggedIn) return null;

  const displayArtist = currentSong?.artist_name || currentSong?.creatorName || t('player.creatorFallback');
  const canPlayPrevious = queueIndex > 0;
  const canPlayNext = queueIndex >= 0 && queueIndex < queue.length - 1;
  const progressPercent = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const volumePercent = Math.max(0, Math.min(100, Number.isFinite(volume) ? volume * 100 : 0));

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-surface border-t border-white/5 px-4 flex items-center justify-between z-50">
      
      {/* Song Info */}
      <div className="flex items-center gap-4 w-1/3 min-w-[180px]">
        {currentSong ? (
          <>
            <img src={currentSong.cover_url} alt={currentSong.title} className="w-14 h-14 rounded-md object-cover shadow-md" />
            <div className="flex flex-col">
              <Link href={`/song/${currentSong.id}`} className="text-sm font-semibold text-white hover:underline cursor-pointer truncate">{currentSong.title}</Link>
              <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className="text-xs text-muted hover:text-white hover:underline cursor-pointer truncate">{displayArtist}</Link>
            </div>
            <div className="flex items-center">
              <PlaylistAddButton songId={currentSong.id} className="ml-4" iconClassName="w-5 h-5" />
              <LikeButton songId={currentSong.id} className="ml-2" iconClassName="w-5 h-5" />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4 opacity-50">
            <div className="w-14 h-14 rounded-md bg-white/10 animate-pulse" />
            <div className="flex flex-col gap-2">
              <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
              <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`flex flex-col items-center max-w-[40%] w-full ${!currentSong ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-6 mb-2">
          <button className="text-muted hover:text-white transition-colors">
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={playPrevious}
            disabled={!canPlayPrevious}
            className="text-muted hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-muted"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button 
            onClick={togglePlayPause}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-1" />}
          </button>
          <button
            onClick={playNext}
            disabled={!canPlayNext}
            className="text-muted hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-muted"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          <button 
            onClick={toggleRepeat}
            className={`transition-colors ${isRepeating ? 'text-indigo-500' : 'text-muted hover:text-white'}`}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>
        
        {/* Progress Bar */}
        <div className="flex items-center gap-2 w-full max-w-md">
          <span className="text-xs text-muted font-medium w-8 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            step="any"
            value={progressPercent}
            aria-label="Song position"
            className="player-slider flex-1"
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, rgba(255,255,255,0.18) ${progressPercent}%, rgba(255,255,255,0.18) 100%)`,
            }}
            onChange={(e) => seekTo(Number(e.currentTarget.value))}
          />
          <span className="text-xs text-muted font-medium w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Extra Controls */}
      <div className={`flex items-center justify-end gap-4 w-1/3 min-w-[180px] ${!currentSong ? 'opacity-50 pointer-events-none' : ''}`}>
        <button className="text-muted hover:text-white transition-colors" title="Creator Info">
          <Mic2 className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 w-24">
          <Volume2 className="w-4 h-4 text-muted" />
          <input
            type="range"
            min="0"
            max="100"
            step="any"
            value={volumePercent}
            aria-label="Volume"
            className="player-slider flex-1"
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${volumePercent}%, rgba(255,255,255,0.18) ${volumePercent}%, rgba(255,255,255,0.18) 100%)`,
            }}
            onChange={(e) => setVolume(Number(e.currentTarget.value) / 100)}
          />
        </div>
      </div>
    </div>
  );
}
