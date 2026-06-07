'use client';
import { useState, useEffect, useRef } from 'react';
import { Check, ChevronRight, Image as ImageIcon, Info, Loader2, MoreHorizontal, Pause, Play, Repeat, Share2, Shuffle, SkipBack, SkipForward, Timer, Volume2, Repeat1 } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import PlayerSaveButton from '@/components/ui/PlayerSaveButton';
import MobilePlayerFullscreen from './MobilePlayerFullscreen';
import { compressImage } from '@/lib/imageCompression';
import { getErrorMessage } from '@/lib/errors';
import { isAdminUser } from '@/lib/admin';
import { uploadSongCover } from '@/lib/song-cover-upload';
import { hasPreferenceStorageConsent } from '@/lib/cookie-consent';

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
  const pathname = usePathname();
  const {
    currentSong, isPlaying, progress, currentTime, duration, volume,
    playNext, playPrevious, togglePlayPause, setVolume, seekTo, queue,
    queueIndex, isShuffling, toggleShuffle, repeatMode, toggleRepeat, user, isAdPlaying
  } = usePlayer();
  const { t } = useTranslation();

  // Keyboard controls
  useEffect(() => {
    if (pathname?.startsWith('/feed')) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pathname, togglePlayPause]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTimerMenuOpen, setIsTimerMenuOpen] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [sleepTimerLabel, setSleepTimerLabel] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  const countedSongIdRef = useRef<string | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const displayArtist = currentSong?.artist_name || currentSong?.creatorName || t('player.creatorFallback');
  const canPlayPrevious = queueIndex > 0;
  const canPlayNext = queueIndex >= 0 && queueIndex < queue.length - 1;
  const progressPercent = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const volumePercent = Math.max(0, Math.min(100, Number.isFinite(volume) ? volume * 100 : 0));

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

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
      if (
        !desktopMenuRef.current?.contains(event.target as Node) &&
        !mobileMenuRef.current?.contains(event.target as Node)
      ) {
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

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    let file = event.target.files?.[0];
    if (!file || !currentSong) return;

    setIsUploadingCover(true);
    try {
      file = await compressImage(file);
      const coverUrl = await uploadSongCover(currentSong.id, file);

      if (hasPreferenceStorageConsent()) {
        try {
          const cachedSong = localStorage.getItem('player_currentSong');
          if (cachedSong) {
            const parsedSong = JSON.parse(cachedSong);
            if (parsedSong.id === currentSong.id) {
              localStorage.setItem('player_currentSong', JSON.stringify({ ...parsedSong, cover_url: coverUrl }));
            }
          }

          const cachedQueue = localStorage.getItem('player_queue');
          if (cachedQueue) {
            const parsedQueue = JSON.parse(cachedQueue);
            localStorage.setItem('player_queue', JSON.stringify(
              parsedQueue.map((song: { id: string }) => song.id === currentSong.id ? { ...song, cover_url: coverUrl } : song)
            ));
          }
        } catch (cacheError) {
          console.error('Failed to refresh cached cover:', cacheError);
        }
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('Fehler beim Hochladen: ' + getErrorMessage(error));
    } finally {
      setIsUploadingCover(false);
      event.target.value = '';
    }
  };

  const renderSongMenu = (positionClassName: string) => {
    if (!isMenuOpen || !currentSong) return null;

    return (
      <div
        className={`absolute bottom-full mb-4 w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-white/10 bg-[#242424]/95 py-2 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-xl md:w-72 ${positionClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
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

        {isAdminUser(user) ? (
          <>
            <div className="mx-3 h-px bg-white/10" />
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                coverInputRef.current?.click();
              }}
              disabled={isUploadingCover}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {isUploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4 text-white/70" />}
              Cover ändern
            </button>
          </>
        ) : null}
      </div>
    );
  };

  if (pathname?.startsWith('/feed')) return null;
  if (!user) return null;
  if (!currentSong && queue.length === 0) return null;

  return (
    <>
      <div 
        className={`fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 h-16 items-center justify-between border-t border-white/10 bg-surface/95 px-2 backdrop-blur-xl md:bottom-0 md:flex md:h-24 md:border-white/5 md:bg-surface md:px-4 ${currentSong ? 'flex' : 'hidden'}`}
        onClick={() => setIsMobilePlayerOpen(true)}
      >
        {currentSong ? (
        <input
          type="range"
          min="0"
          max="100"
          step="any"
          value={progressPercent}
          aria-label="Song position"
          className="player-slider absolute inset-x-0 top-0 h-1 w-full md:hidden"
          style={{
            background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, rgba(255,255,255,0.18) ${progressPercent}%, rgba(255,255,255,0.18) 100%)`,
          }}
          onChange={(e) => {
            if (isAdPlaying) return;
            seekTo(Number(e.currentTarget.value));
          }}
        />
      ) : null}
      
      {/* Song Info */}
      <div className="flex min-w-0 flex-1 items-center gap-2 md:w-[30%] md:min-w-[180px] md:flex-none md:gap-4">
        {currentSong ? (
          <>
            <img src={currentSong.cover_url} alt={currentSong.title} className="h-11 w-11 shrink-0 rounded-md object-cover shadow-md md:h-14 md:w-14" />
            <div className="flex min-w-0 flex-col">
              <Link href={`/song/${currentSong.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-white hover:underline cursor-pointer truncate">{currentSong.title}</Link>
              <Link href={`/artist/${encodeURIComponent(displayArtist)}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted hover:text-white hover:underline cursor-pointer truncate">{displayArtist}</Link>
            </div>
            <div ref={desktopMenuRef} className="relative ml-4 hidden items-center gap-2 md:flex" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsMenuOpen((open) => !open);
                  setIsTimerMenuOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-white"
                title="Song-Menü"
                aria-label="Song-Menü öffnen"
                aria-expanded={isMenuOpen}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              <PlayerSaveButton songId={currentSong.id} iconClassName="w-5 h-5" openUpwards />
              {renderSongMenu('left-0')}
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
      <div className={`hidden flex-1 flex-col items-center px-4 md:flex md:max-w-2xl ${!currentSong ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-6 mb-2">
          <button 
            onClick={toggleShuffle}
            className={`transition-colors ${isShuffling ? 'text-indigo-500' : 'text-muted hover:text-white'}`}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={playPrevious}
            disabled={!canPlayPrevious || isAdPlaying}
            className="text-muted hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-muted"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button 
            onClick={togglePlayPause}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center transition-colors hover:bg-white/90"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>
          <button
            onClick={playNext}
            disabled={!canPlayNext || isAdPlaying}
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
            onChange={(e) => {
              if (isAdPlaying) return;
              seekTo(Number(e.currentTarget.value));
            }}
          />
          <span className="text-xs text-muted font-medium w-10">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Extra Controls */}
      <div className={`relative flex shrink-0 items-center justify-end gap-1 md:w-[30%] md:min-w-[180px] md:gap-3 ${!currentSong ? 'opacity-50 pointer-events-none' : ''}`} ref={mobileMenuRef}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsMenuOpen((open) => !open);
            setIsTimerMenuOpen(false);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-white md:hidden"
          title="Song-Menü"
          aria-label="Song-Menü öffnen"
          aria-expanded={isMenuOpen}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black md:hidden"
          aria-label={isPlaying ? 'Pausieren' : 'Abspielen'}
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playNext();
          }}
          disabled={!canPlayNext || isAdPlaying}
          className="flex h-9 w-9 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white disabled:opacity-30 md:hidden"
          aria-label="Nächster Song"
        >
          <SkipForward className="h-4 w-4 fill-current" />
        </button>
        <div className="hidden w-28 min-w-0 max-w-[22vw] items-center gap-2 md:flex" onClick={(e) => e.stopPropagation()}>
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

        {renderSongMenu('right-0 md:hidden')}
      </div>
      {isAdminUser(user) ? (
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
      ) : null}
    </div>
    <MobilePlayerFullscreen isOpen={isMobilePlayerOpen} onClose={() => setIsMobilePlayerOpen(false)} />
    </>
  );
}
