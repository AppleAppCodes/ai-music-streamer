'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Music2,
  Play,
  Save,
  Settings2,
  Share2,
  Upload,
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

type FeedSongRecord = Song & {
  song_feed_clips?: FeedClip | FeedClip[] | null;
};

type FeedSong = Song & {
  clip: FeedClip;
};

interface FeedCardProps {
  song: FeedSong;
  active: boolean;
  muted: boolean;
  isAdmin: boolean;
  onListen: () => void;
  onEdit: () => void;
  onToggleMute: () => void;
}

const DEFAULT_HOOK_DURATION_SECONDS = 20;

function getClip(record: FeedSongRecord): FeedClip {
  const relation = Array.isArray(record.song_feed_clips)
    ? record.song_feed_clips[0]
    : record.song_feed_clips;

  const fallbackEnd = Math.max(1, Math.min(record.duration || DEFAULT_HOOK_DURATION_SECONDS, DEFAULT_HOOK_DURATION_SECONDS));

  return relation || {
    song_id: record.id,
    video_url: null,
    hook_start_seconds: 0,
    hook_end_seconds: fallbackEnd,
  };
}

function FeedCard({ song, active, muted, isAdmin, onListen, onEdit, onToggleMute }: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRef = song.clip.video_url ? videoRef : audioRef;
  const displayArtist = song.artist_name || song.creatorName || 'Creator';

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    media.muted = muted;
    if (!active) {
      media.pause();
      return;
    }

    const startAtHook = () => {
      if (Number.isFinite(media.duration) && media.duration > 0) {
        media.currentTime = Math.min(song.clip.hook_start_seconds, Math.max(0, media.duration - 0.2));
      }
      media.play().catch(() => {
        // Browsers may require one explicit interaction before playing sound.
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
  }, [active, mediaRef, muted, song.clip.hook_start_seconds]);

  const keepInsideHook = () => {
    const media = mediaRef.current;
    if (!media) return;

    const end = Math.min(song.clip.hook_end_seconds, Number.isFinite(media.duration) ? media.duration : song.clip.hook_end_seconds);
    if (media.currentTime >= end) {
      media.currentTime = song.clip.hook_start_seconds;
      media.play().catch(() => {});
    }
  };

  return (
    <article className="relative flex h-full w-full snap-start snap-always items-center justify-center px-2 py-3 sm:px-4 md:py-5">
      <div className="relative h-full max-h-[calc(100dvh-9rem)] w-full max-w-[430px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111] shadow-2xl shadow-black/50">
        <div className="absolute inset-0">
          <img src={song.cover_url} alt="" className="h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
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

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/90" />

        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/70"
            aria-label={muted ? 'Ton einschalten' : 'Ton ausschalten'}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/70"
              aria-label={`${song.title} Feed-Hook bearbeiten`}
            >
              <Settings2 className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-violet-300">
            <Music2 className="h-4 w-4" />
            Yoriax Hook
          </div>
          <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className="text-sm font-bold text-white/70 transition-colors hover:text-white hover:underline">
            {displayArtist}
          </Link>
          <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-white">{song.title}</h1>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/65">
            {song.description || `${song.genre || 'AI Music'} auf YORIAX entdecken.`}
          </p>
          <button
            type="button"
            onClick={onListen}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black transition-transform hover:scale-[1.02]"
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
  const { playSong, setQueue } = usePlayer();
  const [songs, setSongs] = useState<FeedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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
    const loadFeed = async () => {
      setLoading(true);
      const [{ data: songData, error }, { data: sessionData }] = await Promise.all([
        supabase
          .from('songs')
          .select('*, song_feed_clips(song_id, video_url, hook_start_seconds, hook_end_seconds)')
          .order('plays', { ascending: false })
          .limit(60),
        supabase.auth.getSession(),
      ]);

      if (error) {
        console.error('Failed to load feed:', error);
      }

      const feedSongs = ((songData || []) as FeedSongRecord[]).map((song) => ({
        ...song,
        clip: getClip(song),
      }));

      setSongs(feedSongs);
      setIsAdmin(isAdminUser(sessionData.session?.user));
      setLoading(false);
    };

    loadFeed();
  }, [supabase]);

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
  }, [songs]);

  const scrollToIndex = useCallback((index: number) => {
    const targetIndex = Math.max(0, Math.min(songs.length - 1, index));
    itemRefs.current[targetIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [songs.length]);

  useEffect(() => {
    const handleArrowNavigation = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
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

  const listenToFullSong = (song: FeedSong, index: number) => {
    const queue = songs.map((queueSong): Song => ({
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

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-7rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-7rem)] flex-col items-center justify-center gap-3 px-6 text-center">
        <Music2 className="h-12 w-12 text-white/25" />
        <h1 className="text-2xl font-black text-white">Noch keine Songs im Feed</h1>
        <p className="max-w-sm text-sm text-white/50">Sobald Songs veröffentlicht wurden, erscheinen ihre Hooks hier automatisch.</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] overflow-hidden bg-[#050505] md:h-[calc(100dvh-10rem)]">
      <div
        ref={scrollerRef}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth no-scrollbar"
      >
        {songs.map((song, index) => (
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
              isAdmin={isAdmin}
              onListen={() => listenToFullSong(song, index)}
              onEdit={() => openEditor(song)}
              onToggleMute={() => setMuted((currentMuted) => !currentMuted)}
            />
          </div>
        ))}
      </div>

      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        <button
          type="button"
          onClick={() => scrollToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-25"
          aria-label="Vorheriger Hook"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={() => scrollToIndex(activeIndex + 1)}
          disabled={activeIndex === songs.length - 1}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-25"
          aria-label="Nächster Hook"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
      </div>

      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-bold text-white/60 backdrop-blur-md">
        {activeIndex + 1} / {songs.length}
      </div>

      <button
        type="button"
        onClick={() => shareSong(songs[activeIndex])}
        className="absolute bottom-5 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/80 backdrop-blur-md transition-colors hover:bg-black/70 hover:text-white"
        aria-label="Song teilen"
      >
        <Share2 className="h-5 w-5" />
      </button>

      {editingSong ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setEditingSong(null)}>
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#181818] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">Feed Hook bearbeiten</p>
                <h2 className="mt-1 text-2xl font-black text-white">{editingSong.title}</h2>
              </div>
              <button type="button" onClick={() => setEditingSong(null)} className="text-white/45 transition-colors hover:text-white" aria-label="Editor schließen">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs font-bold uppercase tracking-wider text-white/55">
                Start in Sekunden
                <input
                  type="number"
                  min="0"
                  max={editingSong.duration || undefined}
                  value={hookStart}
                  onChange={(event) => setHookStart(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-violet-400/70"
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider text-white/55">
                Ende in Sekunden
                <input
                  type="number"
                  min="1"
                  max={editingSong.duration || undefined}
                  value={hookEnd}
                  onChange={(event) => setHookEnd(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-violet-400/70"
                />
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
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
                  />
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

            <button
              type="button"
              onClick={saveClip}
              disabled={saving}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Hook speichern
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
