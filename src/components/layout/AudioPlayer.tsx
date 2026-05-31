'use client';
import { useState, useEffect, useRef } from 'react';
import { Check, ChevronRight, Info, MoreHorizontal, Pause, Play, Repeat, Share2, Shuffle, SkipBack, SkipForward, Timer, Volume2, Repeat1 } from 'lucide-react';
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

const SLEEP_TIMER_OPTIONS: Array<[number, string]> = [
  [5, '5 Minuten'],
  [10, '10 Minuten'],
  [15, '15 Minuten'],
  [30, '30 Minuten'],
  [45, '45 Minuten'],
  [60, '1 Stunde'],
];

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
    isShuffling,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
  } = usePlayer();
  const { t } = useTranslation();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTimerMenuOpen, setIsTimerMenuOpen] = useState(false);
  const [sleepTimerLabel, setSleepTimerLabel] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const isPlayingRef = useRef(isPlaying);
  const countedSongIdRef = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const displayArtist = currentSong?.artist_name || currentSong?.creatorName || t('player.creatorFallback');
  const canPlayPrevious = queueIndex > 0;
  const canPlayNext = queueIndex >= 0 && queueIndex < queue.length - 1;
  const progressPercent = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const volumePercent = Math.max(0, Math.min(100, Number.isFinite(volume) ? volume * 100 : 0));

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsTimerMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setIsTimerMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) {
        window.clearTimeout(sleepTimerRef.current);
      }
    };
  }, []);

  const clearSleepTimer = () => {
    if (sleepTimerRef.current) {
      window.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepTimerLabel(null);
  };

  const scheduleSleepTimer = (minutes: number, label: string) => {
    clearSleepTimer();
    sleepTimerRef.current = window.setTimeout(() => {
      if (isPlayingRef.current) {
        togglePlayPause();
      }
      sleepTimerRef.current = null;
      setSleepTimerLabel(null);
    }, minutes * 60 * 1000);
    setSleepTimerLabel(label);
    setIsMenuOpen(false);
    setIsTimerMenuOpen(false);
  };

  const scheduleSleepTimerForSongEnd = () => {
    if (!duration || duration <= currentTime) return;

    clearSleepTimer();
    const remainingMs = Math.max(0, (duration - currentTime - 0.25) * 1000);
    sleepTimerRef.current = window.setTimeout(() => {
      if (isPlayingRef.current) {
        togglePlayPause();
      }
      sleepTimerRef.current = null;
      setSleepTimerLabel(null);
    }, remainingMs);
    setSleepTimerLabel('Nach Ende des Songs');
    setIsMenuOpen(false);
    setIsTimerMenuOpen(false);
  };

  const shareCurrentSong = async () => {
    if (!currentSong) return;

    const songUrl = `${window.location.origin}/song/${currentSong.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: currentSong.title,
          text: `${currentSong.title} - ${displayArtist}`,
          url: songUrl,
        });
        setShareStatus('Geteilt');
      } else {
        await navigator.clipboard.writeText(songUrl);
        setShareStatus('Link kopiert');
      }
    } catch {
      return;
    }

    window.setTimeout(() => setShareStatus(''), 1800);
    setIsMenuOpen(false);
    setIsTimerMenuOpen(false);
  };

  if (!currentSong && !isLoggedIn) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-surface border-t border-white/5 px-4 flex items-center justify-between z-50">
      
      {/* Song Info */}
      <div className="flex items-center gap-4 w-[30%] min-w-[180px]">
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
      <div className={`flex flex-col items-center flex-1 max-w-2xl px-4 ${!currentSong ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-6 mb-2">
          <button 
            onClick={toggleShuffle}
            className={`transition-colors ${isShuffling ? 'text-indigo-500' : 'text-muted hover:text-white'}`}
          >
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
            className={`transition-colors ${repeatMode !== 'none' ? 'text-indigo-500' : 'text-muted hover:text-white'}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Progress Bar */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs text-muted font-medium w-10 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            step="any"
            value={progressPercent}
            aria-label="Song position"
            className="player-slider min-w-0 flex-1"
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, rgba(255,255,255,0.18) ${progressPercent}%, rgba(255,255,255,0.18) 100%)`,
            }}
            onChange={(e) => seekTo(Number(e.currentTarget.value))}
          />
          <span className="text-xs text-muted font-medium w-10">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Extra Controls */}
      <div className={`relative flex items-center justify-end gap-3 w-[30%] min-w-[180px] ${!currentSong ? 'opacity-50 pointer-events-none' : ''}`} ref={menuRef}>
        <button
          type="button"
          onClick={() => {
            setIsMenuOpen((open) => !open);
            setIsTimerMenuOpen(false);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-white"
          title="Song-Menü"
          aria-label="Song-Menü öffnen"
          aria-expanded={isMenuOpen}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        <div className="flex w-28 min-w-0 max-w-[22vw] items-center gap-2">
          <Volume2 className="w-4 h-4 text-muted" />
          <input
            type="range"
            min="0"
            max="100"
            step="any"
            value={volumePercent}
            aria-label="Volume"
            className="player-slider min-w-0 flex-1"
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${volumePercent}%, rgba(255,255,255,0.18) ${volumePercent}%, rgba(255,255,255,0.18) 100%)`,
            }}
            onChange={(e) => setVolume(Number(e.currentTarget.value) / 100)}
          />
        </div>

        {isMenuOpen && currentSong && (
          <div className="absolute bottom-14 right-0 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#242424]/95 py-2 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
            <Link
              href={`/song/${currentSong.id}`}
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/10"
            >
              <Info className="w-4 h-4 text-white/70" />
              <span className="flex-1">Song-Details</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsTimerMenuOpen((open) => !open)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10"
            >
              <Timer className="w-4 h-4 text-white/70" />
              <span className="flex-1">Sleeptimer</span>
              {sleepTimerLabel ? <span className="text-xs text-primary">{sleepTimerLabel}</span> : null}
              <ChevronRight className={`w-4 h-4 text-white/60 transition-transform ${isTimerMenuOpen ? 'rotate-90' : ''}`} />
            </button>

            {isTimerMenuOpen && (
              <div className="border-y border-white/10 bg-black/20 py-1">
                {SLEEP_TIMER_OPTIONS.map(([minutes, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => scheduleSleepTimer(minutes, label)}
                    className="flex w-full items-center gap-3 px-11 py-2.5 text-left text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <span className="flex-1">{label}</span>
                    {sleepTimerLabel === label ? <Check className="w-4 h-4 text-primary" /> : null}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={scheduleSleepTimerForSongEnd}
                  className="flex w-full items-center gap-3 px-11 py-2.5 text-left text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!duration || duration <= currentTime}
                >
                  <span className="flex-1">Nach Ende des Songs</span>
                  {sleepTimerLabel === 'Nach Ende des Songs' ? <Check className="w-4 h-4 text-primary" /> : null}
                </button>
                {sleepTimerLabel ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearSleepTimer();
                      setIsMenuOpen(false);
                      setIsTimerMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-11 py-2.5 text-left text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Timer ausschalten
                  </button>
                ) : null}
              </div>
            )}

            <button
              type="button"
              onClick={shareCurrentSong}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10"
            >
              <Share2 className="w-4 h-4 text-white/70" />
              <span className="flex-1">Teilen</span>
              {shareStatus ? <span className="text-xs text-primary">{shareStatus}</span> : null}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
