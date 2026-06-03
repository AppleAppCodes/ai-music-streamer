'use client';

import { FormEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Heart,
  Loader2,
  MessageCircle,
  Music2,
  Play,
  Plus,
  Save,
  Send,
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

interface FeedClip {
  song_id: string;
  video_url: string | null;
  hook_start_seconds: number;
  hook_end_seconds: number;
}

interface FeedStats {
  song_id: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
}

interface FeedProfile {
  username?: string | null;
  avatar_url?: string | null;
}

interface FeedComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: FeedProfile | FeedProfile[] | null;
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
type StatsKey = 'likes_count' | 'comments_count' | 'saves_count';

interface FeedCardProps {
  song: FeedSong;
  active: boolean;
  muted: boolean;
  liked: boolean;
  saved: boolean;
  following: boolean;
  isAdmin: boolean;
  onAutoplayBlocked: () => void;
  onComment: () => void;
  onEdit: () => void;
  onFollow: () => void;
  onLike: (forceLike?: boolean) => void;
  onListen: () => void;
  onSave: () => void;
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

  return relation || {
    song_id: record.id,
    video_url: null,
    hook_start_seconds: 0,
    hook_end_seconds: fallbackEnd,
  };
}

function getStats(record: FeedSongRecord): FeedStats {
  return getSingleRelation(record.song_feed_stats) || {
    song_id: record.id,
    likes_count: 0,
    comments_count: 0,
    saves_count: 0,
  };
}

function getCommentProfile(comment: FeedComment): FeedProfile | null {
  return getSingleRelation(comment.profiles);
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

function FeedCard({
  song,
  active,
  muted,
  liked,
  saved,
  following,
  isAdmin,
  onAutoplayBlocked,
  onComment,
  onEdit,
  onFollow,
  onLike,
  onListen,
  onSave,
  onShare,
  onToggleMute,
  onUserInteraction,
}: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastTapRef = useRef(0);
  const heartTimerRef = useRef<number | null>(null);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const mediaRef = song.clip.video_url ? videoRef : audioRef;
  const displayArtist = song.artist_name || song.creatorName || 'Creator';
  const avatarUrl = song.profiles?.avatar_url;

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    media.muted = muted;
    if (!active) {
      media.pause();
      return;
    }

    const startAtHook = () => {
      const duration = Number.isFinite(media.duration) ? media.duration : song.clip.hook_end_seconds;
      const maxStart = Math.max(0, duration - 0.2);
      if (media.currentTime < song.clip.hook_start_seconds || media.currentTime >= song.clip.hook_end_seconds) {
        media.currentTime = Math.min(song.clip.hook_start_seconds, maxStart);
      }
      media.play().catch(() => {
        if (!muted) {
          media.muted = false;
          onAutoplayBlocked();
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
  }, [active, mediaRef, muted, onAutoplayBlocked, song.clip.hook_end_seconds, song.clip.hook_start_seconds]);

  useEffect(() => () => {
    if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
  }, []);

  const keepInsideHook = () => {
    const media = mediaRef.current;
    if (!media) return;

    const end = Math.min(song.clip.hook_end_seconds, Number.isFinite(media.duration) ? media.duration : song.clip.hook_end_seconds);
    if (media.currentTime >= end) {
      media.currentTime = song.clip.hook_start_seconds;
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
      media.play().catch(() => {});
    }
    onUserInteraction();
  };

  const toggleMute = () => {
    const media = mediaRef.current;
    if (media) {
      media.muted = !muted;
      if (muted) media.play().catch(() => {});
    }
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
          <img src={song.cover_url} alt="" className="h-full w-full scale-110 object-cover opacity-45 blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/90" />
        </div>

        {song.clip.video_url ? (
          <video
            ref={videoRef}
            src={song.clip.video_url}
            poster={song.cover_url}
            playsInline
            loop={false}
            preload={active ? 'auto' : 'metadata'}
            onTimeUpdate={keepInsideHook}
            className="relative h-full w-full object-cover"
          />
        ) : (
          <>
            <img src={song.cover_url} alt={song.title} className="relative h-full w-full object-cover" />
            <audio
              ref={audioRef}
              src={song.audio_url}
              preload={active ? 'auto' : 'metadata'}
              onTimeUpdate={keepInsideHook}
            />
          </>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/90" />

        {showHeartBurst ? (
          <Heart className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-28 w-28 -translate-x-1/2 -translate-y-1/2 animate-pulse fill-rose-500 text-rose-500 drop-shadow-[0_0_35px_rgba(244,63,94,0.75)]" />
        ) : null}

        {isAdmin ? (
          <button
            type="button"
            onClick={onEdit}
            className="absolute left-4 top-20 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/70"
            aria-label={`${song.title} Feed-Hook bearbeiten`}
          >
            <Settings2 className="h-5 w-5" />
          </button>
        ) : null}

        <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-4 text-white">
          <button type="button" onClick={onFollow} className="group relative" aria-label={following ? `${displayArtist} nicht mehr folgen` : `${displayArtist} folgen`}>
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-violet-950 text-sm font-black shadow-lg">
              {avatarUrl ? <img src={avatarUrl} alt={displayArtist} className="h-full w-full object-cover" /> : displayArtist.slice(0, 1).toUpperCase()}
            </span>
            <span className={`absolute -bottom-2 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-[#111] ${following ? 'bg-white text-black' : 'bg-rose-500 text-white'}`}>
              {following ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" strokeWidth={4} />}
            </span>
          </button>

          <button type="button" onClick={() => onLike()} className="flex flex-col items-center gap-1" aria-label={liked ? `${song.title} nicht mehr liken` : `${song.title} liken`}>
            <Heart className={`h-8 w-8 drop-shadow-lg transition-transform active:scale-75 ${liked ? 'fill-rose-500 text-rose-500' : 'fill-black/20 text-white'}`} strokeWidth={2.3} />
            <span className="text-[11px] font-bold">{formatCount(song.stats.likes_count)}</span>
          </button>

          <button type="button" onClick={onComment} className="flex flex-col items-center gap-1" aria-label={`Kommentare zu ${song.title}`}>
            <MessageCircle className="h-8 w-8 fill-black/20 text-white drop-shadow-lg" strokeWidth={2.3} />
            <span className="text-[11px] font-bold">{formatCount(song.stats.comments_count)}</span>
          </button>

          <button type="button" onClick={onSave} className="flex flex-col items-center gap-1" aria-label={saved ? `${song.title} nicht mehr speichern` : `${song.title} speichern`}>
            <Bookmark className={`h-8 w-8 drop-shadow-lg transition-transform active:scale-75 ${saved ? 'fill-amber-300 text-amber-300' : 'fill-black/20 text-white'}`} strokeWidth={2.3} />
            <span className="text-[11px] font-bold">{formatCount(song.stats.saves_count)}</span>
          </button>

          <button type="button" onClick={onShare} className="flex flex-col items-center gap-1" aria-label={`${song.title} teilen`}>
            <Share2 className="h-8 w-8 fill-black/20 text-white drop-shadow-lg" strokeWidth={2.3} />
            <span className="text-[11px] font-bold">Teilen</span>
          </button>

          <button type="button" onClick={toggleMute} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-md" aria-label={muted ? 'Ton einschalten' : 'Ton ausschalten'}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 p-5 pr-20">
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-violet-300">
            <Music2 className="h-4 w-4" />
            Yoriax Hook
          </div>
          <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className="text-sm font-bold text-white/80 transition-colors hover:text-white hover:underline">
            @{displayArtist}
          </Link>
          <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-white">{song.title}</h1>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/70">
            {song.description || `${song.genre || 'AI Music'} auf YORIAX entdecken.`}
          </p>
          <button
            type="button"
            onClick={onListen}
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black transition-transform hover:scale-[1.02]"
          >
            <Play className="h-4 w-4 fill-current" />
            Ganzen Song hören
          </button>
        </div>
      </div>
    </article>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const { pausePlayback, playSong, setQueue } = usePlayer();
  const [songs, setSongs] = useState<FeedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<FeedMode>('for-you');
  const [muted, setMuted] = useState(false);
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const [soundHint, setSoundHint] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState('Du');
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(new Set());
  const [savedSongIds, setSavedSongIds] = useState<Set<string>>(new Set());
  const [followedArtists, setFollowedArtists] = useState<Set<string>>(new Set());
  const [commentsSong, setCommentsSong] = useState<FeedSong | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [editingSong, setEditingSong] = useState<FeedSong | null>(null);
  const [hookStart, setHookStart] = useState(0);
  const [hookEnd, setHookEnd] = useState(DEFAULT_HOOK_DURATION_SECONDS);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const supabase = createClient();

  useEffect(() => {
    pausePlayback();
  }, [pausePlayback]);

  useEffect(() => {
    const loadFeed = async () => {
      setLoading(true);
      const [{ data: songData, error }, { data: sessionData }] = await Promise.all([
        supabase
          .from('songs')
          .select('*, profiles!songs_creator_id_fkey(username, avatar_url), song_feed_clips(song_id, video_url, hook_start_seconds, hook_end_seconds), song_feed_stats(song_id, likes_count, comments_count, saves_count)')
          .order('plays', { ascending: false })
          .limit(80),
        supabase.auth.getSession(),
      ]);

      if (error) console.error('Failed to load feed:', error);

      const feedSongs = ((songData || []) as FeedSongRecord[]).map((song) => ({
        ...song,
        clip: getClip(song),
        stats: getStats(song),
      }));

      const session = sessionData.session;
      setSongs(feedSongs);
      setIsAdmin(isAdminUser(session?.user));
      setUserId(session?.user.id || null);
      setUserLabel(session?.user.user_metadata?.username || session?.user.email?.split('@')[0] || 'Du');

      if (session) {
        const [{ data: likes }, { data: saves }, { data: follows }] = await Promise.all([
          supabase.from('liked_songs').select('song_id').eq('user_id', session.user.id),
          supabase.from('feed_saves').select('song_id').eq('user_id', session.user.id),
          supabase.from('follows').select('artist_name').eq('user_id', session.user.id),
        ]);
        setLikedSongIds(new Set((likes || []).map((item) => item.song_id)));
        setSavedSongIds(new Set((saves || []).map((item) => item.song_id)));
        setFollowedArtists(new Set((follows || []).map((item) => item.artist_name)));
      }

      setLoading(false);
    };

    loadFeed();
  }, [supabase]);

  const likedGenres = useMemo(() => new Set(
    songs.filter((song) => likedSongIds.has(song.id)).map((song) => song.genre).filter(Boolean),
  ), [likedSongIds, songs]);

  const displayedSongs = useMemo(() => {
    if (mode === 'following') {
      return songs.filter((song) => followedArtists.has(song.artist_name || song.creatorName || 'Creator'));
    }

    if (mode === 'explore') {
      return [...songs].sort((first, second) => stableHash(first.id) - stableHash(second.id));
    }

    return songs
      .filter((song) => song.genre?.trim().toLowerCase() !== 'chillhop')
      .sort((first, second) => {
      const getScore = (song: FeedSong) => (
        Math.log10(Math.max(1, song.plays + 1)) * 12
        + song.stats.likes_count * 5
        + song.stats.saves_count * 3
        + song.stats.comments_count * 2
        + (likedGenres.has(song.genre) ? 18 : 0)
        + (followedArtists.has(song.artist_name || song.creatorName || 'Creator') ? 22 : 0)
      );
      return getScore(second) - getScore(first);
      });
  }, [followedArtists, likedGenres, mode, songs]);

  const changeMode = (nextMode: FeedMode) => {
    itemRefs.current = [];
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ top: 0 });
    setMode(nextMode);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (Number.isInteger(index)) setActiveIndex(index);
          }
        }
      },
      { root: scrollerRef.current, threshold: [0.65] },
    );

    itemRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [displayedSongs]);

  const scrollToIndex = useCallback((index: number) => {
    const targetIndex = Math.max(0, Math.min(displayedSongs.length - 1, index));
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

  const updateSongStats = (songId: string, key: StatsKey, delta: number) => {
    setSongs((currentSongs) => currentSongs.map((song) => (
      song.id === songId
        ? { ...song, stats: { ...song.stats, [key]: Math.max(0, song.stats[key] + delta) } }
        : song
    )));
  };

  const requireLogin = () => {
    if (userId) return true;
    router.push('/login');
    return false;
  };

  const toggleLike = async (song: FeedSong, forceLike = false) => {
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

    const { error } = nextLiked
      ? await supabase.from('liked_songs').insert({ user_id: userId, song_id: song.id })
      : await supabase.from('liked_songs').delete().eq('user_id', userId).eq('song_id', song.id);

    if (error) {
      setActionError('Like konnte nicht gespeichert werden.');
      setLikedSongIds((currentIds) => {
        const nextIds = new Set(currentIds);
        if (currentlyLiked) nextIds.add(song.id);
        else nextIds.delete(song.id);
        return nextIds;
      });
      updateSongStats(song.id, 'likes_count', nextLiked ? -1 : 1);
    }
  };

  const toggleSave = async (song: FeedSong) => {
    if (!requireLogin()) return;
    const currentlySaved = savedSongIds.has(song.id);
    const nextSaved = !currentlySaved;

    setSavedSongIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextSaved) nextIds.add(song.id);
      else nextIds.delete(song.id);
      return nextIds;
    });
    updateSongStats(song.id, 'saves_count', nextSaved ? 1 : -1);

    const { error } = nextSaved
      ? await supabase.from('feed_saves').insert({ user_id: userId, song_id: song.id })
      : await supabase.from('feed_saves').delete().eq('user_id', userId).eq('song_id', song.id);

    if (error) {
      setActionError('Speichern ist fehlgeschlagen.');
      setSavedSongIds((currentIds) => {
        const nextIds = new Set(currentIds);
        if (currentlySaved) nextIds.add(song.id);
        else nextIds.delete(song.id);
        return nextIds;
      });
      updateSongStats(song.id, 'saves_count', nextSaved ? -1 : 1);
    }
  };

  const toggleFollow = async (song: FeedSong) => {
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
      setActionError('Folgen ist fehlgeschlagen.');
      setFollowedArtists((currentArtists) => {
        const nextArtists = new Set(currentArtists);
        if (currentlyFollowing) nextArtists.add(artist);
        else nextArtists.delete(artist);
        return nextArtists;
      });
    }
  };

  const openComments = async (song: FeedSong) => {
    setCommentsSong(song);
    setCommentsLoading(true);
    setComments([]);
    const { data, error } = await supabase
      .from('feed_comments')
      .select('id, user_id, body, created_at, profiles!feed_comments_user_id_fkey(username, avatar_url)')
      .eq('song_id', song.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) setActionError('Kommentare konnten nicht geladen werden.');
    setComments((data || []) as FeedComment[]);
    setCommentsLoading(false);
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentsSong || !requireLogin()) return;
    const body = commentText.trim();
    if (!body) return;

    setCommentSending(true);
    const { data, error } = await supabase
      .from('feed_comments')
      .insert({ user_id: userId, song_id: commentsSong.id, body })
      .select('id, user_id, body, created_at')
      .single();
    setCommentSending(false);

    if (error) {
      setActionError('Kommentar konnte nicht veröffentlicht werden.');
      return;
    }

    setComments((currentComments) => [{ ...data, profiles: { username: userLabel } }, ...currentComments]);
    setCommentText('');
    updateSongStats(commentsSong.id, 'comments_count', 1);
  };

  const listenToFullSong = (song: FeedSong, index: number) => {
    const queue = displayedSongs.map((queueSong): Song => ({
      ...queueSong,
      creatorName: queueSong.artist_name || 'Creator',
    }));
    setQueue(queue, index);
    playSong({ ...song, creatorName: song.artist_name || 'Creator' });
    router.push(`/song/${song.id}`);
  };

  const shareSong = async (song: FeedSong) => {
    const url = `${window.location.origin}/song/${song.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: song.title, text: `${song.title} auf YORIAX`, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Closing the native share sheet is not an error the UI needs to surface.
    }
  };

  const handleAutoplayBlocked = useCallback(() => {
    setMuted(false);
    setAutoplayMuted(true);
    setSoundHint('Tippe auf den Hook, um den Ton zu starten.');
    window.setTimeout(() => setSoundHint(''), 3500);
  }, []);

  const unlockSoundAfterGesture = useCallback(() => {
    if (!autoplayMuted) return;
    setAutoplayMuted(false);
    setMuted(false);
    setSoundHint('');
  }, [autoplayMuted]);

  const openEditor = (song: FeedSong) => {
    setEditingSong(song);
    setHookStart(song.clip.hook_start_seconds);
    setHookEnd(song.clip.hook_end_seconds);
    setVideoUrl(song.clip.video_url);
    setVideoFile(null);
    setSaveError('');
  };

  const saveClip = async () => {
    if (!editingSong) return;
    if (hookStart < 0 || hookEnd <= hookStart) {
      setSaveError('Das Hook-Ende muss nach dem Start liegen.');
      return;
    }
    if (editingSong.duration && hookEnd > editingSong.duration) {
      setSaveError(`Der Song ist nur ${editingSong.duration} Sekunden lang.`);
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      let nextVideoUrl = videoUrl;
      if (videoFile) {
        const ext = videoFile.name.split('.').pop();
        const path = `feed/${editingSong.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('covers').upload(path, videoFile);
        if (uploadError) throw uploadError;
        nextVideoUrl = supabase.storage.from('covers').getPublicUrl(path).data.publicUrl;
      }

      const nextClip: FeedClip = {
        song_id: editingSong.id,
        video_url: nextVideoUrl,
        hook_start_seconds: hookStart,
        hook_end_seconds: hookEnd,
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
    { id: 'for-you', label: 'Für dich', icon: Sparkles },
    { id: 'following', label: 'Gefolgt', icon: Users },
    { id: 'explore', label: 'Entdecken', icon: Compass },
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

      {soundHint ? (
        <div className="absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs font-bold text-white/80 backdrop-blur-md">
          {soundHint}
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
          <h1 className="text-2xl font-black text-white">{mode === 'following' ? 'Noch keine gefolgten Künstler' : 'Noch keine Songs verfügbar'}</h1>
          <p className="max-w-sm text-sm text-white/50">{mode === 'following' ? 'Folge Künstlern über das Plus im Feed. Ihre Hooks erscheinen anschließend hier.' : 'Sobald Songs veröffentlicht wurden, erscheinen ihre Hooks hier automatisch.'}</p>
          {mode === 'following' ? (
            <button type="button" onClick={() => changeMode('explore')} className="mt-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black">
              Künstler entdecken
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
                    liked={likedSongIds.has(song.id)}
                    saved={savedSongIds.has(song.id)}
                    following={followedArtists.has(artist)}
                    isAdmin={isAdmin}
                    onAutoplayBlocked={handleAutoplayBlocked}
                    onComment={() => openComments(song)}
                    onEdit={() => openEditor(song)}
                    onFollow={() => toggleFollow(song)}
                    onLike={(forceLike) => toggleLike(song, forceLike)}
                    onListen={() => listenToFullSong(song, index)}
                    onSave={() => toggleSave(song)}
                    onShare={() => shareSong(song)}
                    onToggleMute={() => {
                      setAutoplayMuted(false);
                      setMuted((currentMuted) => !currentMuted);
                    }}
                    onUserInteraction={unlockSoundAfterGesture}
                  />
                </div>
              );
            })}
          </div>

          <div className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex">
            <button type="button" onClick={() => scrollToIndex(activeIndex - 1)} disabled={activeIndex === 0} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-25" aria-label="Vorheriger Hook">
              <ChevronUp className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => scrollToIndex(activeIndex + 1)} disabled={activeIndex === displayedSongs.length - 1} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-25" aria-label="Nächster Hook">
              <ChevronDown className="h-6 w-6" />
            </button>
          </div>

          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-bold text-white/60 backdrop-blur-md">
            {activeIndex + 1} / {displayedSongs.length}
          </div>
        </>
      )}

      {commentsSong ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-end bg-black/45 md:p-4" onClick={() => setCommentsSong(null)}>
          <section className="flex h-[72dvh] w-full flex-col rounded-t-3xl border border-white/10 bg-[#151515] shadow-2xl md:h-full md:max-w-md md:rounded-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">Kommentare</p>
                <h2 className="mt-1 truncate text-lg font-black text-white">{commentsSong.title}</h2>
              </div>
              <button type="button" onClick={() => setCommentsSong(null)} className="text-white/55 hover:text-white" aria-label="Kommentare schließen">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {commentsLoading ? <Loader2 className="mx-auto mt-8 h-7 w-7 animate-spin text-violet-400" /> : null}
              {!commentsLoading && comments.length === 0 ? <p className="mt-8 text-center text-sm text-white/45">Noch keine Kommentare. Starte die Unterhaltung.</p> : null}
              {comments.map((comment) => {
                const profile = getCommentProfile(comment);
                const username = profile?.username || 'Yoriax User';
                return (
                  <article key={comment.id} className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-900/70 text-xs font-black text-white">
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : username.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white/65">@{username}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-white/90">{comment.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>

            <form onSubmit={submitComment} className="flex gap-2 border-t border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <input value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={500} placeholder="Kommentar hinzufügen..." className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet-400/70" />
              <button type="submit" disabled={commentSending || !commentText.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white transition-colors hover:bg-violet-400 disabled:opacity-35" aria-label="Kommentar veröffentlichen">
                {commentSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {editingSong ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setEditingSong(null)}>
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#181818] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">Für-dich-Hook bearbeiten</p>
                <h2 className="mt-1 text-2xl font-black text-white">{editingSong.title}</h2>
              </div>
              <button type="button" onClick={() => setEditingSong(null)} className="text-white/45 transition-colors hover:text-white" aria-label="Editor schließen">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs font-bold uppercase tracking-wider text-white/55">
                Start in Sekunden
                <input type="number" min="0" max={editingSong.duration || undefined} value={hookStart} onChange={(event) => setHookStart(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-violet-400/70" />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider text-white/55">
                Ende in Sekunden
                <input type="number" min="1" max={editingSong.duration || undefined} value={hookEnd} onChange={(event) => setHookEnd(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-violet-400/70" />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">Optionales 9:16-Video</p>
                  <p className="mt-1 text-xs text-white/45">Ohne Video wird automatisch das Artwork angezeigt.</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-black transition-transform hover:scale-105">
                  <Upload className="h-4 w-4" />
                  Video wählen
                  <input type="file" accept="video/*" className="hidden" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} />
                </label>
              </div>
              {videoFile ? <p className="mt-3 truncate text-xs text-violet-300">{videoFile.name}</p> : null}
              {videoUrl && !videoFile ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                  <span className="truncate text-xs text-white/55">Video hinterlegt</span>
                  <button type="button" onClick={() => setVideoUrl(null)} className="text-xs font-bold text-red-300 transition-colors hover:text-red-200">
                    Entfernen
                  </button>
                </div>
              ) : null}
            </div>

            {saveError ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{saveError}</p> : null}

            <button type="button" onClick={saveClip} disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-violet-400 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Hook speichern
            </button>
          </div>
        </div>
      ) : null}

      {!loading && activeSong ? <span className="sr-only">Aktueller Hook: {activeSong.title}</span> : null}
    </div>
  );
}
