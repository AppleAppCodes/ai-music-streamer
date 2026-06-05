'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ChevronRight, Flame, Mic2, Pause, Play, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { usePlayer } from '@/lib/player-context';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';

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
          {rankedSongs.map((song, index) => {
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
          })}
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
          Top 10
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Artist Charts</h2>
        <p className="mt-1 text-xs text-white/50 sm:text-sm">
          Die Künstler mit den stärksten Gesamt-Streams auf YORIAX.
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
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchCharts = async () => {
      setLoading(true);
      const todayUtc = new Date().toISOString().slice(0, 10);

      const [{ data: songsData }, { data: dailyData, error: dailyError }] = await Promise.all([
        supabase.from('songs').select('*'),
        supabase.from('song_daily_plays').select('song_id, plays').eq('play_date', todayUtc),
      ]);

      if (songsData) setSongs(songsData as Song[]);
      if (dailyData) setDailyPlays(dailyData as DailyPlay[]);
      if (dailyError) console.error('Failed to load daily charts:', dailyError);
      setLoading(false);
    };

    fetchCharts();
  }, [supabase]);

  const dailyPlayMap = useMemo(
    () => new Map(dailyPlays.map(({ song_id, plays }) => [song_id, plays])),
    [dailyPlays],
  );

  const viralSongs = useMemo<Song[]>(
    () => [...songs]
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 20),
    [songs],
  );

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
      .slice(0, 30)
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

  if (loading) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-[#0A0A0A]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#080808] px-4 pb-32 pt-16 sm:px-6 md:px-10 md:pt-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-br from-orange-500/10 via-violet-500/5 to-transparent" />
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
            eyebrow="Top 20"
            description="Die meistgestreamten Songs auf YORIAX."
            accent="orange"
            icon={<Flame className="h-4 w-4" />}
            rankedSongs={viralSongs}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlayChart={handlePlayChart}
            onPlaySong={handlePlaySong}
          />
          <ChartPanel
            title="Daily Charts"
            eyebrow="Top 50"
            description="Die meistgehörten Songs des heutigen Tages."
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
