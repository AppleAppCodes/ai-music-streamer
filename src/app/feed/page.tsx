'use client';

import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Heart,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  Share2,
  SlidersHorizontal,
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

function getClip(record: FeedSongRecord, relation?: FeedClip | null): FeedClip {
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

function getStats(record: FeedSongRecord, relation?: FeedStats | null): FeedStats {
  return relation || {
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastTapRef = useRef(0);
  const heartTimerRef = useRef<number | null>(null);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [isMediaPlaying, setIsMediaPlaying] = useState(false);
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
    const media = audioRef.current;
    if (!media) return;

    media.muted = muted;
    if (!active) {
      media.pause();
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
      });
    };

    if (media.readyState >= 1) {
      startAtHook();
    } else {
      media.addEventListener('loadedmetadata', startAtHook, { once: true });
    }

    return () => {
      media.removeEventListener('loadedmetadata', startAtHook);
      media.pause();
    };
  }, [active, muted, onAutoplayBlocked, playFromHook, soundUnlocked]);

  useEffect(() => () => {
    if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
  }, []);

  const keepInsideHook = () => {
    const media = audioRef.current;
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
    const media = audioRef.current;
    if (media) {
      media.muted = false;
      playFromHook(media).catch(() => {});
    }
    onUserInteraction();
  };

  const toggleMute = () => {
    const media = audioRef.current;
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

  const togglePlayback = () => {
    const media = audioRef.current;
    if (!media) return;

    if (media.paused) {
      seekToHookStart(media);
      media.play().catch(() => {});
      onUserInteraction();
      return;
    }

    media.pause();
  };

  return (
    <article className="relative flex h-full w-full snap-start snap-always items-start justify-center overflow-hidden bg-[#050505] px-4 pb-24 sm:px-8 md:pb-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(168,85,247,0.24),transparent_33%),radial-gradient(circle_at_18%_78%,rgba(45,212,191,0.14),transparent_30%),linear-gradient(145deg,#050505_0%,#10081c_48%,#050505_100%)]" />
        <div className="yoriax-feed-orb yoriax-feed-orb--purple" />
        <div className="yoriax-feed-orb yoriax-feed-orb--teal" />
        <div className="absolute left-[-8%] right-[-8%] top-[37%] h-px -rotate-[14deg] bg-violet-400/15" />
        <div className="absolute bottom-[25%] left-[-8%] right-[-8%] h-px rotate-[18deg] bg-teal-300/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.52)_100%)]" />
      </div>

      <div
        className="relative flex h-full w-full max-w-[430px] flex-col items-center justify-start pt-[clamp(7rem,14vh,9rem)]"
        onPointerDown={(event) => {
          if (!(event.target as HTMLElement).closest('button, a, input')) unlockSoundFromGesture();
        }}
        onPointerUp={handlePointerUp}
      >
        <audio
          ref={audioRef}
          src={song.audio_url}
          preload={active ? 'auto' : 'metadata'}
          onTimeUpdate={keepInsideHook}
          onPlay={() => setIsMediaPlaying(true)}
          onPause={() => setIsMediaPlaying(false)}
        />

        <div className="relative z-10 flex w-full flex-col items-center">
          <div className="relative w-[min(82vw,42vh,350px)] max-w-full">
            <div className="absolute -inset-3 rotate-3 rounded-[2rem] border border-violet-400/25 bg-violet-400/[0.025]" />
            <div className="relative aspect-square overflow-hidden rounded-[1.65rem] border border-white/15 bg-[#130b20] shadow-[0_28px_80px_rgba(124,58,237,0.28)]">
              {song.clip.cover_url || song.cover_url ? (
                <Image
                  src={song.clip.cover_url || song.cover_url}
                  alt={song.title}
                  fill
                  sizes="(max-width: 768px) 82vw, 350px"
                  priority={active}
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-950 via-[#160b24] to-black">
                  <Music2 className="h-20 w-20 text-violet-300/45" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
            </div>
            <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-violet-400/35 bg-[#0a0710]/90 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-xl backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]" />
              Yoriax Select
            </div>
          </div>

          <div className="mt-9 w-full px-1 pr-20 text-left sm:pr-24">
            <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className="text-[15px] font-black tracking-wide text-violet-500 transition-colors hover:text-violet-300 hover:underline">
              {displayArtist}
            </Link>
            <h1 className="mt-1 truncate text-[28px] font-black leading-tight tracking-[-0.03em] text-white sm:text-[32px]">{song.title}</h1>
            <button
              type="button"
              onClick={onListen}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black shadow-[0_0_30px_rgba(255,255,255,0.18)] transition-transform hover:scale-[1.02]"
            >
              <Music2 className="h-4 w-4" />
              {t('feed.listenFull')}
            </button>
          </div>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={onEdit}
            className="absolute left-0 top-[clamp(7rem,14vh,9rem)] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-black/35 text-white/80 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t('feed.editHook', { title: song.title })}
          >
            <Settings2 className="h-5 w-5" />
          </button>
        ) : null}

        <div className="absolute right-0 top-[calc(clamp(7rem,14vh,9rem)+min(82vw,42vh,350px)-3.4rem)] z-20 flex flex-col items-center gap-[18px] text-white" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={onFollow} className="group flex flex-col items-center" aria-label={following ? t('feed.unfollow', { artist: displayArtist }) : t('feed.follow', { artist: displayArtist })}>
            <div className="relative flex h-12 w-12 items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-violet-300/40 bg-violet-950 text-sm font-black shadow-[0_0_24px_rgba(124,58,237,0.28)]">
                {avatarUrl ? <Image src={avatarUrl} alt={displayArtist} width={48} height={48} className="h-full w-full object-cover" /> : displayArtist.slice(0, 1).toUpperCase()}
              </span>
              {following ? (
                <span className="absolute -bottom-1.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-violet-300/40 bg-[#160d25] text-violet-300 shadow-lg">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : (
                <span className="absolute -bottom-1.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-[#08050c] bg-rose-500 text-white shadow-lg">
                  <Plus className="h-3 w-3" strokeWidth={3.5} />
                </span>
              )}
            </div>
            <span className="mt-3 block text-[10px] font-bold text-white/85">{following ? t('feed.modes.following') : t('feed.followAction')}</span>
          </button>

          <button type="button" onClick={togglePlayback} className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform active:scale-90" aria-label={isMediaPlaying ? 'Pausieren' : 'Abspielen'}>
            {isMediaPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
          </button>

          <button type="button" onClick={() => onLike()} className="flex flex-col items-center gap-1" aria-label={liked ? t('feed.unlike', { title: song.title }) : t('feed.like', { title: song.title })}>
            <Heart className={`h-8 w-8 drop-shadow-lg transition-transform active:scale-75 ${liked ? 'fill-violet-500 text-violet-400' : 'fill-black/20 text-white'}`} strokeWidth={2.3} />
            <span className="text-[11px] font-bold">{formatCount(song.stats.likes_count)}</span>
          </button>

          <button type="button" onClick={onShare} className="flex flex-col items-center gap-1" aria-label={t('feed.shareAria', { title: song.title })}>
            <Share2 className="h-8 w-8 fill-black/20 text-white drop-shadow-lg" strokeWidth={2.3} />
            <span className="text-[11px] font-bold">{t('feed.shareIcon')}</span>
          </button>

        </div>

        <button type="button" onClick={toggleMute} className="absolute left-0 top-[calc(clamp(7rem,14vh,9rem)+3.5rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur-md" aria-label={muted ? t('feed.unmute') : t('feed.mute')}>
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>

        {showHeartBurst ? (
          <Heart className="pointer-events-none absolute left-1/2 top-[42%] z-30 h-28 w-28 -translate-x-1/2 -translate-y-1/2 animate-pulse fill-violet-500 text-violet-400 drop-shadow-[0_0_35px_rgba(124,58,237,0.75)]" />
        ) : null}
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
  const [genreFilterOpen, setGenreFilterOpen] = useState(false);
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
      const [
        { data: songData, error },
        { data: clipData, error: clipError },
        { data: statsData, error: statsError },
        { data: sessionData },
      ] = await Promise.all([
        supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays, genre, created_at, creator_id, duration, audio_url, profiles!songs_creator_id_fkey(username, avatar_url)')
          .order('plays', { ascending: false })
          .order('created_at', { ascending: false })
          // Load the full catalog so every genre is selectable in EXPLORE (the
          // genre filter is derived from loaded songs) and the feed feels endless.
          .limit(500),
        supabase
          .from('song_feed_clips')
          .select('song_id, video_url, cover_url, hook_start_seconds, hook_end_seconds'),
        supabase
          .from('song_feed_stats')
          .select('song_id, likes_count'),
        supabase.auth.getSession(),
      ]);

      if (error) console.error('Failed to load feed:', error);
      if (clipError) console.error('Failed to load feed clips:', clipError);
      if (statsError) console.error('Failed to load feed stats:', statsError);

      const clipBySongId = new Map(
        ((clipData || []) as FeedClip[]).map((clip) => [clip.song_id, clip]),
      );
      const statsBySongId = new Map(
        ((statsData || []) as FeedStats[]).map((stats) => [stats.song_id, stats]),
      );

      const feedSongs = ((songData || []) as unknown as FeedSongRecord[]).map((song) => ({
        ...song,
        clip: getClip(song, clipBySongId.get(song.id)),
        stats: getStats(song, statsBySongId.get(song.id)),
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
    const filteredSongs = mode === 'explore' && inactiveGenres.size > 0
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
    setGenreFilterOpen(false);
    scrollerRef.current?.scrollTo({ top: 0 });
    setMode(nextMode);
  };

  const resetExplorePosition = useCallback(() => {
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ top: 0 });
  }, []);

  const toggleGenre = useCallback((genre: string) => {
    setInactiveGenres((currentGenres) => {
      const nextGenres = new Set(currentGenres);
      if (nextGenres.has(genre)) nextGenres.delete(genre);
      else nextGenres.add(genre);
      return nextGenres;
    });
    resetExplorePosition();
  }, [resetExplorePosition]);

  const selectAllGenres = useCallback(() => {
    setInactiveGenres(new Set());
    resetExplorePosition();
  }, [resetExplorePosition]);

  const deselectAllGenres = useCallback(() => {
    setInactiveGenres(new Set(availableGenres));
    resetExplorePosition();
  }, [availableGenres, resetExplorePosition]);

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

  const modeOptions: Array<{ id: FeedMode; label: string }> = [
    { id: 'for-you', label: t('feed.modes.forYou') },
    { id: 'following', label: t('feed.modes.following') },
    { id: 'explore', label: t('feed.modes.explore') },
  ];

  const activeSong = displayedSongs[activeIndex];

  return (
    <div className="fixed inset-0 z-[55] overflow-hidden bg-[#050505]">
      <Link href="/" className="absolute left-6 top-6 z-40 hidden text-xs font-black uppercase tracking-[0.24em] text-white/85 transition-colors hover:text-white md:block">
        Yoriax
      </Link>

      <div className="absolute left-1/2 top-[max(1.5rem,env(safe-area-inset-top))] z-40 flex -translate-x-1/2 items-center gap-8 whitespace-nowrap sm:gap-10 md:top-7">
        {modeOptions.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => changeMode(id)}
            className={`text-lg font-black tracking-tight transition-colors sm:text-xl ${mode === id ? 'text-white' : 'text-white/45 hover:text-white/75'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'explore' && availableGenres.length > 0 ? (
        <div className="absolute left-4 top-[4.75rem] z-50 md:left-8 md:top-20">
          <button
            type="button"
            onClick={() => setGenreFilterOpen((open) => !open)}
            className={`flex h-11 items-center gap-2 rounded-full border px-3.5 text-xs font-black backdrop-blur-xl transition-colors ${
              genreFilterOpen || inactiveGenres.size > 0
                ? 'border-violet-400/45 bg-violet-500/20 text-white'
                : 'border-white/12 bg-black/40 text-white/75 hover:bg-white/10 hover:text-white'
            }`}
            aria-expanded={genreFilterOpen}
            aria-controls="explore-genre-filter"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t('feed.filters.genres')}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/75">
              {availableGenres.length - inactiveGenres.size}/{availableGenres.length}
            </span>
          </button>

          {genreFilterOpen ? (
            <div id="explore-genre-filter" className="yoriax-card mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-3xl p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-white">{t('feed.filters.title')}</p>
                  <p className="mt-1 text-xs leading-5 text-white/45">{t('feed.filters.description')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGenreFilterOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={t('feed.filters.close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-4 flex gap-2">
                <button type="button" onClick={selectAllGenres} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-black">
                  {t('feed.filters.selectAll')}
                </button>
                <button type="button" onClick={deselectAllGenres} className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-black text-white/70 hover:bg-white/10 hover:text-white">
                  {t('feed.filters.deselectAll')}
                </button>
              </div>

              <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-1 no-scrollbar">
                {availableGenres.map((genre) => {
                  const isActive = !inactiveGenres.has(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                        isActive
                          ? 'border-violet-400/45 bg-violet-500/20 text-white'
                          : 'border-white/8 bg-black/25 text-white/35 hover:border-white/15 hover:text-white/65'
                      }`}
                      aria-pressed={isActive}
                    >
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${isActive ? 'border-violet-300 bg-violet-400 text-black' : 'border-white/20'}`}>
                        {isActive ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'explore' && inactiveGenres.size > 0 && !genreFilterOpen ? (
        <div className="pointer-events-none absolute left-4 top-[8rem] z-40 rounded-full border border-violet-400/20 bg-black/35 px-3 py-1.5 text-[10px] font-bold text-violet-200 backdrop-blur-md md:left-8 md:top-[8.25rem]">
          {t('feed.filters.active', { count: availableGenres.length - inactiveGenres.size })}
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

          <div className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex">
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
          <div className="yoriax-card w-full max-w-lg rounded-3xl p-6" onClick={(event) => event.stopPropagation()}>
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
