'use client';

import { useState, useEffect, useMemo } from 'react';
import SongCard from '@/components/ui/SongCard';
import { Play, Heart, TrendingUp, ListMusic, Radio } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

import { GENRES } from '@/lib/constants';
import { Song } from '@/lib/types';

type SongWithProfile = Song & {
  profiles?: {
    username?: string | null;
  } | null;
};

function ImageSlideshow({ images, currentIndex }: { images: string[], currentIndex: number }) {
  if (!images || images.length === 0) return null;
  return (
    <>
      {images.map((img, idx) => (
        <img 
          key={img}
          src={img}
          alt={`Slide ${idx}`}
          className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [newReleases, setNewReleases] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMusic() {
      // Fetch trending songs (ordered by plays)
      const { data: trending } = await supabase
        .from('songs')
        .select('*, profiles(username)')
        .order('plays', { ascending: false })
        .limit(4);
        
      if (trending) {
        setTrendingSongs((trending as SongWithProfile[]).map(song => ({
          ...song,
          creatorName: song.profiles?.username || 'Unknown'
        })));
      }

      // Fetch new releases (ordered by created_at)
      const { data: recent } = await supabase
        .from('songs')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(4);

      if (recent) {
        setNewReleases((recent as SongWithProfile[]).map(song => ({
          ...song,
          creatorName: song.profiles?.username || 'Unknown'
        })));
      }

      setIsLoading(false);
    }
    loadMusic();
  }, []);

  const greeting = t('home.greeting');

  const quickAccessItems = useMemo(() => [
    { 
      title: t('home.quickAccess.favorites'), 
      icon: Heart, 
      color: "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500", 
      images: ["linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)"], 
      link: "#" 
    },
    { 
      title: 'Viral Charts', 
      icon: TrendingUp, 
      color: "bg-yellow-500", 
      images: ["linear-gradient(135deg, #eab308 0%, #a16207 100%)"], 
      link: "/charts/viral" 
    },
    { 
      title: t('home.quickAccess.artists'), 
      images: ["/kuenstler.jpeg", "/kuenstler2.jpeg", "/kuenstler3.jpeg", "/kuenstler4.jpeg"], 
      link: "#" 
    },
    { 
      title: t('home.quickAccess.playlists'), 
      icon: ListMusic, 
      color: "bg-teal-500", 
      images: ["linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)"], 
      link: "#" 
    },
    { 
      title: t('home.quickAccess.radio'), 
      icon: Radio, 
      color: "bg-orange-600", 
      images: ["linear-gradient(135deg, #ea580c 0%, #9a3412 100%)"], 
      link: "#" 
    }
  ], [t]);

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

  return (
    <div className="relative flex flex-col gap-10 pb-12 pt-6 min-h-screen">
      
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

      {/* Quick Access / Greeting Section */}
      <section className="px-8 relative z-10">
        <h1 className="text-3xl font-bold text-white mb-6 drop-shadow-md">{greeting}</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {quickAccessItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.link}
                className="group flex items-center bg-white/10 hover:bg-white/20 transition-colors rounded-md overflow-hidden cursor-pointer shadow-lg backdrop-blur-sm border border-white/5"
                onMouseEnter={() => {
                  setHoveredItem(item.title);
                  setSlideIndex(item.images && item.images.length > 1 ? 1 : 0);
                }}
                onMouseLeave={() => {
                  setHoveredItem(null);
                  setSlideIndex(0);
                }}
              >
                <div className={`w-16 h-16 shrink-0 relative shadow-md flex items-center justify-center ${item.color || 'bg-black'}`}>
                  {Icon ? (
                    <Icon 
                      className="w-8 h-8 text-white opacity-90 relative z-10" 
                      fill={item.title === "Lieblingssongs" ? "currentColor" : "none"}
                    />
                  ) : item.images ? (
                    <ImageSlideshow images={item.images} currentIndex={hoveredItem === item.title && item.images.length > 1 ? slideIndex : 0} />
                  ) : null}
                </div>
                <div className="flex-1 font-semibold text-white px-4 text-sm truncate drop-shadow-sm">
                  {item.title}
                </div>
                <div className="pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform">
                    <Play className="w-5 h-5 fill-current ml-1" />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Popular Genres Section */}
      <section className="px-8 relative z-10">
        <h2 className="text-2xl font-bold text-white mb-6">{t('home.popularGenres')}</h2>
        <div className="flex gap-4 overflow-x-auto py-4 px-4 -mx-4 no-scrollbar">
          {GENRES.map((genre) => {
            const Icon = genre.icon;
            return (
              <div 
                key={genre.name} 
                className={`min-w-[160px] h-28 rounded-xl p-4 flex flex-col justify-between shadow-lg cursor-pointer transition-transform hover:scale-105 ${genre.color}`}
              >
                <div className="w-full flex justify-end opacity-50">
                  <Icon className="w-8 h-8 text-white" strokeWidth={1.5} />
                </div>
                <span className="font-bold text-white text-lg">{genre.name}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trending Section */}
      <section className="px-8 relative z-10 min-h-[200px]">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-bold text-white hover:underline cursor-pointer">{t('home.trending')}</h2>
          <span className="text-sm font-bold text-muted hover:text-white transition-colors cursor-pointer">
            {t('home.seeAll')}
          </span>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {trendingSongs.map((song) => (
              <SongCard 
                key={`trending-${song.id}`} 
                song={song} 
                creatorName={song.creatorName} 
              />
            ))}
          </div>
        )}
      </section>

      {/* New Releases Section */}
      <section className="px-8 relative z-10 min-h-[200px]">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-bold text-white hover:underline cursor-pointer">{t('home.newReleases')}</h2>
          <span className="text-sm font-bold text-muted hover:text-white transition-colors cursor-pointer">
            {t('home.seeAll')}
          </span>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {newReleases.map((song) => (
              <SongCard 
                key={`new-${song.id}`} 
                song={song} 
                creatorName={song.creatorName} 
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
