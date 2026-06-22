'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { MouseEvent } from 'react';
import type { CSSProperties } from 'react';
import SongCard from '@/components/ui/SongCard';
import { ChevronLeft, ChevronRight, Heart, ListMusic, Pause, Play, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { usePlayer } from '@/lib/player-context';
import Image from 'next/image';

import { GENRES } from '@/lib/constants';
import { Song } from '@/lib/types';
import { getDailyTrendingSongs, getPersonalizedSongs } from '@/lib/homeRecommendations';

type SongWithProfile = Song & {
  profiles?: {
    username?: string | null;
  } | null;
};

type InitialHomeData = {
  artistCovers: string[];
  trendingSongs: Song[];
  recommendedSongs: Song[];
};

const HOME_SONG_GRID_CLASSES = 'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(160px,200px))]';

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

  const genresScrollRef = useRef<HTMLDivElement>(null);
  const [targetSpeed, setTargetSpeed] = useState(0.3);
  const speedRef = useRef(0.3);
  const positionRef = useRef(0);
  const isHoveredRef = useRef(false);

  // Drag state
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);
  const lastDragXRef = useRef(0);
  const dragTimeRef = useRef(0);

  const handleDragStart = useCallback((clientX: number) => {
    isDraggingRef.current = true;
    isHoveredRef.current = true;
    dragStartXRef.current = clientX;
    dragStartPosRef.current = positionRef.current;
    lastDragXRef.current = clientX;
    dragTimeRef.current = performance.now();
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDraggingRef.current) return;
    const delta = dragStartXRef.current - clientX;
    let newPos = dragStartPosRef.current + delta;

    const timeNow = performance.now();
    const dt = timeNow - dragTimeRef.current;
    if (dt > 0) {
      const dx = lastDragXRef.current - clientX;
      speedRef.current = (dx / dt) * 16;
    }
    lastDragXRef.current = clientX;
    dragTimeRef.current = timeNow;

    if (genresScrollRef.current) {
      const maxScroll = genresScrollRef.current.scrollWidth / 3;
      if (newPos >= maxScroll) newPos -= maxScroll;
      else if (newPos <= 0) newPos += maxScroll;
    }

    positionRef.current = newPos;
    if (genresScrollRef.current) {
      genresScrollRef.current.style.transform = `translate3d(-${positionRef.current}px, 0, 0)`;
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    isHoveredRef.current = false;
  }, []);

  const [dailyTrendingSongs, setDailyTrendingSongs] = useState<Song[]>(initialHomeData?.trendingSongs ?? []);
  const [recommendedSongs, setRecommendedSongs] = useState<Song[]>(initialHomeData?.recommendedSongs ?? []);
  const [artistCovers, setArtistCovers] = useState<string[]>(initialHomeData?.artistCovers ?? []);
  const [isLoading, setIsLoading] = useState(!initialHomeData);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 640px)');
    let animationId: number | null = null;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;

      // Target speed depends on hover state
      const target = isHoveredRef.current ? 0 : targetSpeed;

      // Interpolate current speed (0.05 is the smoothing factor)
      speedRef.current += (target - speedRef.current) * 0.05;

      if (genresScrollRef.current && Math.abs(speedRef.current) > 0.01) {
        // Apply speed to position
        positionRef.current += speedRef.current * (dt / 16);

        const scrollWidth = genresScrollRef.current.scrollWidth;
        const maxScroll = scrollWidth / 3;

        // Loop seamlessly
        if (positionRef.current >= maxScroll) {
          positionRef.current -= maxScroll;
        } else if (positionRef.current <= 0) {
          positionRef.current += maxScroll;
        }

        genresScrollRef.current.style.transform = `translate3d(-${positionRef.current}px, 0, 0)`;
      }

      animationId = requestAnimationFrame(animate);
    };

    const stopAnimation = () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      if (genresScrollRef.current) {
        genresScrollRef.current.style.transform = '';
      }
    };

    const startAnimation = () => {
      if (animationId !== null) return;
      lastTime = performance.now();
      animationId = requestAnimationFrame(animate);
    };

    const updateAnimation = () => {
      if (mediaQuery.matches) {
        startAnimation();
      } else {
        stopAnimation();
      }
    };

    mediaQuery.addEventListener('change', updateAnimation);
    updateAnimation();
    return () => {
      mediaQuery.removeEventListener('change', updateAnimation);
      stopAnimation();
    };
  }, [targetSpeed]);

  const scrollGenres = useCallback((direction: 'left' | 'right') => {
    // Boost speed temporarily for a smooth "push"
    speedRef.current = direction === 'right' ? 10 : -10;
    setTargetSpeed(direction === 'right' ? 0.3 : -0.3);
  }, []);

  useEffect(() => {
    if (initialHomeData) return;

    async function loadMusic() {
      const [{ data: allSongs }, { data: { session } }] = await Promise.all([
        supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays, created_at, audio_url, duration, genre, profiles!songs_creator_id_fkey(username)')
          .order('plays', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.auth.getSession(),
      ]);

      const songs = ((allSongs || []) as unknown as SongWithProfile[]).map(song => ({
        ...song,
        creatorName: song.profiles?.username || song.artist_name || 'Unknown'
      }));
      
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

        {/* Default Ambient Purple Glow */}
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out blur-[60px] z-0 ${hoveredBg ? 'opacity-0' : 'opacity-60'}`}
          style={{ backgroundImage: "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)" }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black z-10 opacity-50" />

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

      {/* Popular Genres Section */}
      <section className="px-4 sm:px-8 relative z-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{t('home.popularGenres')}</h2>
          <div className="flex items-center gap-2 sm:mr-8">
            <Link
              href="/genres"
              className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              {t('home.seeAll')}
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <div className="hidden gap-2 sm:flex">
              <button
                onClick={() => scrollGenres('left')}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollGenres('right')}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <div
          data-testid="genre-scroller"
          className="relative -mx-4 group/slider snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-4 py-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-8 sm:snap-none sm:overflow-hidden sm:px-8 sm:py-16"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)'
          }}
        >
          <div
            ref={genresScrollRef}
            data-testid="genre-track"
            onMouseEnter={() => isHoveredRef.current = true}
            onMouseLeave={() => {
              isHoveredRef.current = false;
              handleDragEnd();
            }}
            onMouseDown={(e) => handleDragStart(e.clientX)}
            onMouseMove={(e) => handleDragMove(e.clientX)}
            onMouseUp={handleDragEnd}
            className="flex w-max cursor-grab active:cursor-grabbing"
          >
            {[...GENRES, ...GENRES, ...GENRES].map((genre, i) => {
              const Icon = genre.icon;
              return (
                <Link
                  key={`${genre.name}-${i}`}
                  href={`/genre/${encodeURIComponent(genre.name)}`}
                  className={`mx-1.5 group relative isolate w-[132px] shrink-0 h-20 snap-start rounded-xl p-3 ${i >= GENRES.length ? 'hidden sm:flex' : 'flex'} flex-col justify-between cursor-pointer shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-[1.04] hover:shadow-[0_0_20px_var(--genre-glow)] hover:animate-pulseGlow ${genre.color}`}
                  style={{ '--genre-glow': genre.glow } as CSSProperties}
                >
                <div
                  className="pointer-events-none absolute -inset-2 -z-10 rounded-[1.75rem] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 50% 58%, ${genre.glow} 0%, ${genre.glow} 25%, transparent 60%)`,
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/18 via-transparent to-black/15 opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="w-full flex justify-end opacity-65 transition-opacity duration-300 group-hover:opacity-95">
                  <Icon className="w-6 h-6 text-white" strokeWidth={1.7} />
                </div>
                <span className="relative font-bold text-white text-sm tracking-tight">{genre.name}</span>
              </Link>
            );
          })}
          </div>
        </div>
      </section>

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
