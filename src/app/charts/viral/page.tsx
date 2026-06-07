'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ChevronRight, Flame, Mic2, Pause, Play, TrendingUp, Edit2, Loader2, Trash2 } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { usePlayer } from '@/lib/player-context';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import { isAdminUser, isModUser } from '@/lib/admin';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getErrorMessage } from '@/lib/errors';

interface DailyPlay {
  song_id: string;
  plays: number;
}

interface ArtistChartItem {
  name: string;
  plays: number;
  songsCount: number;
  coverUrl: string;
}

interface ChartPanelProps {
  title: string;
  eyebrow: string;
  description: string;
  accent: 'orange' | 'violet';
  icon: React.ReactNode;
  rankedSongs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  onPlayChart: (songs: Song[]) => void;
  onPlaySong: (songs: Song[], index: number) => void;
  isReorderable?: boolean;
  onReorder?: (songs: Song[]) => void;
}

function ChartPanel({
  title,
  eyebrow,
  description,
  accent,
  icon,
  rankedSongs,
  currentSong,
  isPlaying,
  onPlayChart,
  onPlaySong,
  isReorderable,
  onReorder,
}: ChartPanelProps) {
  const songs = rankedSongs;
  const isChartPlaying = isPlaying && songs.some((song) => song.id === currentSong?.id);
  const accentClasses = accent === 'orange'
    ? {
        border: 'border-orange-400/20',
        glow: 'from-orange-500/20 via-amber-400/5',
        icon: 'bg-orange-400 text-black',
        active: 'text-orange-300',
        bars: 'bg-orange-400',
      }
    : {
        border: 'border-violet-400/20',
        glow: 'from-violet-500/20 via-fuchsia-400/5',
        icon: 'bg-violet-400 text-black',
        active: 'text-violet-300',
        bars: 'bg-violet-400',
      };

  return (
    <section className={`relative min-w-0 overflow-hidden rounded-2xl border ${accentClasses.border} bg-white/[0.035] shadow-2xl shadow-black/20`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-br ${accentClasses.glow} to-transparent`} />
      <div className="relative flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/45">
            {icon}
            {eyebrow}
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2>
          <p className="mt-1 text-xs text-white/50 sm:text-sm">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onPlayChart(songs)}
          disabled={songs.length === 0}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${accentClasses.icon} shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label={`${title} abspielen`}
        >
          {isChartPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
      </div>

      {rankedSongs.length > 0 ? (
        <div className="max-h-[68vh] overflow-y-auto overscroll-contain p-2">
          {isReorderable && onReorder ? (
            <Reorder.Group axis="y" values={songs} onReorder={onReorder} className="flex flex-col">
              {songs.map((song, index) => {
                const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
                const displayArtist = song.artist_name || 'Creator';

                return (
                  <Reorder.Item
                    key={song.id}
                    value={song}
                    onClick={() => onPlaySong(songs, index)}
                    className="group grid cursor-grab active:cursor-grabbing grid-cols-[24px_40px_minmax(0,1fr)_auto_28px] items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.07]"
                  >
                    <div className="flex justify-center text-xs font-bold text-white/45">
                      {isThisSongPlaying ? (
                        <div className="flex h-4 w-4 items-end justify-between">
                          <div className={`h-full w-1 animate-bounce ${accentClasses.bars}`} />
                          <div className={`h-2/3 w-1 animate-bounce ${accentClasses.bars}`} style={{ animationDelay: '150ms' }} />
                          <div className={`h-4/5 w-1 animate-bounce ${accentClasses.bars}`} style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <img src={song.cover_url} alt={song.title} className="h-10 w-10 rounded-md object-cover shadow-md pointer-events-none" />
                    <div className="min-w-0 pointer-events-none">
                      <Link
                        href={`/song/${song.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className={`block truncate text-sm font-bold hover:underline pointer-events-auto ${currentSong?.id === song.id ? accentClasses.active : 'text-white/90'}`}
                      >
                        {song.title}
                      </Link>
                      <Link
                        href={`/artist/${encodeURIComponent(displayArtist)}`}
                        onClick={(event) => event.stopPropagation()}
                        className="block truncate text-xs text-white/45 transition-colors hover:text-white hover:underline pointer-events-auto"
                      >
                        {displayArtist}
                      </Link>
                    </div>
                    <div className="flex items-center justify-end pr-2 text-white/20">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div onClick={(event) => event.stopPropagation()} className="pointer-events-auto">
                      <PlaylistAddButton songId={song.id} iconClassName="h-5 w-5" />
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          ) : (
            songs.map((song, index) => {
              const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
              const displayArtist = song.artist_name || 'Creator';

              return (
                <div
                  key={song.id}
                  onClick={() => onPlaySong(songs, index)}
                  className="group grid cursor-pointer grid-cols-[24px_40px_minmax(0,1fr)_auto_28px] items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.07]"
                >
                  <div className="flex justify-center text-xs font-bold text-white/45">
                    {isThisSongPlaying ? (
                      <div className="flex h-4 w-4 items-end justify-between">
                        <div className={`h-full w-1 animate-bounce ${accentClasses.bars}`} />
                        <div className={`h-2/3 w-1 animate-bounce ${accentClasses.bars}`} style={{ animationDelay: '150ms' }} />
                        <div className={`h-4/5 w-1 animate-bounce ${accentClasses.bars}`} style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <img src={song.cover_url} alt={song.title} className="h-10 w-10 rounded-md object-cover shadow-md" />
                  <div className="min-w-0">
                    <Link
                      href={`/song/${song.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className={`block truncate text-sm font-bold hover:underline ${currentSong?.id === song.id ? accentClasses.active : 'text-white/90'}`}
                    >
                      {song.title}
                    </Link>
                    <Link
                      href={`/artist/${encodeURIComponent(displayArtist)}`}
                      onClick={(event) => event.stopPropagation()}
                      className="block truncate text-xs text-white/45 transition-colors hover:text-white hover:underline"
                    >
                      {displayArtist}
                    </Link>
                  </div>
                  <div className="flex items-center justify-end pr-2 text-white/20">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div onClick={(event) => event.stopPropagation()}>
                    <PlaylistAddButton songId={song.id} iconClassName="h-5 w-5" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-white/45">Für diese Charts sind noch keine Songs vorhanden.</div>
      )}
    </section>
  );
}

function ArtistChartPanel({ rankedArtists }: { rankedArtists: ArtistChartItem[] }) {
  return (
    <section className="relative min-w-0 overflow-hidden rounded-2xl border border-teal-300/20 bg-white/[0.035] shadow-2xl shadow-black/20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-br from-teal-400/20 via-cyan-400/5 to-transparent" />
      <div className="relative border-b border-white/10 p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-teal-200/80">
          <Mic2 className="h-4 w-4" />
          Top 20
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Artist Charts</h2>
        <p className="mt-1 text-xs text-white/50 sm:text-sm">
          Die aktuell angesagtesten Künstler der Community.
        </p>
      </div>

      {rankedArtists.length > 0 ? (
        <div className="max-h-[68vh] overflow-y-auto overscroll-contain p-2">
          {rankedArtists.map((artist, index) => (
            <Link
              key={artist.name}
              href={`/artist/${encodeURIComponent(artist.name)}`}
              className="group grid grid-cols-[24px_40px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.07]"
            >
              <div className="flex justify-center text-xs font-bold text-white/45">
                <span className={index < 3 ? 'text-teal-200' : undefined}>{index + 1}</span>
              </div>
              <img
                src={artist.coverUrl}
                alt={artist.name}
                className="h-10 w-10 rounded-md object-cover shadow-md"
              />
              <div className="min-w-0">
                <div className={`truncate text-sm font-bold ${index < 3 ? 'text-teal-200' : 'text-white/90'}`}>
                  {artist.name}
                </div>
                <div className="truncate text-xs text-white/45">
                  {artist.songsCount} {artist.songsCount === 1 ? 'Song' : 'Songs'}
                </div>
              </div>
              <div className="flex items-center gap-2 text-right">
                <ChevronRight className="h-4 w-4 text-white/25 transition-colors group-hover:text-teal-200" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-white/45">Für diese Charts sind noch keine Künstler vorhanden.</div>
      )}
    </section>
  );
}

export default function ViralChartsPage() {
  const router = useRouter();
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue } = usePlayer();
  const [songs, setSongs] = useState<Song[]>([]);
  const [dailyPlays, setDailyPlays] = useState<DailyPlay[]>([]);
  const [weeklyPlays, setWeeklyPlays] = useState<DailyPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const isAdmin = isModUser(user);
  const [adminViralSongs, setAdminViralSongs] = useState<Song[]>([]);

  useEffect(() => {
    const fetchCharts = async () => {
      setLoading(true);
      const todayUtc = new Date().toISOString().slice(0, 10);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoUtc = sevenDaysAgo.toISOString().slice(0, 10);

      const [
        { data: songsData }, 
        { data: dailyData, error: dailyError }, 
        { data: weeklyData, error: weeklyError },
        { data: authData }
      ] = await Promise.all([
        supabase.from('songs').select('*'),
        supabase.from('song_daily_plays').select('song_id, plays').eq('play_date', todayUtc),
        supabase.from('song_daily_plays').select('song_id, plays').gte('play_date', sevenDaysAgoUtc),
        supabase.auth.getSession(),
      ]);

      setUser(authData.session?.user || null);

      // Fetch background video
      const { data: files } = await supabase.storage.from('covers').list('charts');
      if (files && files.length > 0) {
        const videoFile = files.find(f => f.name.startsWith('background-video'));
        if (videoFile) {
          const { data: urlData } = supabase.storage.from('covers').getPublicUrl(`charts/${videoFile.name}`);
          const cacheKey = new Date(videoFile.updated_at || videoFile.created_at || 0).getTime();
          setVideoUrl(`${urlData.publicUrl}?t=${cacheKey}`);
        }
      }

      if (songsData) setSongs(songsData as Song[]);
      if (dailyData) setDailyPlays(dailyData as DailyPlay[]);
      if (weeklyData) setWeeklyPlays(weeklyData as DailyPlay[]);
      if (dailyError) console.error('Failed to load daily charts:', dailyError);
      if (weeklyError) console.error('Failed to load weekly charts:', weeklyError);
      setLoading(false);
    };

    fetchCharts();
  }, [supabase]);

  const dailyPlayMap = useMemo(
    () => new Map(dailyPlays.map(({ song_id, plays }) => [song_id, plays])),
    [dailyPlays],
  );

  const weeklyPlayMap = useMemo(() => {
    const map = new Map<string, number>();
    weeklyPlays.forEach(({ song_id, plays }) => {
      map.set(song_id, (map.get(song_id) || 0) + plays);
    });
    return map;
  }, [weeklyPlays]);

  const viralSongs = useMemo<Song[]>(
    () => [...songs]
      .sort((a, b) => {
        const orderA = (a as any).viral_sort_order || 999999;
        const orderB = (b as any).viral_sort_order || 999999;
        if (orderA !== orderB) return orderA - orderB;

        const playDifference = (weeklyPlayMap.get(b.id) || 0) - (weeklyPlayMap.get(a.id) || 0);
        return playDifference || b.plays - a.plays;
      })
      .slice(0, 20),
    [weeklyPlayMap, songs],
  );

  useEffect(() => {
    setAdminViralSongs(viralSongs);
  }, [viralSongs]);

  const handleViralReorder = async (newOrder: Song[]) => {
    if (!isAdmin) return;
    setAdminViralSongs(newOrder);

    const orderData = newOrder.map((song, index) => ({
      id: song.id,
      viral_sort_order: index + 1
    }));

    try {
      await supabase.rpc('update_viral_song_order', { order_data: orderData });
      setSongs(prev => prev.map(s => {
        const ranked = orderData.find(o => o.id === s.id);
        if (ranked) return { ...s, viral_sort_order: ranked.viral_sort_order } as Song;
        return s;
      }));
    } catch (err) {
      console.error('Failed to update viral order:', err);
    }
  };

  const dailySongs = useMemo<Song[]>(
    () => [...songs]
      .sort((a, b) => {
        const playDifference = (dailyPlayMap.get(b.id) || 0) - (dailyPlayMap.get(a.id) || 0);
        return playDifference || b.plays - a.plays;
      })
      .slice(0, 50),
    [dailyPlayMap, songs],
  );

  const artistCharts = useMemo<ArtistChartItem[]>(() => {
    const artistMap = new Map<string, ArtistChartItem & { topSongPlays: number }>();

    songs.forEach((song) => {
      const name = song.artist_name || song.creatorName || 'Unbekannt';
      if (name === 'Unbekannt') return;

      if (!artistMap.has(name)) {
        artistMap.set(name, {
          name,
          plays: 0,
          songsCount: 0,
          coverUrl: song.cover_url,
          topSongPlays: song.plays || 0,
        });
      }

      const artist = artistMap.get(name)!;
      artist.plays += song.plays || 0;
      artist.songsCount += 1;

      if ((song.plays || 0) > artist.topSongPlays) {
        artist.coverUrl = song.cover_url || artist.coverUrl;
        artist.topSongPlays = song.plays || 0;
      }
    });

    return Array.from(artistMap.values())
      .sort((a, b) => b.plays - a.plays || b.songsCount - a.songsCount)
      .slice(0, 20)
      .map((artist) => ({
        name: artist.name,
        plays: artist.plays,
        songsCount: artist.songsCount,
        coverUrl: artist.coverUrl,
      }));
  }, [songs]);

  const handlePlayChart = (chartSongs: Song[]) => {
    if (chartSongs.length === 0) return;

    if (isPlaying && chartSongs.some((song) => song.id === currentSong?.id)) {
      togglePlayPause();
      return;
    }

    const queue = chartSongs.map((song): Song => ({ ...song, creatorName: song.artist_name || 'Creator' }));
    const startIndex = Math.max(0, queue.findIndex((song) => song.id === currentSong?.id));
    setQueue(queue, startIndex);
    playSong(queue[startIndex]);
  };

  const handlePlaySong = (chartSongs: Song[], index: number) => {
    const song = chartSongs[index];
    if (!song) return;

    if (currentSong?.id === song.id) {
      togglePlayPause();
      return;
    }

    const queue = chartSongs.map((queueSong): Song => ({ ...queueSong, creatorName: queueSong.artist_name || 'Creator' }));
    setQueue(queue, index);
    playSong(queue[index]);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideo(true);
    const ext = file.name.split('.').pop();
    const path = `charts/background-video.${ext}`;

    try {
      const { error } = await supabase.storage.from('covers').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('covers').getPublicUrl(path);
      setVideoUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch (err: unknown) {
      console.error('Error uploading video:', err);
      alert('Fehler beim Hochladen des Videos: ' + getErrorMessage(err));
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!isAdmin || !videoUrl) return;
    setIsUploadingVideo(true);
    try {
      const { data: files } = await supabase.storage.from('covers').list('charts');
      const videoFile = files?.find(f => f.name.startsWith('background-video'));
      if (videoFile) {
        await supabase.storage.from('covers').remove([`charts/${videoFile.name}`]);
      }
      setVideoUrl(null);
    } catch (err: unknown) {
      console.error('Error removing video:', err);
      alert('Fehler beim Entfernen des Videos: ' + getErrorMessage(err));
    } finally {
      setIsUploadingVideo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-[#0A0A0A]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#080808] px-4 pb-32 pt-16 sm:px-6 md:px-10 md:pt-20">
      {/* Background Gradient Header or Video */}
      <div className="absolute top-0 left-0 right-0 h-[500px] overflow-hidden pointer-events-none z-0">
        {videoUrl ? (
          <video 
            src={videoUrl} 
            autoPlay 
            loop 
            muted 
            playsInline
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full object-cover opacity-40"
            style={{ 
              maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
            }}
          />
        ) : (
          <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-br from-orange-500/10 via-violet-500/5 to-transparent" />
        )}
      </div>

      {/* Admin Editable Overlay */}
      {isAdmin && (
        <div className="group absolute top-6 right-6 md:top-10 md:right-10 z-30">
          {/* A small invisible trigger area to hover over, so the buttons don't block everything unless hovered */}
          <div className="absolute -inset-4 z-10" />
          <div className="relative z-20 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <input 
              type="file" 
              accept="video/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleVideoUpload}
            />
            {videoUrl && (
              <button 
                onClick={handleRemoveVideo}
                disabled={isUploadingVideo}
                className="flex items-center gap-2 bg-red-500/80 hover:bg-red-500 backdrop-blur-md text-white px-4 py-2 rounded-full border border-red-400/50 transition-all text-sm font-medium"
              >
                {isUploadingVideo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Video entfernen
              </button>
            )}
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingVideo}
              className="flex items-center gap-2 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/20 transition-all text-sm font-medium"
            >
              {isUploadingVideo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Edit2 className="w-4 h-4" />
              )}
              {videoUrl ? 'Video ändern' : 'Hintergrundvideo setzen'}
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white md:left-8 md:top-6"
        aria-label="Zurück"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      <div className="relative mx-auto max-w-[1500px]">
        <div className="mb-7 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-primary">
            <TrendingUp className="h-4 w-4" />
            Yoriax Rankings
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Charts</h1>
          <p className="max-w-2xl text-sm text-white/55">
            Entdecke, welche Tracks langfristig viral gehen, welche Songs heute besonders oft gehört werden und welche Artists gerade vorne liegen.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ChartPanel
            title="Viral Charts"
            eyebrow="Neu & Angesagt"
            description="Die neuesten Trends und viralen Hits."
            accent="orange"
            icon={<Flame className="h-4 w-4" />}
            rankedSongs={isAdmin ? adminViralSongs : viralSongs}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlayChart={handlePlayChart}
            onPlaySong={handlePlaySong}
            isReorderable={isAdmin}
            onReorder={handleViralReorder}
          />
          <ChartPanel
            title="Daily Charts"
            eyebrow="Top 50"
            description="Die meistgestreamten Songs des letzten Tages."
            accent="violet"
            icon={<CalendarDays className="h-4 w-4" />}
            rankedSongs={dailySongs}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlayChart={handlePlayChart}
            onPlaySong={handlePlaySong}
          />
          <ArtistChartPanel rankedArtists={artistCharts} />
        </div>
      </div>
    </div>
  );
}
