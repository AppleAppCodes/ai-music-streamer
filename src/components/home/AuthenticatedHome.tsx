'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import SongCard from '@/components/ui/SongCard';
import { ChevronLeft, ChevronRight, Heart, ListMusic, Mic2, Move, Music, Pause, Pencil, Play, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { usePlayer } from '@/lib/player-context';
import Image from 'next/image';

import { Song } from '@/lib/types';
import { getArtistStorageSlug, isArtistVideoFile } from '@/lib/artist-media';
import { getDailyTrendingSongs, getPersonalizedSongs } from '@/lib/homeRecommendations';
import { isAdminUser } from '@/lib/admin';
import type { OfficialPlaylistSummary, SpotlightArtistSummary, SpotlightPlaylistSummary } from '@/lib/public-music-data';

type SongWithProfile = Song & {
  profiles?: {
    username?: string | null;
  } | null;
};

type InitialHomeData = {
  artistCovers: string[];
  trendingSongs: Song[];
  recommendedSongs: Song[];
  officialPlaylists: OfficialPlaylistSummary[];
  spotlightSong: Song | null;
  spotlightArtist: SpotlightArtistSummary | null;
  spotlightPlaylist: SpotlightPlaylistSummary | null;
};

const HOME_SONG_GRID_CLASSES = 'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(160px,200px))]';
const ARTIST_VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i;

function SectionHeader({ title, actionLabel, href }: { title: string; actionLabel?: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{title}</h2>
      {actionLabel && href ? (
        <Link
          href={href}
          className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          {actionLabel}
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

function SongGridSkeleton() {
  return (
    <div className={HOME_SONG_GRID_CLASSES}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-white/5 bg-white/[0.03] p-2.5 animate-pulse">
          <div className="aspect-square rounded-xl bg-white/10" />
          <div className="mt-4 h-4 w-4/5 rounded-full bg-white/10" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function EmptySongState({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-8 text-center text-sm font-medium text-white/45">
      {title}
    </div>
  );
}

function ImageSlideshow({ images, currentIndex }: { images: string[], currentIndex: number }) {
  if (!images || images.length === 0) return null;
  return (
    <>
      {images.map((img, idx) => (
        <Image
          key={img}
          src={img}
          alt={`Slide ${idx}`}
          fill
          sizes="(max-width: 640px) 56px, 72px"
          className={`object-cover absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </>
  );
}

type GreetingKey = 'morning' | 'day' | 'evening' | 'night';

function getGreetingKey(hour: number): GreetingKey {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'day';
  if (hour < 23) return 'evening';
  return 'night';
}

export default function AuthenticatedHome({ initialHomeData }: { initialHomeData?: InitialHomeData }) {
  const { t } = useTranslation();
  const { playSong, setQueue, currentSong, isPlaying, togglePlayPause } = usePlayer();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [quickPlayLoading, setQuickPlayLoading] = useState<string | null>(null);
  const [activeQuickAccessTitle, setActiveQuickAccessTitle] = useState<string | null>(null);
  const [activeQuickAccessSongIds, setActiveQuickAccessSongIds] = useState<string[]>([]);
  const [greetingKey, setGreetingKey] = useState<GreetingKey>('evening');

  const [dailyTrendingSongs, setDailyTrendingSongs] = useState<Song[]>(initialHomeData?.trendingSongs ?? []);
  const [recommendedSongs, setRecommendedSongs] = useState<Song[]>(initialHomeData?.recommendedSongs ?? []);
  const [artistCovers, setArtistCovers] = useState<string[]>(initialHomeData?.artistCovers ?? []);
  const [spotlightSong, setSpotlightSong] = useState<Song | null>(initialHomeData?.spotlightSong ?? null);
  const [spotlightArtist, setSpotlightArtist] = useState<SpotlightArtistSummary | null>(initialHomeData?.spotlightArtist ?? null);
  const [heroArtistVideoUrl, setHeroArtistVideoUrl] = useState<string | null>(null);
  const [heroArtistName, setHeroArtistName] = useState<string | null>(null);
  const [heroVideoPosition, setHeroVideoPosition] = useState<string | null>(null);
  const [isPositioningHero, setIsPositioningHero] = useState(false);
  const [videoArtists, setVideoArtists] = useState<string[]>([]);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialHomeData);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setIsAdmin(isAdminUser(data.user ?? null));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialHomeData) return;

    async function loadMusic() {
      const [{ data: allSongs }, { data: spotlightData }, { data: { session } }] = await Promise.all([
        supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays, created_at, audio_url, duration, genre, is_spotlight, spotlight_copy, profiles!songs_creator_id_fkey(username)')
          .order('plays', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays, created_at, audio_url, duration, genre, is_spotlight, spotlight_copy, profiles!songs_creator_id_fkey(username)')
          .eq('is_spotlight', true)
          .eq('is_approved', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.auth.getSession(),
      ]);

      const songs = ((allSongs || []) as unknown as SongWithProfile[]).map(song => ({
        ...song,
        creatorName: song.profiles?.username || song.artist_name || 'Unknown'
      }));
      setSpotlightSong(spotlightData ? {
        ...spotlightData,
        creatorName: (spotlightData as unknown as SongWithProfile).profiles?.username || spotlightData.artist_name || 'Unknown'
      } as unknown as Song : null);
      
      const covers = Array.from(new Set(songs.map(s => s.cover_url).filter(Boolean))).slice(0, 4) as string[];
      setArtistCovers(covers);

      const dailySongs = getDailyTrendingSongs(songs, 8);
      setDailyTrendingSongs(dailySongs);

      if (!session) {
        setRecommendedSongs(getPersonalizedSongs(songs, {
          likedSongs: [],
          playlistSongs: [],
          savedSongs: [],
          playbackHistory: [],
        }, 8));
        setIsLoading(false);
        return;
      }

      const [{ data: likedSongs }, { data: playlists }, { data: savedSongs }, { data: playbackHistory }] = await Promise.all([
        supabase
          .from('liked_songs')
          .select('song_id')
          .eq('user_id', session.user.id),
        supabase
          .from('playlists')
          .select('id')
          .eq('user_id', session.user.id),
        supabase
          .from('feed_saves')
          .select('song_id')
          .eq('user_id', session.user.id),
        supabase
          .from('user_song_plays')
          .select('song_id, play_count, last_played_at')
          .eq('user_id', session.user.id),
      ]);
      const playlistIds = (playlists || []).map(({ id }) => id);
      const { data: playlistSongs } = playlistIds.length > 0
        ? await supabase
          .from('playlist_songs')
          .select('song_id')
          .in('playlist_id', playlistIds)
        : { data: [] };

      const rankedRecommendations = getPersonalizedSongs(songs, {
        likedSongs: likedSongs || [],
        playlistSongs: playlistSongs || [],
        savedSongs: savedSongs || [],
        playbackHistory: playbackHistory || [],
      }, songs.length);
      const trendingIds = new Set(dailySongs.map(({ id }) => id));
      const distinctRecommendations = rankedRecommendations.filter(({ id }) => !trendingIds.has(id));

      setRecommendedSongs((distinctRecommendations.length >= 8 ? distinctRecommendations : rankedRecommendations).slice(0, 8));
      setIsLoading(false);
    }
    loadMusic();
  }, [initialHomeData]);

  useEffect(() => {
    const updateGreeting = () => setGreetingKey(getGreetingKey(new Date().getHours()));
    updateGreeting();
    const interval = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const loadHeroVideo = useCallback(async () => {
    // Which artist's video did the admin pin? (null = auto/random)
    const { data: settings } = await supabase
      .from('app_settings')
      .select('hero_artist_name, hero_video_position')
      .eq('id', 'global')
      .maybeSingle();
    const selected = (settings?.hero_artist_name as string | null) ?? null;
    setHeroArtistName(selected);
    setHeroVideoPosition((settings?.hero_video_position as string | null) ?? null);

    const { data: banners } = await supabase.storage.from('covers').list('banners', { limit: 1000 });
    const videoFiles = (banners ?? []).filter(
      (file) => file.name.includes('_video_') && ARTIST_VIDEO_EXTENSIONS.test(file.name),
    );
    if (videoFiles.length === 0) {
      setHeroArtistVideoUrl(null);
      setVideoArtists([]);
      return;
    }

    // Map exact artist storage slug -> video file.
    const videoByBase = new Map<string, (typeof videoFiles)[number]>();
    for (const file of videoFiles) {
      const base = file.name.slice(0, file.name.indexOf('_video_'));
      if (base && !videoByBase.has(base)) videoByBase.set(base, file);
    }

    // Picker options: artist display names that actually have a video.
    const { data: artistRows } = await supabase
      .from('artist_profiles')
      .select('artist_name')
      .order('artist_name', { ascending: true });
    setVideoArtists(
      (artistRows ?? [])
        .map((row) => row.artist_name as string)
        .filter((name) => {
          const slug = getArtistStorageSlug(name);
          const file = videoByBase.get(slug);
          return Boolean(name && file && isArtistVideoFile(file.name, slug));
        }),
    );

    // Use the pinned artist's video if available, otherwise pick a random one.
    const selectedSlug = selected ? getArtistStorageSlug(selected) : null;
    const chosen =
      (selectedSlug ? videoByBase.get(selectedSlug) : undefined) ??
      videoFiles[Math.floor(Math.random() * videoFiles.length)];
    const { data: urlData } = supabase.storage.from('covers').getPublicUrl(`banners/${chosen.name}`);
    const cacheKey = new Date(chosen.updated_at || chosen.created_at || 0).getTime();
    setHeroArtistVideoUrl(`${urlData.publicUrl}?t=${cacheKey}`);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadHeroVideo();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadHeroVideo]);

  const handleSelectHeroArtist = useCallback(
    async (name: string | null) => {
      setHeroPickerOpen(false);
      const { error } = await supabase
        .from('app_settings')
        .update({ hero_artist_name: name })
        .eq('id', 'global');
      if (error) {
        alert('Konnte Hero-Video nicht speichern: ' + error.message);
        return;
      }
      setHeroArtistName(name);
      await loadHeroVideo();
    },
    [loadHeroVideo],
  );

  const saveHeroVideoPosition = useCallback(async (value: string) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from('app_settings')
      .update({ hero_video_position: value })
      .eq('id', 'global');
    if (error) console.error('Failed to save hero_video_position', error);
  }, [isAdmin]);

  const beginHeroPositioning = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isAdmin || !isPositioningHero) return;
    const container = event.currentTarget;
    container.setPointerCapture(event.pointerId);
    const rect = container.getBoundingClientRect();
    const toValue = (clientX: number, clientY: number) => {
      const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
      return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
    };
    setHeroVideoPosition(toValue(event.clientX, event.clientY));
    const onMove = (ev: PointerEvent) => setHeroVideoPosition(toValue(ev.clientX, ev.clientY));
    const onUp = (ev: PointerEvent) => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
      try { container.releasePointerCapture(ev.pointerId); } catch { /* already released */ }
      const finalValue = toValue(ev.clientX, ev.clientY);
      setHeroVideoPosition(finalValue);
      void saveHeroVideoPosition(finalValue);
    };
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onUp);
  }, [isAdmin, isPositioningHero, saveHeroVideoPosition]);

  const resetHeroPosition = useCallback(() => {
    setHeroVideoPosition('50% 50%');
    void saveHeroVideoPosition('50% 50%');
  }, [saveHeroVideoPosition]);

  const greeting = t(`home.greetings.${greetingKey}`);

  const quickAccessItems = useMemo(() => [
    {
      title: t('home.quickAccess.favorites'),
      icon: Heart,
      color: "bg-gradient-primary",
      images: ["linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)"],
      link: "/collection/tracks"
    },
    {
      title: t('home.quickAccess.charts'),
      icon: TrendingUp,
      color: "bg-yellow-500",
      images: ["linear-gradient(135deg, #eab308 0%, #a16207 100%)"],
      link: "/charts/viral"
    },
    {
      title: t('home.quickAccess.artists'),
      color: "bg-white/20 backdrop-blur-md border border-white/30",
      images: artistCovers.length > 0 ? artistCovers : ["linear-gradient(135deg, #7c3aed 0%, #2dd4bf 100%)"],
      link: "/artists"
    },
    {
      title: t('home.quickAccess.playlists'),
      icon: ListMusic,
      color: "bg-teal-500",
      images: ["linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)"],
      link: "/playlists"
    }
  ], [t, artistCovers]);

  useEffect(() => {
    const item = quickAccessItems.find(i => i.title === hoveredItem);
    const imageCount = item?.images?.length || 0;
    if (imageCount <= 1) return;

    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % imageCount);
    }, 1500);

    return () => clearInterval(interval);
  }, [hoveredItem, quickAccessItems]);

  const activeItem = quickAccessItems.find(i => i.title === hoveredItem);
  const hoveredBg = activeItem && activeItem.images ? activeItem.images[activeItem.images.length > 1 ? slideIndex : 0] : null;

  const allBackgroundImages = useMemo(() => {
    return Array.from(new Set(quickAccessItems.flatMap(item => item.images || [])));
  }, [quickAccessItems]);

  const startSongQueue = useCallback((songs: Song[], itemTitle: string) => {
    if (songs.length === 0) return;

    const queue = songs.map((song): Song => ({
      ...song,
      creatorName: song.artist_name || song.creatorName || t('player.creatorFallback'),
    }));
    const songIds = queue.map(song => song.id);

    if (currentSong && activeQuickAccessTitle === itemTitle && songIds.includes(currentSong.id)) {
      setActiveQuickAccessSongIds(songIds);
      togglePlayPause();
      return;
    }

    setActiveQuickAccessTitle(itemTitle);
    setActiveQuickAccessSongIds(songIds);
    setQueue(queue, 0);
    playSong(queue[0]);
  }, [currentSong, activeQuickAccessTitle, t, togglePlayPause, setQueue, playSong]);

  const handleQuickAccessPlay = useCallback(async (event: MouseEvent<HTMLButtonElement>, itemTitle: string) => {
    event.preventDefault();
    event.stopPropagation();

    if (quickPlayLoading) return;
    setQuickPlayLoading(itemTitle);

    try {
      if (itemTitle === t('home.quickAccess.favorites')) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data } = await supabase
          .from('liked_songs')
          .select(`
            created_at,
            songs (id, title, artist_name, cover_url, plays, audio_url, duration, genre)
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        const likedSongs = (data || [])
          .map((item) => item.songs as unknown as Song | null)
          .filter((song): song is Song => Boolean(song));
        startSongQueue(likedSongs, itemTitle);
        return;
      }

      if (itemTitle === t('home.quickAccess.charts')) {
        const { data } = await supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays, audio_url, duration, genre')
          .order('plays', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(100);

        startSongQueue((data || []) as unknown as Song[], itemTitle);
      }
    } finally {
      setQuickPlayLoading(null);
    }
  }, [quickPlayLoading, t, startSongQueue]);

  return (
    <div className="relative flex min-h-screen flex-col gap-8 overflow-hidden pb-12 pt-4 sm:gap-12 sm:pt-6">

      {/* Dynamic Blurred Backgrounds */}
      <div className="absolute top-0 left-0 w-full h-[500px] pointer-events-none z-0 overflow-hidden">

        {heroArtistVideoUrl ? (
          <video
            src={heroArtistVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            controlsList="nodownload"
            onContextMenu={(event) => event.preventDefault()}
            style={{ objectPosition: heroVideoPosition ?? '50% 50%' }}
            className={`absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-1000 ${
              hoveredBg ? 'opacity-20' : 'opacity-[0.42]'
            }`}
          />
        ) : null}

        {/* Default Ambient Purple Glow */}
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out blur-[60px] z-0 ${hoveredBg || heroArtistVideoUrl ? 'opacity-0' : 'opacity-60'}`}
          style={{ backgroundImage: "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)" }}
        />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(45,212,191,0.16),transparent_34%),linear-gradient(90deg,rgba(4,7,18,0.58),rgba(10,4,24,0.36)_42%,rgba(5,5,12,0.74))] z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black z-10 opacity-55" />

        {allBackgroundImages.map((img) => {
          const isUrl = img.startsWith('/') || img.startsWith('http');
          return (
            <div
              key={img}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out blur-[60px] z-0 ${
                img === hoveredBg ? 'opacity-80' : 'opacity-0'
              }`}
              style={{ backgroundImage: isUrl ? `url("${img}")` : img }}
            />
          );
        })}

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black z-20" />
      </div>

      {/* Drag layer to reposition the hero video (above content) */}
      {isAdmin && heroArtistVideoUrl && isPositioningHero ? (
        <div
          className="absolute left-0 top-0 z-30 h-[500px] w-full cursor-move touch-none ring-2 ring-inset ring-primary-light/60"
          onPointerDown={beginHeroPositioning}
        />
      ) : null}

      {/* Admin: pick which artist's video shows as the home hero + reposition it */}
      {isAdmin ? (
        <div className="pointer-events-auto absolute right-4 top-4 z-40 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setHeroPickerOpen((open) => !open)}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
                title="Hero-Video auswählen"
              >
                <Pencil className="h-3.5 w-3.5" />
                Hero-Video
              </button>
              {heroPickerOpen ? (
                <div className="absolute right-0 mt-2 max-h-72 w-60 overflow-y-auto rounded-xl border border-white/10 bg-[#0d0a17] p-2 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => handleSelectHeroArtist(null)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 ${heroArtistName === null ? 'text-primary' : 'text-white/80'}`}
                  >
                    Auto (zufällig)
                  </button>
                  {videoArtists.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-white/40">Keine Artists mit Video gefunden.</p>
                  ) : (
                    videoArtists.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleSelectHeroArtist(name)}
                        className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 ${heroArtistName === name ? 'text-primary' : 'text-white/80'}`}
                      >
                        {name}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            {heroArtistVideoUrl ? (
              <button
                type="button"
                onClick={() => setIsPositioningHero((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur transition-colors ${isPositioningHero ? 'border-primary-light bg-primary/80 text-white hover:bg-primary' : 'border-white/15 bg-black/40 text-white/80 hover:bg-black/60 hover:text-white'}`}
                title="Hero-Video verschieben"
              >
                <Move className="h-3.5 w-3.5" />
                {isPositioningHero ? 'Fertig' : 'Verschieben'}
              </button>
            ) : null}
          </div>
          {isPositioningHero ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetHeroPosition}
                className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
              >
                Zentrieren
              </button>
              <span className="rounded-full bg-black/55 px-2 py-1 text-[11px] text-white/80 backdrop-blur">
                Video ziehen zum Positionieren
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-[-120px] top-24 z-0 h-72 w-72 rounded-full bg-primary/20 blur-[90px]" />
      <div className="pointer-events-none absolute left-[-120px] top-72 z-0 h-72 w-72 rounded-full bg-accent/10 blur-[100px]" />

      {/* Quick Access / Greeting Section */}
      <section className="px-4 sm:px-8 relative z-10">
        <div className="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-accent/80">Yoriax</p>
            <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-md sm:text-5xl">{greeting}</h1>
            <p className="mt-3 hidden max-w-2xl text-sm text-white/55 sm:block">{t('home.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {quickAccessItems.map((item) => {
            const Icon = item.icon;
            const canQuickPlay =
              item.title === t('home.quickAccess.favorites') ||
              item.title === t('home.quickAccess.charts');
            const isQuickAccessPlaying =
              Boolean(currentSong) &&
              activeQuickAccessTitle === item.title &&
              activeQuickAccessSongIds.includes(currentSong?.id || '') &&
              isPlaying;
            const cardContent = (
              <>
                <div className={`relative flex h-full w-14 shrink-0 items-center justify-center shadow-md sm:w-[72px] ${item.color || 'bg-black'}`}>
                  {Icon ? (
                    <Icon
                      className="relative z-10 h-6 w-6 text-white opacity-90 sm:h-8 sm:w-8"
                      fill={item.title === "Lieblingssongs" ? "currentColor" : "none"}
                    />
                  ) : item.images ? (
                    <ImageSlideshow images={item.images} currentIndex={hoveredItem === item.title && item.images.length > 1 ? slideIndex : 0} />
                  ) : null}
                </div>
                <div className="relative min-w-0 flex-1 truncate px-2 text-xs font-bold text-white drop-shadow-sm sm:px-4 sm:text-sm">
                  {item.title}
                </div>
              </>
            );
            return (
              <div
                key={item.title}
                className="group relative flex h-14 items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.07] shadow-[0_14px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.12] hover:shadow-[0_20px_54px_rgba(0,0,0,0.38)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent sm:h-[72px] sm:rounded-2xl"
                onMouseEnter={() => {
                  setHoveredItem(item.title);
                  setSlideIndex(item.images && item.images.length > 1 ? 1 : 0);
                }}
                onMouseLeave={() => {
                  setHoveredItem(null);
                  setSlideIndex(0);
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <Link
                  href={item.link}
                  className="relative z-10 flex h-full min-w-0 flex-1 items-center rounded-2xl"
                >
                  {cardContent}
                </Link>
                {canQuickPlay ? (
                  <div className="relative z-20 hidden translate-x-2 pr-4 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block">
                    <button
                      type="button"
                      onClick={(event) => handleQuickAccessPlay(event, item.title)}
                      disabled={quickPlayLoading === item.title}
                      className={`flex w-10 h-10 rounded-full ${item.color || 'bg-primary'} items-center justify-center text-white shadow-xl transition-transform hover:scale-105 disabled:cursor-wait disabled:opacity-70`}
                      aria-label={isQuickAccessPlaying ? t('player.pause', { title: item.title }) : t('player.play', { title: item.title })}
                    >
                      {isQuickAccessPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current" />
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Spotlight Slider */}
      {(spotlightSong || spotlightArtist || initialHomeData?.spotlightPlaylist) ? (
        <SpotlightSlider
          song={spotlightSong}
          artist={spotlightArtist}
          playlist={initialHomeData?.spotlightPlaylist ?? null}
          isAdmin={isAdmin}
          onSongCopyChange={(copy) => setSpotlightSong((prev) => (prev ? ({ ...prev, spotlight_copy: copy } as Song) : prev))}
          onArtistCopyChange={(copy) => setSpotlightArtist((prev) => (prev ? { ...prev, spotlight_copy: copy } : prev))}
        />
      ) : null}

      {/* Official Playlists Section */}
      {initialHomeData?.officialPlaylists?.length ? (
        <OfficialPlaylistsSection playlists={initialHomeData.officialPlaylists} />
      ) : null}

      {/* Trending Section */}
      <section className="px-4 sm:px-8 relative z-10 min-h-[200px]">
        <SectionHeader title={t('home.newReleases')} />

        {isLoading ? (
          <SongGridSkeleton />
        ) : dailyTrendingSongs.length > 0 ? (
          <div className={HOME_SONG_GRID_CLASSES}>
            {dailyTrendingSongs.map((song, idx) => (
              <SongCard
                key={`trending-${song.id}`}
                song={song}
                creatorName={song.creatorName}
                compact
                priority={idx < 4}
              />
            ))}
          </div>
        ) : (
          <EmptySongState title={t('home.emptySongs')} />
        )}
      </section>

      {/* Personalized Section */}
      <section className="px-4 sm:px-8 relative z-10 min-h-[200px]">
        <SectionHeader title={t('home.trending')} />

        {isLoading ? (
          <SongGridSkeleton />
        ) : recommendedSongs.length > 0 ? (
          <div className={HOME_SONG_GRID_CLASSES}>
            {recommendedSongs.map((song, idx) => (
              <SongCard
                key={`recommended-${song.id}`}
                song={song}
                creatorName={song.creatorName}
                compact
                priority={idx < 4}
              />
            ))}
          </div>
        ) : (
          <EmptySongState title={t('home.emptySongs')} />
        )}
      </section>
    </div>
  );
}

const SPOTLIGHT_SLIDE_DURATION_MS = 8000;

type SpotlightSlideKind = 'song' | 'artist' | 'playlist';
type SpotlightSlide =
  | { kind: 'song'; song: Song }
  | { kind: 'artist'; artist: SpotlightArtistSummary }
  | { kind: 'playlist'; playlist: SpotlightPlaylistSummary };

function SpotlightSlider({
  song,
  artist,
  playlist,
  isAdmin,
  onSongCopyChange,
  onArtistCopyChange,
}: {
  song: Song | null;
  artist: SpotlightArtistSummary | null;
  playlist: SpotlightPlaylistSummary | null;
  isAdmin: boolean;
  onSongCopyChange: (copy: string | null) => void;
  onArtistCopyChange: (copy: string | null) => void;
}) {
  const { t } = useTranslation();

  const slides: SpotlightSlide[] = useMemo(() => {
    const list: SpotlightSlide[] = [];
    if (song) list.push({ kind: 'song', song });
    if (artist) list.push({ kind: 'artist', artist });
    if (playlist) list.push({ kind: 'playlist', playlist });
    return list;
  }, [song, artist, playlist]);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Bound `active` at render time so we never index out of range when the
  // slide set shrinks between renders.
  const boundedActive = slides.length > 0 ? active % slides.length : 0;

  if (slides.length === 0) return null;
  const current = slides[boundedActive];

  const goTo = (index: number) => {
    setActive(((index % slides.length) + slides.length) % slides.length);
  };
  const goPrev = () => goTo(boundedActive - 1);
  const goNext = () => goTo(boundedActive + 1);

  const headerTitle = current.kind === 'song'
    ? t('home.spotlight')
    : current.kind === 'artist'
      ? t('home.spotlightArtistEyebrow').toUpperCase()
      : t('home.spotlightPlaylistEyebrow').toUpperCase();

  return (
    <section
      className="px-4 sm:px-8 relative z-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{headerTitle}</h2>
        {slides.length > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label={t('home.spotlightPrev')}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t('home.spotlightNext')}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/25 via-primary/10 to-accent/15 shadow-[0_24px_64px_rgba(124,58,237,0.18)] h-[280px] sm:h-[260px]">
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{
            width: `${slides.length * 100}%`,
            transform: `translateX(-${(boundedActive / slides.length) * 100}%)`,
          }}
        >
          {slides.map((slide, index) => (
            <div
              key={slide.kind + index}
              className="h-full flex-shrink-0"
              style={{ width: `${100 / slides.length}%` }}
              aria-hidden={index !== boundedActive}
            >
              {slide.kind === 'song' ? <SpotlightSongCard song={slide.song} isAdmin={isAdmin} onCopyChange={onSongCopyChange} /> : null}
              {slide.kind === 'artist' ? <SpotlightArtistCard artist={slide.artist} isAdmin={isAdmin} onCopyChange={onArtistCopyChange} /> : null}
              {slide.kind === 'playlist' ? <SpotlightPlaylistCard playlist={slide.playlist} /> : null}
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {slides.map((slide, index) => {
            const isActive = index === boundedActive;
            const isPast = index < boundedActive;
            return (
              <button
                key={slide.kind + index}
                type="button"
                onClick={() => goTo(index)}
                className="relative h-[3px] w-10 overflow-hidden rounded-full bg-[#251033]/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-colors hover:bg-[#321545]"
                aria-label={t(slide.kind === 'song' ? 'home.spotlight' : slide.kind === 'artist' ? 'home.spotlightArtistEyebrow' : 'home.spotlightPlaylistEyebrow')}
              >
                {isActive ? (
                  <span
                    key={`fill-${boundedActive}`}
                    onAnimationEnd={() => setActive((prev) => (prev + 1) % slides.length)}
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-gradient-to-r from-[#4c1d95] via-[#5b21b6] to-[#6d28d9] shadow-[0_0_12px_rgba(91,33,182,0.55)]"
                    style={{
                      animation: `spotlightFill ${SPOTLIGHT_SLIDE_DURATION_MS}ms linear forwards`,
                      animationPlayState: paused ? 'paused' : 'running',
                    }}
                  />
                ) : (
                  <span
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-gradient-to-r from-[#4c1d95] via-[#5b21b6] to-[#6d28d9] shadow-[0_0_12px_rgba(91,33,182,0.45)]"
                    style={{ transform: `scaleX(${isPast ? 1 : 0})` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function SpotlightSongCard({
  song,
  isAdmin,
  onCopyChange,
}: {
  song: Song;
  isAdmin: boolean;
  onCopyChange: (copy: string | null) => void;
}) {
  const { t } = useTranslation();
  const { playSong, setQueue, currentSong, isPlaying, togglePlayPause } = usePlayer();
  const isActive = currentSong?.id === song.id;
  const isThisPlaying = isActive && isPlaying;
  const currentCopy = (song as unknown as { spotlight_copy?: string | null }).spotlight_copy ?? null;

  const handlePlay = useCallback(() => {
    if (isActive) {
      togglePlayPause();
      return;
    }
    setQueue([song], 0);
    playSong(song);
  }, [isActive, togglePlayPause, setQueue, playSong, song]);

  const handleEditCopy = useCallback(async () => {
    const next = window.prompt(t('home.spotlightEditPrompt'), currentCopy ?? '');
    if (next === null) return;
    const trimmed = next.trim();
    const value = trimmed.length > 0 ? trimmed : null;
    const previous = currentCopy;
    onCopyChange(value);
    const { error } = await supabase.from('songs').update({ spotlight_copy: value }).eq('id', song.id);
    if (error) {
      onCopyChange(previous);
      alert(t('home.spotlightEditError', { message: error.message }));
    }
  }, [t, currentCopy, onCopyChange, song.id]);

  return (
    <div className="relative p-5 sm:p-7 w-full">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
        <Link
          href={`/song/${song.id}`}
          className="relative flex h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-2xl transition-transform hover:scale-[1.02] sm:h-40 sm:w-40"
        >
          {song.cover_url ? (
            <Image src={song.cover_url} alt={song.title} fill sizes="(max-width: 640px) 128px, 160px" className="object-cover" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white/5">
              <Sparkles className="h-10 w-10 text-white/40" />
            </div>
          )}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col text-center sm:text-left">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-primary-light/90">
            <Sparkles className="h-3.5 w-3.5" />
            {t('home.spotlightEyebrow')}
          </span>
          <h3 className="mt-2 truncate text-2xl font-black text-white sm:text-3xl">{song.title}</h3>
          <p className="mt-1 truncate text-sm font-bold text-white/65">
            {song.artist_name || song.creatorName || t('guestHome.unknownArtist')}
          </p>
          <div className="relative mt-3 max-w-xl">
            <p className={`text-sm leading-6 text-white/55 line-clamp-3 ${isAdmin ? 'pr-8' : ''}`}>
              {currentCopy?.trim() || t('home.spotlightCopy')}
            </p>
            {isAdmin ? (
              <button
                type="button"
                onClick={handleEditCopy}
                aria-label={t('home.spotlightEditCopy')}
                title={t('home.spotlightEditCopy')}
                className="absolute right-0 top-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
            <button
              type="button"
              onClick={handlePlay}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(124,58,237,0.45)] transition-transform hover:scale-105"
              aria-label={isThisPlaying ? t('home.spotlightPause') : t('home.spotlightPlay')}
            >
              {isThisPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              {isThisPlaying ? t('home.spotlightPause') : t('home.spotlightPlay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpotlightArtistCard({
  artist,
  isAdmin,
  onCopyChange,
}: {
  artist: SpotlightArtistSummary;
  isAdmin: boolean;
  onCopyChange: (copy: string | null) => void;
}) {
  const { t } = useTranslation();
  const currentCopy = artist.spotlight_copy ?? null;

  const handleEditCopy = useCallback(async () => {
    const next = window.prompt(t('home.spotlightEditPrompt'), currentCopy ?? '');
    if (next === null) return;
    const trimmed = next.trim();
    const value = trimmed.length > 0 ? trimmed : null;
    const previous = currentCopy;
    onCopyChange(value);
    const { error } = await supabase
      .from('artist_profiles')
      .update({ spotlight_copy: value })
      .eq('artist_name', artist.artist_name);
    if (error) {
      onCopyChange(previous);
      alert(t('home.spotlightEditError', { message: error.message }));
    }
  }, [t, currentCopy, onCopyChange, artist.artist_name]);

  const hasCopy = Boolean(currentCopy?.trim());

  return (
    <div className="relative p-5 sm:p-7 w-full">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
        <Link
          href={`/artist/${encodeURIComponent(artist.artist_name)}`}
          className="relative flex h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-2xl transition-transform hover:scale-[1.02] sm:h-40 sm:w-40"
        >
          {artist.cover_url ? (
            <Image src={artist.cover_url} alt={artist.artist_name} fill sizes="(max-width: 640px) 128px, 160px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white/5">
              <Mic2 className="h-10 w-10 text-white/40" />
            </div>
          )}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col text-center sm:text-left">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-primary-light/90">
            <Mic2 className="h-3.5 w-3.5" />
            {t('home.spotlightArtistEyebrow')}
          </span>
          <h3 className="mt-2 truncate text-2xl font-black text-white sm:text-3xl">{artist.artist_name}</h3>
          <p className="mt-1 text-sm font-bold text-white/65">
            {t('home.spotlightArtistStats', {
              songs: artist.song_count.toLocaleString('de-DE'),
              plays: artist.total_plays.toLocaleString('de-DE'),
            })}
          </p>
          {hasCopy || isAdmin ? (
            <div className="relative mt-3 max-w-xl">
              <p
                className={`text-sm leading-6 line-clamp-3 ${isAdmin ? 'pr-8' : ''} ${
                  hasCopy ? 'text-white/55' : 'italic text-white/35'
                }`}
              >
                {hasCopy ? currentCopy : t('home.spotlightArtistCopyPlaceholder')}
              </p>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleEditCopy}
                  aria-label={t('home.spotlightEditCopy')}
                  title={t('home.spotlightEditCopy')}
                  className="absolute right-0 top-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
            <Link
              href={`/artist/${encodeURIComponent(artist.artist_name)}`}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(124,58,237,0.45)] transition-transform hover:scale-105"
            >
              <ChevronRight className="h-4 w-4" />
              {t('home.spotlightArtistCta')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpotlightPlaylistCard({ playlist }: { playlist: SpotlightPlaylistSummary }) {
  const { t } = useTranslation();
  const isDailyNewReleases = playlist.id === 'da114eeb-ecea-5e55-9ee1-ea5e5da11111' || playlist.id === 'daily-new-releases';
  return (
    <div className="relative p-5 sm:p-7 w-full">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-300/25 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-primary/25 blur-[120px]" />
      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
        <Link
          href={`/playlist/${playlist.id}`}
          className="relative flex h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-2xl transition-transform hover:scale-[1.02] sm:h-40 sm:w-40"
        >
          {playlist.cover_url ? (
            <Image src={playlist.cover_url} alt={playlist.title} fill sizes="(max-width: 640px) 128px, 160px" className="object-cover" />
          ) : isDailyNewReleases ? (
            <Image src="/brand/yoriax-symbol.png" alt={playlist.title} fill sizes="(max-width: 640px) 128px, 160px" className="object-contain p-5" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white/5">
              <ListMusic className="h-10 w-10 text-white/40" />
            </div>
          )}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col text-center sm:text-left">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-teal-200/90">
            <ListMusic className="h-3.5 w-3.5" />
            {t('home.spotlightPlaylistEyebrow')}
          </span>
          <h3 className="mt-2 truncate text-2xl font-black text-white sm:text-3xl">{playlist.title}</h3>
          <p className="mt-1 truncate text-sm font-bold text-white/65">{playlist.creatorName}</p>
          {playlist.description ? (
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/55 line-clamp-3">{playlist.description}</p>
          ) : null}
          <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
            <Link
              href={`/playlist/${playlist.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(124,58,237,0.45)] transition-transform hover:scale-105"
            >
              <ChevronRight className="h-4 w-4" />
              {t('home.spotlightPlaylistCta')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Keep the symbol so unused-import lint stays clean; SpotlightSlideKind is the
// discriminator for slide kinds.
export type { SpotlightSlideKind };

function OfficialPlaylistsSection({ playlists }: { playlists: OfficialPlaylistSummary[] }) {
  const { t } = useTranslation();

  return (
    <section className="px-4 sm:px-8 relative z-10">
      <SectionHeader title={t('home.officialPlaylists')} actionLabel={t('home.seeAll')} href="/discover/playlists" />
      <div className={HOME_SONG_GRID_CLASSES}>
        {playlists.map((playlist) => {
          const isDailyNewReleases = playlist.id === 'da114eeb-ecea-5e55-9ee1-ea5e5da11111' || playlist.id === 'daily-new-releases';
          return (
            <Link
              key={playlist.id}
              href={`/playlist/${playlist.id}`}
              className="group relative flex cursor-pointer flex-col gap-3 rounded-[1.35rem] border border-teal-300/15 bg-gradient-to-br from-teal-300/[0.08] via-white/[0.03] to-primary/[0.08] p-4 transition-all hover:-translate-y-0.5 hover:border-teal-200/40"
            >
              <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-[1.1rem] border border-white/10 bg-white/5 shadow-[0_18px_38px_rgba(0,0,0,0.34)]">
                {playlist.cover_url ? (
                  <Image
                    src={playlist.cover_url}
                    alt={playlist.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : isDailyNewReleases ? (
                  <Image
                    src="/brand/yoriax-symbol.png"
                    alt={playlist.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                    className="object-contain p-8 transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music className="h-12 w-12 text-white/20" />
                  </div>
                )}
                <div className="absolute left-2 top-2 rounded-full border border-teal-200/20 bg-black/55 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-teal-100 backdrop-blur-md">
                  Official
                </div>
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">{playlist.title}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-white/45">
                  {playlist.creatorName}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
