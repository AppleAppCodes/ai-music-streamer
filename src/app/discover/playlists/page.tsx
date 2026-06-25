'use client';

import useSWR from 'swr';

import type { ReactNode } from 'react';
import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, ListMusic, Music, Search, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';

interface Playlist {
  id: string;
  title: string;
  description?: string | null;
  cover_url: string | null;
  created_at: string;
  is_official: boolean;
  profiles: {
    username: string;
  };
}

type PlaylistRow = Omit<Playlist, 'profiles'> & {
  profiles: Playlist['profiles'] | Playlist['profiles'][] | null;
};

export default function DiscoverPlaylistsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchPlaylists = async (searchStr: string) => {
    let query = supabase
      .from('playlists')
      .select('id, title, description, cover_url, created_at, is_official, profiles(username)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (searchStr.trim() !== '') {
      query = query.ilike('title', `%${searchStr}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as PlaylistRow[];
  };

  const { data: swrData, error: swrError, isLoading } = useSWR(
    ['discover_playlists', debouncedSearchQuery],
    ([, query]) => fetchPlaylists(query as string),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  );

  const [prevSwrData, setPrevSwrData] = useState<unknown>(null);
  if (swrData !== prevSwrData) {
    setPrevSwrData(swrData);
    if (swrData) {
      const dbDailyNewReleases = swrData.find((playlist) => playlist.id === 'da114eeb-ecea-5e55-9ee1-ea5e5da11111');
      const fetchedPlaylists = swrData
        .filter((playlist) => playlist.id !== 'da114eeb-ecea-5e55-9ee1-ea5e5da11111')
        .map((playlist) => ({
          ...playlist,
          profiles: Array.isArray(playlist.profiles)
            ? playlist.profiles[0] || { username: 'Unbekannt' }
            : playlist.profiles || { username: 'Unbekannt' },
        }));
      
      // Inject dynamic 'Daily New Releases' playlist
      fetchedPlaylists.unshift({
        id: 'daily-new-releases',
        title: t('playlists.dailyNewReleases.title'),
        description: t('playlists.dailyNewReleases.description'),
        cover_url: dbDailyNewReleases?.cover_url || null,
        created_at: new Date().toISOString(),
        is_official: true,
        profiles: { username: 'YORIAX Team' }
      } as unknown as Playlist);
      
      setPlaylists(fetchedPlaylists);
      setError(null);
      setLoading(false);
    }
  } else if (swrError && loading) {
    setPlaylists([{
      id: 'daily-new-releases',
      title: t('playlists.dailyNewReleases.title'),
      description: t('playlists.dailyNewReleases.description'),
      cover_url: null,
      created_at: new Date().toISOString(),
      is_official: true,
      profiles: { username: 'YORIAX Team' }
    } as unknown as Playlist]);
    setError(swrError.message);
    setLoading(false);
  } else if (!swrData && !isLoading && loading) {
    setLoading(false);
  }

  const officialPlaylists = useMemo(() => playlists.filter((playlist) => playlist.is_official), [playlists]);
  const communityPlaylists = useMemo(() => playlists.filter((playlist) => !playlist.is_official), [playlists]);
  const hasResults = playlists.length > 0;

  return (
    <div className="yoriax-page flex-1 overflow-y-auto pb-32">
      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white md:left-8 md:top-8"
        aria-label={t('charts.back')}
      >
        <ArrowLeft className="h-6 w-6" />
      </button>

      <div className="relative pt-16 px-6 md:px-10 pb-6 z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <p className="text-sm text-white/50 uppercase tracking-wider font-semibold mb-1">{t('playlists.discoverEyebrow')}</p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{t('nav.discoverPlaylists')}</h1>
          </div>
          
          {/* Search Bar */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input 
              type="text"
              placeholder={t('playlists.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="yoriax-input w-full rounded-full py-2 pl-10 pr-4 text-sm placeholder:text-white/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <ListMusic className="w-12 h-12 text-red-200/60" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('playlists.unavailable')}</h2>
            <p className="text-white/50 max-w-md">{error}</p>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Search className="w-12 h-12 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('playlists.noResultsTitle')}</h2>
            <p className="text-white/50 max-w-md">
              {t('playlists.noResultsDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <PlaylistSection
              accent="teal"
              description={t('playlists.officialDesc')}
              emptyText={t('playlists.officialEmpty')}
              icon={<Sparkles className="h-5 w-5" />}
              playlists={officialPlaylists}
              title={t('playlists.officialTitle')}
            />
            <PlaylistSection
              accent="purple"
              description={t('playlists.communityDesc')}
              emptyText={t('playlists.communityEmpty')}
              icon={<Users className="h-5 w-5" />}
              playlists={communityPlaylists}
              title={t('playlists.communityTitle')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PlaylistSection({
  accent,
  description,
  emptyText,
  icon,
  playlists,
  title,
}: {
  accent: 'purple' | 'teal';
  description: string;
  emptyText: string;
  icon: ReactNode;
  playlists: Playlist[];
  title: string;
}) {
  const { t } = useTranslation();
  const accentClasses =
    accent === 'teal'
      ? 'border-teal-300/20 bg-teal-300/10 text-teal-200'
      : 'border-primary/25 bg-primary/10 text-primary';

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] ${accentClasses}`}>
            {icon}
            {t('playlists.playlistCount', { count: playlists.length })}
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-white/48">{description}</p>
        </div>
      </div>

      {playlists.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-8 text-sm font-semibold text-white/42">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} official={accent === 'teal'} />
          ))}
        </div>
      )}
    </section>
  );
}

