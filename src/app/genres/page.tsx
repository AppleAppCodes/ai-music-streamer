'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ChevronRight, LibraryBig } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GENRES } from '@/lib/constants';
import { createClient } from '@/utils/supabase/client';

interface GenreRow {
  genre: string | null;
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() || '';
}

export default function GenresPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<GenreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadGenreCounts = async () => {
      const { data, error } = await supabase.from('songs').select('genre');

      if (error) {
        console.error('Failed to load genre counts:', error);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    };

    loadGenreCounts();
  }, [supabase]);

  const counts = useMemo(() => {
    return rows.reduce((map, { genre }) => {
      const key = normalize(genre);
      if (key) map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map<string, number>());
  }, [rows]);

  return (
    <div className="relative min-h-full overflow-hidden bg-[#090909] px-4 pb-36 pt-8 sm:px-8 sm:pt-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-violet-700/20 via-purple-900/10 to-transparent" />
      <div className="pointer-events-none absolute -right-20 top-8 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-[110px]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-violet-300/80">
              <LibraryBig className="h-4 w-4" />
              {t('nav.discover')}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">{t('genresPage.title')}</h1>
            <p className="mt-3 max-w-xl text-sm text-white/50 sm:text-base">{t('genresPage.subtitle')}</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/5 bg-white/[0.04]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {GENRES.map((genre) => {
              const Icon = genre.icon;
              const songCount = counts.get(normalize(genre.name)) || 0;

              return (
                <Link
                  key={genre.name}
                  href={`/genre/${encodeURIComponent(genre.name)}`}
                  className={`group relative isolate flex h-36 flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-4 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_0_30px_var(--genre-glow)] sm:h-40 ${genre.color}`}
                  style={{ '--genre-glow': genre.glow } as CSSProperties}
                >
                  <div
                    className="pointer-events-none absolute -inset-8 -z-10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: `radial-gradient(circle at 70% 20%, ${genre.glow}, transparent 62%)` }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/25" />
                  <div className="relative flex items-start justify-between">
                    <Icon className="h-7 w-7 text-white/85" strokeWidth={1.7} />
                    <ChevronRight className="h-5 w-5 text-white/50 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                  </div>
                  <div className="relative">
                    <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">{genre.name}</h2>
                    <p className="mt-1 text-xs font-bold text-white/60">
                      {songCount} {t(songCount === 1 ? 'common.song' : 'common.songs')}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
