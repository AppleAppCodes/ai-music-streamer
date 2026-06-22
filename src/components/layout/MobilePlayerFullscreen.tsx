'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Share2, Timer, Music } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import PlayerSaveButton from '@/components/ui/PlayerSaveButton';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';

interface MobilePlayerFullscreenProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function MobilePlayerFullscreen({ isOpen, onClose }: MobilePlayerFullscreenProps) {
  const {
    currentSong,
    isPlaying,
    togglePlayPause,
    progress,
    currentTime,
    duration,
    seekTo,
    queue,
    queueIndex,
    playNext,
    playPrevious,
    isShuffling,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    isAdPlaying,
  } = usePlayer();
  
  const { t } = useTranslation();
  const controls = useDragControls();

  const canPlayPrevious = queueIndex > 0;
  const canPlayNext = queueIndex >= 0 && queueIndex < queue.length - 1;
  const progressPercent = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const displayArtist = currentSong?.artist_name || currentSong?.creatorName || t('player.creatorFallback');

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!currentSong) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          drag="y"
          dragControls={controls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100 || info.velocity.y > 500) {
              onClose();
            }
          }}
          className="fixed inset-0 z-[100] flex flex-col bg-background md:hidden"
        >
          {/* Blurred Background from Cover */}
          <div className="absolute inset-0 z-0">
            {currentSong.cover_url ? (
              <Image 
                src={currentSong.cover_url} 
                alt="Background" 
                fill
                sizes="10vw"
                className="object-cover opacity-30 blur-3xl scale-110" 
                priority
              />
            ) : null}
            <div className="absolute inset-0 bg-black/60 bg-gradient-to-t from-black via-black/80 to-transparent" />
          </div>

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-4 py-4 mt-2" onPointerDown={(e) => controls.start(e)}>
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white transition-colors rounded-full bg-white/5">
              <ChevronDown className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Wird jetzt abgespielt</span>
              <span className="text-xs font-semibold text-white/90">{displayArtist}</span>
            </div>
            <div className="w-10" /> {/* Spacer for flex balance */}
          </div>

          {/* Main Content */}
          <div className="relative z-10 flex flex-col flex-1 px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            
            {/* Cover Art */}
            <div className="flex-1 flex items-center justify-center py-4 min-h-0">
              {currentSong.cover_url ? (
                <div className="relative w-full max-w-[320px] aspect-square overflow-hidden rounded-xl shadow-2xl">
                  <Image 
                    src={currentSong.cover_url} 
                    alt={currentSong.title} 
                    fill
                    sizes="(max-width: 640px) 100vw, 320px"
                    className="object-cover" 
                    priority
                  />
                </div>
              ) : (
                <div className="flex aspect-square w-full max-w-[320px] items-center justify-center rounded-[1.75rem] bg-surface-hover shadow-2xl">
                  <Music className="w-24 h-24 text-white/20" />
                </div>
              )}
            </div>

            {/* Title & Artist & Actions */}
            <div className="flex items-center justify-between mt-4 mb-6">
              <div className="flex flex-col min-w-0 pr-4">
                <Link 
                  href={`/song/${currentSong.id}`} 
                  onClick={onClose}
                  className="text-2xl font-bold text-white truncate"
                >
                  {currentSong.title}
                </Link>
                <Link 
                  href={`/artist/${encodeURIComponent(displayArtist)}`} 
                  onClick={onClose}
                  className="text-base text-white/60 truncate mt-1"
                >
                  {displayArtist}
                </Link>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <PlayerSaveButton songId={currentSong.id} iconClassName="w-7 h-7" className="p-0 hover:bg-transparent" openUpwards />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex flex-col gap-2 mb-6">
              <input
                type="range"
                min="0"
                max="100"
                step="any"
                value={progressPercent}
                aria-label="Song position"
                className="player-slider w-full h-1.5"
                style={{
                  background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%, rgba(255,255,255,0.2) 100%)`,
                }}
                onChange={(e) => {
                  if (isAdPlaying) return;
                  seekTo(Number(e.currentTarget.value));
                }}
              />
              <div className="flex justify-between text-xs text-white/50 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(duration - currentTime)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-8">
              <button 
                onClick={toggleShuffle}
                className={`p-2 transition-colors ${isShuffling ? 'text-primary' : 'text-white/50 hover:text-white'}`}
              >
                <Shuffle className="w-6 h-6" />
              </button>
              
              <button
                onClick={playPrevious}
                disabled={!canPlayPrevious || isAdPlaying}
                className="p-2 text-white hover:text-primary transition-colors disabled:opacity-30 disabled:hover:text-white"
              >
                <SkipBack className="w-10 h-10 fill-current" />
              </button>
              
              <button
                onClick={togglePlayPause}
                className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center transition-colors hover:bg-white/90"
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
              </button>
              
              <button
                onClick={playNext}
                disabled={!canPlayNext || isAdPlaying}
                className="p-2 text-white hover:text-primary transition-colors disabled:opacity-30 disabled:hover:text-white"
              >
                <SkipForward className="w-10 h-10 fill-current" />
              </button>
              
              <button 
                onClick={toggleRepeat}
                className={`p-2 transition-colors ${repeatMode !== 'none' ? 'text-primary' : 'text-white/50 hover:text-white'}`}
              >
                <Repeat className="w-6 h-6" />
              </button>
            </div>

            {/* Footer Actions (Share, Timer) */}
            <div className="flex items-center justify-between mt-auto">
              <button 
                onClick={() => {
                  const url = `${window.location.origin}/song/${currentSong.id}`;
                  if (navigator.share) navigator.share({ title: currentSong.title, url });
                  else navigator.clipboard.writeText(url);
                }}
                className="p-3 text-white/50 hover:text-white transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-3 text-white/50 hover:text-white transition-colors">
                <Timer className="w-5 h-5" />
              </button>
            </div>
            
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
