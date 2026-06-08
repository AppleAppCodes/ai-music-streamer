'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Music2 } from 'lucide-react';
import SongCard from '@/components/ui/SongCard';
import { GENRES } from '@/lib/constants';
import { Song } from '@/lib/types';
import { createClient } from '@/utils/supabase/client';

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() || '';
}

export default function GenrePage() {
  const params = useParams<{ name: string }>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const genreName = (params?.name as string) || '';
  const genre = useMemo(
    () => GENRES.find((item) => normalize(item.name) === normalize(genreName)),
    [genreName],
  );
  const Icon = genre?.icon || Music2;

  useEffect(() => {
    const loadSongs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .ilike('genre', genre?.name || genreName)
        .order('plays', { ascending: false });

      if (error) {
        console.error('Failed to load genre songs:', error);
        setSongs([]);
      } else {
        setSongs((data || []) as Song[]);
      }
      setLoading(false);
    };

    if (genreName) loadSongs();
  }, [genre?.name, genreName, supabase]);

  return (
    <div className="relative min-h-full overflow-hidden bg-[#090909] px-4 pb-36 pt-7 sm:px-8 sm:pt-10">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-25 ${genre?.color || 'bg-violet-700'}`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-gradient-to-b from-black/20 via-[#090909]/70 to-[#090909]" />

      <div className="relative mx-auto max-w-7xl">
        <Link href="/genres" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-white/55 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Alle Genres
        </Link>

        <div className="mb-10 flex items-center gap-4 sm:mb-12 sm:gap-6">
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/15 shadow-2xl sm:h-28 sm:w-28 ${genre?.color || 'bg-violet-700'}`}>
            <Icon className="h-10 w-10 text-white sm:h-14 sm:w-14" strokeWidth={1.6} />
          </div>
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-white/45">Genre</p>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">{genre?.name || genreName}</h1>
            <p className="mt-2 text-sm font-medium text-white/55">
              {songs.length} {songs.length === 1 ? 'Song' : 'Songs'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(160px,200px))]">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-white/5 bg-white/[0.03] p-2.5">
                <div className="aspect-square animate-pulse rounded-xl bg-white/10" />
                <div className="mt-4 h-4 w-4/5 animate-pulse rounded-full bg-white/10" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-white/5" />
              </div>
            ))}
          </div>
        ) : songs.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(160px,200px))]">
            {songs.map((song) => (
              <SongCard key={song.id} song={song} compact contextQueue={songs} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-14 text-center text-sm font-medium text-white/45">
            Für dieses Genre sind noch keine Songs hinterlegt.
          </div>
        )}
      </div>
    </div>
  );
}
