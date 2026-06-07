'use client';

import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Heart,
  Loader2,
  Music2,
  Play,
  Plus,
  Save,
  Settings2,
  Share2,
  Sparkles,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { usePlayer } from '@/lib/player-context';
import { isAdminUser } from '@/lib/admin';
import { getErrorMessage } from '@/lib/errors';
import { emitLikedSongChange } from '@/lib/liked-song-events';
import { setNowPlayingMetadata } from '@/lib/media-session';
import { useTranslation } from 'react-i18next';

interface FeedClip {
  song_id: string;
  video_url: string | null;
  cover_url: string | null;
  hook_start_seconds: number;
  hook_end_seconds: number;
}

interface FeedStats {
  song_id: string;
  likes_count: number;
}

interface FeedProfile {
  username?: string | null;
  avatar_url?: string | null;
}

type FeedSongRecord = Song & {
  profiles?: FeedProfile | null;
  song_feed_clips?: FeedClip | FeedClip[] | null;
  song_feed_stats?: FeedStats | FeedStats[] | null;
};

type FeedSong = Song & {
  clip: FeedClip;
  profiles?: FeedProfile | null;
  stats: FeedStats;
};

type FeedMode = 'for-you' | 'following' | 'explore';
type StatsKey = 'likes_count';

interface FeedCardProps {
  song: FeedSong;
  active: boolean;
  muted: boolean;
  soundUnlocked: boolean;
  liked: boolean;
  following: boolean;
  isAdmin: boolean;
  onAutoplayBlocked: () => void;
  onEdit: () => void;
  onFollow: () => void;
  onLike: (forceLike?: boolean) => void;
  onListen: () => void;
  onShare: () => void;
  onToggleMute: () => void;
  onUserInteraction: () => void;
}

const DEFAULT_HOOK_DURATION_SECONDS = 20;

function getSingleRelation<T>(relation?: T | T[] | null): T | null {
  if (Array.isArray(relation)) return relation[0] || null;
  return relation || null;
}

function getClip(record: FeedSongRecord): FeedClip {
  const relation = getSingleRelation(record.song_feed_clips);
  const fallbackEnd = Math.max(1, Math.min(record.duration || DEFAULT_HOOK_DURATION_SECONDS, DEFAULT_HOOK_DURATION_SECONDS));

  const rawStart = Math.max(0, Number(relation?.hook_start_seconds) || 0);
  const rawEnd = Number(relation?.hook_end_seconds);
  const maxEnd = record.duration ? Math.max(1, record.duration) : undefined;
  const start = maxEnd ? Math.min(rawStart, Math.max(0, maxEnd - 0.25)) : rawStart;
  const end = Math.max(
    start + 1,
    Number.isFinite(rawEnd) && rawEnd > 0 ? rawEnd : fallbackEnd,
  );

  return {
    song_id: record.id,
    video_url: relation?.video_url || null,
    cover_url: relation?.cover_url || null,
    hook_start_seconds: start,
    hook_end_seconds: maxEnd ? Math.min(end, maxEnd) : end,
  };
}