function PlaylistCard({ official, playlist }: { official: boolean; playlist: Playlist }) {
  const { t } = useTranslation();
  const rawCreator = playlist.is_official ? 'YORIAX Team' : playlist.profiles?.username;
  const creatorName = rawCreator === 'Unbekannt' || !rawCreator ? t('guestHome.unknownArtist') : rawCreator;

  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className={`group relative flex flex-col gap-3 rounded-2xl border p-3.5 transition-all duration-300 hover:-translate-y-1 ${
        official
          ? 'border-teal-300/18 bg-gradient-to-br from-teal-300/[0.10] via-white/[0.035] to-primary/[0.08] hover:border-teal-200/35'
          : 'border-white/8 bg-white/[0.03] hover:border-primary/30 hover:bg-white/[0.075]'
      }`}
    >
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-surface-hover shadow-lg">
        {playlist.cover_url ? (
          <Image
            src={playlist.cover_url}
            alt={playlist.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 200px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (playlist.id === 'daily-new-releases' || playlist.id === 'da114eeb-ecea-5e55-9ee1-ea5e5da11111') ? (
          <Image
            src="/brand/yoriax-symbol.png"
            alt={playlist.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 200px"
            className="object-cover p-4 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <Music className="h-16 w-16 text-white/20" />
        )}
        {official ? (
          <div className="absolute left-2 top-2 rounded-full border border-teal-200/20 bg-black/50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-teal-100 backdrop-blur-md">
            Official
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold text-white">{playlist.title}</span>
        <span className="mt-0.5 truncate text-xs font-semibold text-white/40 flex items-center gap-1">
          {t('playlists.byCreator', { creator: creatorName })}
          {creatorName === 'YORIAX Team' && (
            <Image src="/brand/yoriax-symbol.png" alt="Official" width={12} height={12} className="inline-block" />
          )}
        </span>
        {playlist.description ? (
          <span className="mt-2 line-clamp-2 text-xs leading-5 text-white/35">{playlist.description}</span>
        ) : (
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30">
            <ListMusic className="h-3.5 w-3.5" />
            {t('playlists.publicPlaylist')}
          </span>
        )}
      </div>
    </Link>
  );
}