function getStats(record: FeedSongRecord): FeedStats {
  return getSingleRelation(record.song_feed_stats) || {
    song_id: record.id,
    likes_count: 0,
  };
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function stableHash(value: string): number {
  return value.split('').reduce((hash, character) => ((hash << 5) - hash) + character.charCodeAt(0), 0);
}

function getForYouScore(song: FeedSong, likedGenres: Set<string>, followedArtists: Set<string>): number {
  return (
    Math.log10(Math.max(1, song.plays + 1)) * 12
    + song.stats.likes_count * 5
    + (song.genre && likedGenres.has(song.genre) ? 18 : 0)
    + (followedArtists.has(song.artist_name || song.creatorName || 'Creator') ? 22 : 0)
  );
}

const FeedCard = React.memo(function FeedCard({
  song,
  active,
  muted,
  soundUnlocked,
  liked,
  following,
  isAdmin,
  onAutoplayBlocked,
  onEdit,
  onFollow,
  onLike,
  onListen,
  onShare,
  onToggleMute,
  onUserInteraction,
}: FeedCardProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastTapRef = useRef(0);
  const heartTimerRef = useRef<number | null>(null);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [failedVideoUrl, setFailedVideoUrl] = useState<string | null>(null);
  const videoUrl = song.clip.video_url || null;
  const hasPlayableVideo = Boolean(videoUrl) && failedVideoUrl !== videoUrl;
  const mediaRef = hasPlayableVideo ? videoRef : audioRef;
  const displayArtist = song.artist_name || song.creatorName || 'Creator';
  const avatarUrl = song.profiles?.avatar_url;

  useEffect(() => {
    if (!active) return;
    setNowPlayingMetadata({
      title: song.title,
      artist: displayArtist,
      album: 'Yoriax Hook',
      artworkUrl: song.cover_url,
    });
  }, [active, displayArtist, song.cover_url, song.title]);

  const seekToHookStart = useCallback((media: HTMLMediaElement, force = false) => {
    const configuredStart = Math.max(0, Number(song.clip.hook_start_seconds) || 0);
    const configuredEnd = Math.max(
      configuredStart + 0.25,
      Number(song.clip.hook_end_seconds) || configuredStart + DEFAULT_HOOK_DURATION_SECONDS,
    );
    const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : configuredEnd;
    const start = Math.min(configuredStart, Math.max(0, duration - 0.2));
    const end = Math.min(Math.max(configuredEnd, start + 0.25), duration);

    if (
      force ||
      !Number.isFinite(media.currentTime)
      || media.currentTime + 0.05 < start
      || media.currentTime >= end
    ) {
      media.currentTime = start;
    }

    return { start, end };
  }, [song.clip.hook_end_seconds, song.clip.hook_start_seconds]);

  const playFromHook = useCallback((media: HTMLMediaElement) => {
    const startPlayback = () => {
      seekToHookStart(media, true);
      return media.play();
    };

    if (media.readyState >= 1) {
      return startPlayback();
    }

    const metadataPromise = new Promise<void>((resolve, reject) => {
      media.addEventListener('loadedmetadata', () => {
        startPlayback().then(resolve).catch(reject);
      }, { once: true });
    });
    media.load();
    return metadataPromise;
  }, [seekToHookStart]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    media.muted = muted;
    if (!active) {
      media.pause();
      audioRef.current?.pause();
      videoRef.current?.pause();
      return;
    }

    const startAtHook = () => {
      playFromHook(media).catch((error) => {
        if (error && error.name === 'AbortError') return;
        if (error && error.name === 'NotAllowedError' && !muted && !soundUnlocked) {
          media.muted = true;
          playFromHook(media)
            .then(onAutoplayBlocked)
            .catch((fallbackError) => {
              if (fallbackError && fallbackError.name === 'AbortError') return;
              onAutoplayBlocked();
            });
          return;
        }

        if (media === videoRef.current && videoUrl) {
          setFailedVideoUrl(videoUrl);
        }
      });
    };
    const audioElement = audioRef.current;
    const videoElement = videoRef.current;

    if (media.readyState >= 1) {
      startAtHook();
    } else {
      media.addEventListener('loadedmetadata', startAtHook, { once: true });
    }

    return () => {
      media.removeEventListener('loadedmetadata', startAtHook);
      media.pause();
      audioElement?.pause();
      videoElement?.pause();
    };
  }, [active, mediaRef, muted, onAutoplayBlocked, playFromHook, soundUnlocked, videoUrl]);

  useEffect(() => () => {
    if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
  }, []);

  const keepInsideHook = () => {
    const media = mediaRef.current;
    if (!media) return;

    const { start, end } = seekToHookStart(media);
    if (media.currentTime >= end) {
      media.currentTime = start;
      media.play().catch(() => {});
    }
  };

  const showLikeBurst = () => {
    setShowHeartBurst(true);
    if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
    heartTimerRef.current = window.setTimeout(() => setShowHeartBurst(false), 650);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, a, input')) return;

    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      onLike(true);
      showLikeBurst();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  };

  const unlockSoundFromGesture = () => {
    const media = mediaRef.current;
    if (media) {
      media.muted = false;
      playFromHook(media).catch(() => {});
    }
    onUserInteraction();
  };

  const toggleMute = () => {
    const media = mediaRef.current;
    if (media) {
      media.muted = !muted;
      if (muted) {
        seekToHookStart(media);
        media.play().catch(() => {});
      }
    }
    if (muted) onUserInteraction();
    onToggleMute();
  };

  return (
    <article className="relative flex h-full w-full snap-start snap-always items-center justify-center bg-[#050505] px-0 py-0 md:px-4 md:py-5">
      <div
        className="relative h-full w-full max-w-[470px] overflow-hidden bg-[#111] shadow-2xl shadow-black/60 md:max-h-[calc(100dvh-2.5rem)] md:rounded-[1.75rem] md:border md:border-white/10"
        onPointerDown={(event) => {
          if (!(event.target as HTMLElement).closest('button, a, input')) unlockSoundFromGesture();
        }}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute inset-0">
          <Image src={song.clip.cover_url || song.cover_url} alt="" fill sizes="100vw" className="h-full w-full scale-110 object-cover opacity-45 blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/90" />
        </div>

        {hasPlayableVideo ? (
          <video
            ref={videoRef}
            src={videoUrl || undefined}
            poster={song.clip.cover_url || song.cover_url}
            playsInline
            muted={muted}
            loop
            preload={active ? 'auto' : 'metadata'}
            onError={() => {
              if (videoUrl) setFailedVideoUrl(videoUrl);
            }}
            onTimeUpdate={keepInsideHook}
            className="relative h-full w-full object-cover"
          />
        ) : (
          <Image src={song.clip.cover_url || song.cover_url} alt={song.title} fill sizes="(max-width: 768px) 100vw, 470px" className="relative h-full w-full object-cover" />
        )}

        <audio
          ref={audioRef}
          src={song.audio_url}
          preload={active ? 'auto' : 'metadata'}
          onTimeUpdate={hasPlayableVideo ? undefined : keepInsideHook}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/90" />

        {showHeartBurst ? (
          <Heart className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-28 w-28 -translate-x-1/2 -translate-y-1/2 animate-pulse fill-rose-500 text-rose-500 drop-shadow-[0_0_35px_rgba(244,63,94,0.75)]" />
        ) : null}

        {isAdmin ? (
          <button
            type="button"
            onClick={onEdit}
            className="absolute left-4 top-20 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/70"
            aria-label={t('feed.editHook', { title: song.title })}
          >
            <Settings2 className="h-5 w-5" />
          </button>
        ) : null}

        <div className="absolute bottom-[calc(9.5rem+env(safe-area-inset-bottom))] right-3 z-20 flex flex-col items-center gap-4 text-white md:bottom-28" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={onFollow} className="group relative" aria-label={following ? t('feed.unfollow', { artist: displayArtist }) : t('feed.follow', { artist: displayArtist })}>
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-violet-950 text-sm font-black shadow-lg">
              {avatarUrl ? <Image src={avatarUrl} alt={displayArtist} width={48} height={48} className="h-full w-full object-cover" /> : displayArtist.slice(0, 1).toUpperCase()}
            </span>
            <span className={`absolute -bottom-2 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-[#111] ${following ? 'bg-white text-black' : 'bg-rose-500 text-white'}`}>
              {following ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" strokeWidth={4} />}
            </span>
          </button>

          <button type="button" onClick={() => onLike()} className="flex flex-col items-center gap-1" aria-label={liked ? t('feed.unlike', { title: song.title }) : t('feed.like', { title: song.title })}>
            <Heart className={`h-8 w-8 drop-shadow-lg transition-transform active:scale-75 ${liked ? 'fill-rose-500 text-rose-500' : 'fill-black/20 text-white'}`} strokeWidth={2.3} />
            <span className="text-[11px] font-bold">{formatCount(song.stats.likes_count)}</span>
          </button>

          <button type="button" onClick={onShare} className="flex flex-col items-center gap-1" aria-label={t('feed.shareAria', { title: song.title })}>
            <Share2 className="h-8 w-8 fill-black/20 text-white drop-shadow-lg" strokeWidth={2.3} />
            <span className="text-[11px] font-bold">{t('feed.shareIcon')}</span>
          </button>

          <button type="button" onClick={toggleMute} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-md" aria-label={muted ? t('feed.unmute') : t('feed.mute')}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-10 p-5 pr-20 md:bottom-0" onPointerDown={(event) => event.stopPropagation()}>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-violet-300">
            <Music2 className="h-4 w-4" />
            {t('feed.yoriaxHook')}
          </div>
          <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className="text-sm font-bold text-white/80 transition-colors hover:text-white hover:underline">
            @{displayArtist}
          </Link>
          <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-white">{song.title}</h1>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/70">
            {song.description || t('feed.defaultDescription', { genre: song.genre || 'AI Music' })}
          </p>
          <button
            type="button"
            onClick={onListen}
            className="mt-4 flex w-fit items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-transform hover:scale-[1.02] sm:px-6 sm:py-3.5 sm:text-base"
          >
            <Play className="h-4 w-4 fill-current" />
            {t('feed.listenFull')}
          </button>
        </div>
      </div>
    </article>
  );
});

export default function FeedPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { pausePlayback, playSong, setQueue } = usePlayer();
  const [songs, setSongs] = useState<FeedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<FeedMode>('for-you');
  const [muted, setMuted] = useState(false);
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(new Set());
  const [followedArtists, setFollowedArtists] = useState<Set<string>>(new Set());
  const [rankingScores, setRankingScores] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState('');
  const [editingSong, setEditingSong] = useState<FeedSong | null>(null);
  const [hookStart, setHookStart] = useState(0);
  const [hookEnd, setHookEnd] = useState(DEFAULT_HOOK_DURATION_SECONDS);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [inactiveGenres, setInactiveGenres] = useState<Set<string>>(new Set());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const scrollRafRef = useRef<number | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    pausePlayback();
  }, [pausePlayback]);

  useEffect(() => {
    const loadFeed = async () => {
      setLoading(true);
      const [{ data: songData, error }, { data: sessionData }] = await Promise.all([
        supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays, genre, created_at, creator_id, duration, audio_url, profiles!songs_creator_id_fkey(username, avatar_url), song_feed_clips(song_id, video_url, cover_url, hook_start_seconds, hook_end_seconds), song_feed_stats(song_id, likes_count)')
          .order('plays', { ascending: false })
          .limit(80),
        supabase.auth.getSession(),
      ]);

      if (error) console.error('Failed to load feed:', error);

      const feedSongs = ((songData || []) as unknown as FeedSongRecord[]).map((song) => ({
        ...song,
        clip: getClip(song),
        stats: getStats(song),
      }));

      const session = sessionData.session;
      let initialLikedSongIds = new Set<string>();
      let initialFollowedArtists = new Set<string>();

      setIsAdmin(isAdminUser(session?.user));
      setUserId(session?.user.id || null);

      if (session) {
        const [{ data: likes }, { data: follows }] = await Promise.all([
          supabase.from('liked_songs').select('song_id').eq('user_id', session.user.id),
          supabase.from('follows').select('artist_name').eq('user_id', session.user.id),
        ]);
        initialLikedSongIds = new Set((likes || []).map((item) => item.song_id));
        initialFollowedArtists = new Set((follows || []).map((item) => item.artist_name));
      }

      const initialLikedGenres = new Set<string>(
        feedSongs.flatMap((song) => (
          initialLikedSongIds.has(song.id) && song.genre ? [song.genre] : []
        )),
      );

      setSongs(feedSongs);
      setLikedSongIds(initialLikedSongIds);
      setFollowedArtists(initialFollowedArtists);
      setRankingScores(Object.fromEntries(
        feedSongs.map((song) => [song.id, getForYouScore(song, initialLikedGenres, initialFollowedArtists)]),
      ));
      setLoading(false);
    };

    loadFeed();
  }, [supabase]);

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    songs.forEach((song) => {
      if (song.genre) genres.add(song.genre);
    });
    return Array.from(genres).sort();
  }, [songs]);

  const displayedSongs = useMemo(() => {
    const filteredSongs = inactiveGenres.size > 0 
      ? songs.filter(song => !song.genre || !inactiveGenres.has(song.genre)) 
      : songs;

    if (mode === 'following') {
      return filteredSongs.filter((song) => followedArtists.has(song.artist_name || song.creatorName || 'Creator'));
    }

    if (mode === 'explore') {
      return [...filteredSongs].sort((first, second) => stableHash(first.id) - stableHash(second.id));
    }

    return filteredSongs
      .filter((song) => song.genre?.trim().toLowerCase() !== 'chillhop')
      .sort((first, second) => (
        (rankingScores[second.id] || 0) - (rankingScores[first.id] || 0)
        || stableHash(first.id) - stableHash(second.id)
      ));
  }, [followedArtists, mode, rankingScores, songs, inactiveGenres]);

  const changeMode = (nextMode: FeedMode) => {
    itemRefs.current = [];
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ top: 0 });
    setMode(nextMode);
  };

  useEffect(() => {
    if (activeIndex < displayedSongs.length) return;
    const frame = window.requestAnimationFrame(() => {
      setActiveIndex(Math.max(0, displayedSongs.length - 1));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, displayedSongs.length]);

  const updateActiveFromScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || displayedSongs.length === 0) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const focusY = scrollerRect.top + scrollerRect.height / 2;
    let nextIndex = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;

    itemRefs.current.forEach((element, index) => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const distance = Math.abs(centerY - focusY);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        nextIndex = index;
      }
    });

    setActiveIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
  }, [displayedSongs.length]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const scheduleActiveUpdate = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        updateActiveFromScroll();
      });
    };

    scheduleActiveUpdate();
    scroller.addEventListener('scroll', scheduleActiveUpdate, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', scheduleActiveUpdate);
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [displayedSongs.length, mode, updateActiveFromScroll]);

  const scrollToIndex = useCallback((index: number) => {
    const targetIndex = Math.max(0, Math.min(displayedSongs.length - 1, index));
    setActiveIndex(targetIndex);
    itemRefs.current[targetIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [displayedSongs.length]);

  useEffect(() => {
    const handleArrowNavigation = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        scrollToIndex(activeIndex + 1);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        scrollToIndex(activeIndex - 1);
      }
    };

    window.addEventListener('keydown', handleArrowNavigation);
    return () => window.removeEventListener('keydown', handleArrowNavigation);
  }, [activeIndex, scrollToIndex]);

  const updateSongStats = useCallback((songId: string, key: StatsKey, delta: number) => {
    setSongs((currentSongs) => currentSongs.map((song) => (
      song.id === songId
        ? { ...song, stats: { ...song.stats, [key]: Math.max(0, song.stats[key] + delta) } }
        : song
    )));
  }, []);

  const requireLogin = useCallback(() => {
    if (userId) return true;
    router.push('/login');
    return false;
  }, [userId, router]);

  const toggleLike = useCallback(async (song: FeedSong, forceLike = false) => {
    if (!requireLogin()) return;
    const currentlyLiked = likedSongIds.has(song.id);
    if (currentlyLiked && forceLike) return;
    const nextLiked = !currentlyLiked;

    setLikedSongIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextLiked) nextIds.add(song.id);
      else nextIds.delete(song.id);
      return nextIds;
    });
    updateSongStats(song.id, 'likes_count', nextLiked ? 1 : -1);
    emitLikedSongChange(song.id, nextLiked);

    let error = null;
    if (nextLiked) {
      const { data: existing, error: lookupError } = await supabase
        .from('liked_songs')
        .select('id')
        .eq('user_id', userId)
        .eq('song_id', song.id)
        .limit(1);

      if (!lookupError && existing?.length) {
        return;
      }

      if (lookupError) {
        error = lookupError;
      } else {
        const insertResult = await supabase.from('liked_songs').insert({ user_id: userId, song_id: song.id });
        error = insertResult.error?.code === '23505' ? null : insertResult.error;
      }
    } else {
      const deleteResult = await supabase.from('liked_songs').delete().eq('user_id', userId).eq('song_id', song.id);
      error = deleteResult.error;
    }

    if (error) {
      setActionError(t('feed.errors.like'));
      emitLikedSongChange(song.id, currentlyLiked);
      setLikedSongIds((currentIds) => {
        const nextIds = new Set(currentIds);
        if (currentlyLiked) nextIds.add(song.id);
        else nextIds.delete(song.id);
        return nextIds;
      });
      updateSongStats(song.id, 'likes_count', nextLiked ? -1 : 1);
    }
  }, [likedSongIds, requireLogin, supabase, t, updateSongStats, userId]);

  const toggleFollow = useCallback(async (song: FeedSong) => {
    if (!requireLogin()) return;
    const artist = song.artist_name || song.creatorName || 'Creator';
    const currentlyFollowing = followedArtists.has(artist);

    setFollowedArtists((currentArtists) => {
      const nextArtists = new Set(currentArtists);
      if (currentlyFollowing) nextArtists.delete(artist);
      else nextArtists.add(artist);
      return nextArtists;
    });

    const { error } = currentlyFollowing
      ? await supabase.from('follows').delete().eq('user_id', userId).eq('artist_name', artist)
      : await supabase.from('follows').insert({ user_id: userId, artist_name: artist });

    if (error) {
      setActionError(t('feed.errors.follow'));
      setFollowedArtists((currentArtists) => {
        const nextArtists = new Set(currentArtists);
        if (currentlyFollowing) nextArtists.add(artist);
        else nextArtists.delete(artist);
        return nextArtists;
      });
    }
  }, [followedArtists, requireLogin, supabase, t, userId]);

  const listenToFullSong = useCallback((song: FeedSong, index: number) => {
    const queue = displayedSongs.map((queueSong): Song => ({
      ...queueSong,
      creatorName: queueSong.artist_name || 'Creator',
    }));
    setQueue(queue, index);
    playSong({ ...song, creatorName: song.artist_name || 'Creator' });
    router.push(`/song/${song.id}`);
  }, [displayedSongs, playSong, router, setQueue]);

  const shareSong = useCallback(async (song: FeedSong) => {
    const url = `${window.location.origin}/song/${song.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: song.title, text: t('feed.shareText', { title: song.title }), url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Closing the native share sheet is not an error the UI needs to surface.
    }
  }, [t]);

  const handleAutoplayBlocked = useCallback(() => {
    if (soundUnlocked) return;
    setMuted(true);
    setAutoplayMuted(true);
  }, [soundUnlocked]);

  const unlockSoundAfterGesture = useCallback(() => {
    setSoundUnlocked(true);
    if (!autoplayMuted && !muted) return;
    setAutoplayMuted(false);
    setMuted(false);
  }, [autoplayMuted, muted]);

  const openEditor = useCallback((song: FeedSong) => {
    setEditingSong(song);
    setHookStart(song.clip.hook_start_seconds);
    setHookEnd(song.clip.hook_end_seconds);
    setVideoUrl(song.clip.video_url);
    setVideoFile(null);
    setCoverUrl(song.clip.cover_url);
    setCoverFile(null);
    setSaveError('');
  }, []);

  const saveClip = async () => {
    if (!editingSong) return;
    const durationLimit = editingSong.duration && editingSong.duration > 0 ? editingSong.duration : null;
    const normalizedStart = Math.max(
      0,
      durationLimit ? Math.min(Number(hookStart) || 0, Math.max(0, durationLimit - 0.25)) : Number(hookStart) || 0,
    );
    const normalizedEnd = durationLimit
      ? Math.min(Math.max(Number(hookEnd) || 0, normalizedStart + 1), durationLimit)
      : Math.max(Number(hookEnd) || 0, normalizedStart + 1);

    if (normalizedEnd <= normalizedStart) {
      setSaveError(t('feed.errors.hookEnd'));
      return;
    }
    if (durationLimit && normalizedEnd > durationLimit) {
      setSaveError(t('feed.errors.songLength', { duration: editingSong.duration }));
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      let nextVideoUrl = videoUrl;
      if (videoFile) {
        const ext = videoFile.name.split('.').pop();
        const path = `feed/${editingSong.id}/${Date.now()}_video.${ext}`;
        const { error: uploadError } = await supabase.storage.from('covers').upload(path, videoFile);
        if (uploadError) throw uploadError;
        nextVideoUrl = supabase.storage.from('covers').getPublicUrl(path).data.publicUrl;
      }

      let nextCoverUrl = coverUrl;
      if (coverFile) {
        const ext = coverFile.name.split('.').pop();
        const path = `feed/${editingSong.id}/${Date.now()}_cover.${ext}`;
        const { error: uploadError } = await supabase.storage.from('covers').upload(path, coverFile);
        if (uploadError) throw uploadError;
        nextCoverUrl = supabase.storage.from('covers').getPublicUrl(path).data.publicUrl;
      }

      const nextClip: FeedClip = {
        song_id: editingSong.id,
        video_url: nextVideoUrl,
        cover_url: nextCoverUrl,
        hook_start_seconds: normalizedStart,
        hook_end_seconds: normalizedEnd,
      };
      const { error } = await supabase.from('song_feed_clips').upsert({
        ...nextClip,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      setSongs((currentSongs) => currentSongs.map((song) => (
        song.id === editingSong.id ? { ...song, clip: nextClip } : song
      )));
      setEditingSong(null);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const modeOptions: Array<{ id: FeedMode; label: string; icon: typeof Sparkles }> = [
    { id: 'for-you', label: t('feed.modes.forYou'), icon: Sparkles },
    { id: 'following', label: t('feed.modes.following'), icon: Users },
    { id: 'explore', label: t('feed.modes.explore'), icon: Compass },
  ];

  const activeSong = displayedSongs[activeIndex];

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-[#050505]">
      <Link href="/" className="absolute left-4 top-4 z-40 rounded-full bg-black/35 px-3 py-2 text-xs font-black uppercase tracking-[0.22em] text-white/85 backdrop-blur-md transition-colors hover:text-white">
        Yoriax
      </Link>

      <div className="absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/35 p-1 backdrop-blur-md">
        {modeOptions.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => changeMode(id)}
            className={`rounded-full px-3 py-2 text-xs font-black transition-colors sm:px-4 sm:text-sm ${mode === id ? 'bg-white text-black' : 'text-white/65 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'explore' && availableGenres.length > 0 ? (
        <div className="absolute left-0 right-0 top-[4.5rem] z-40 flex items-center justify-center">
          <div className="flex max-w-full items-center gap-2 overflow-x-auto px-4 pb-2 no-scrollbar">
            {availableGenres.map((genre) => {
              const isActive = !inactiveGenres.has(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    setInactiveGenres((prev) => {
                      const next = new Set(prev);
                      if (isActive) next.add(genre);
                      else next.delete(genre);
                      return next;
                    });
                    setActiveIndex(0);
                    scrollerRef.current?.scrollTo({ top: 0 });
                  }}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-white text-black'
                      : 'border border-white/10 bg-black/40 text-white/60 hover:bg-black/60 hover:text-white'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <button type="button" onClick={() => setActionError('')} className="absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-full border border-red-400/20 bg-red-500/15 px-4 py-2 text-xs font-bold text-red-100 backdrop-blur-md">
          {actionError}
        </button>
      ) : null}

      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
        </div>
      ) : displayedSongs.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <Users className="h-12 w-12 text-white/25" />
          <h1 className="text-2xl font-black text-white">{mode === 'following' ? t('feed.empty.followingTitle') : t('feed.empty.songsTitle')}</h1>
          <p className="max-w-sm text-sm text-white/50">{mode === 'following' ? t('feed.empty.followingDesc') : t('feed.empty.songsDesc')}</p>
          {mode === 'following' ? (
            <button type="button" onClick={() => changeMode('explore')} className="mt-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black">
              {t('feed.empty.discoverButton')}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div ref={scrollerRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth no-scrollbar">
            {displayedSongs.map((song, index) => {
              const artist = song.artist_name || song.creatorName || 'Creator';
              return (
                <div
                  key={song.id}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  data-index={index}
                  className="h-full snap-start snap-always"
                >
                  <FeedCard
                    song={song}
                    active={index === activeIndex}
                    muted={muted}
                    soundUnlocked={soundUnlocked}
                    liked={likedSongIds.has(song.id)}
                    following={followedArtists.has(artist)}
                    isAdmin={isAdmin}
                    onAutoplayBlocked={handleAutoplayBlocked}
                    onEdit={() => openEditor(song)}
                    onFollow={() => toggleFollow(song)}
                    onLike={(forceLike) => toggleLike(song, forceLike)}
                    onListen={() => listenToFullSong(song, index)}
                    onShare={() => shareSong(song)}
                    onToggleMute={() => {
                      setAutoplayMuted(false);
                      if (muted) setSoundUnlocked(true);
                      setMuted((currentMuted) => !currentMuted);
                    }}
                    onUserInteraction={unlockSoundAfterGesture}
                  />
                </div>
              );
            })}
          </div>

          <div className="absolute left-4 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-3 md:left-auto md:right-5">
            <button type="button" onClick={() => scrollToIndex(activeIndex - 1)} disabled={activeIndex === 0} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-25" aria-label={t('feed.nav.prev')}>
              <ChevronUp className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => scrollToIndex(activeIndex + 1)} disabled={activeIndex === displayedSongs.length - 1} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-25" aria-label={t('feed.nav.next')}>
              <ChevronDown className="h-6 w-6" />
            </button>
          </div>

          {isAdmin && (
            <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-bold text-white/60 backdrop-blur-md">
              {activeIndex + 1} / {displayedSongs.length}
            </div>
          )}
        </>
      )}

      {editingSong ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setEditingSong(null)}>
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#181818] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">{t('feed.admin.eyebrow')}</p>
                <h2 className="mt-1 text-2xl font-black text-white">{editingSong.title}</h2>
              </div>
              <button type="button" onClick={() => setEditingSong(null)} className="text-white/45 transition-colors hover:text-white" aria-label={t('feed.admin.close')}>
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs font-bold uppercase tracking-wider text-white/55">
                {t('feed.admin.startSec')}
                <input type="number" min="0" max={editingSong.duration || undefined} value={hookStart} onChange={(event) => setHookStart(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-violet-400/70" />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider text-white/55">
                {t('feed.admin.endSec')}
                <input type="number" min="1" max={editingSong.duration || undefined} value={hookEnd} onChange={(event) => setHookEnd(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-violet-400/70" />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{t('feed.admin.optVideoTitle')}</p>
                    <p className="mt-1 text-xs text-white/45">{t('feed.admin.optVideoDesc')}</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-black transition-transform hover:scale-105">
                    <Upload className="h-4 w-4" />
                    {t('feed.admin.chooseVideo')}
                    <input type="file" accept="video/*" className="hidden" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} />
                  </label>
                </div>
                {videoFile ? <p className="truncate text-xs text-violet-300">{videoFile.name}</p> : null}
                {videoUrl && !videoFile ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                    <span className="truncate text-xs text-white/55">{t('feed.admin.videoSet')}</span>
                    <button type="button" onClick={() => setVideoUrl(null)} className="text-xs font-bold text-red-300 transition-colors hover:text-red-200">
                      {t('feed.admin.remove')}
                    </button>
                  </div>
                ) : null}

                <div className="h-px bg-white/10" />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{t('feed.admin.optCoverTitle')}</p>
                    <p className="mt-1 text-xs text-white/45">{t('feed.admin.optCoverDesc')}</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-black transition-transform hover:scale-105">
                    <Upload className="h-4 w-4" />
                    {t('feed.admin.chooseCover')}
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
                  </label>
                </div>
                {coverFile ? <p className="truncate text-xs text-violet-300">{coverFile.name}</p> : null}
                {coverUrl && !coverFile ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                    <span className="truncate text-xs text-white/55">{t('feed.admin.coverSet')}</span>
                    <button type="button" onClick={() => setCoverUrl(null)} className="text-xs font-bold text-red-300 transition-colors hover:text-red-200">
                      {t('feed.admin.remove')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {saveError ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{saveError}</p> : null}

            <button type="button" onClick={saveClip} disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-violet-400 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('feed.admin.saveHook')}
            </button>
          </div>
        </div>
      ) : null}

      {!loading && activeSong ? <span className="sr-only">{t('feed.currentHook', { title: activeSong.title })}</span> : null}
    </div>
  );
}
