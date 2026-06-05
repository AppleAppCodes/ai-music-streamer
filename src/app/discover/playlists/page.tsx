'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, ListMusic, Music, Search, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Playlist {
  id: string;
  title: string;
  description?: string | null;
  cover_url: string | null;
  created_at: string;
  profiles: {
    username: string;
  };
}

type PlaylistRow = Omit<Playlist, 'profiles'> & {
  profiles: Playlist['profiles'] | Playlist['profiles'][] | null;
};

const OFFICIAL_SIGNALS = ['yoriax', 'official', 'offiziell', 'kuratiert', 'curated', 'admin', 'david', 'heindavid'];

function getPlaylistCreator(playlist: Playlist): string {
  return playlist.profiles?.username || 'Unbekannt';
}

function isOfficialPlaylist(playlist: Playlist): boolean {
  const haystack = [
    playlist.title,
    playlist.description,
    getPlaylistCreator(playlist),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return OFFICIAL_SIGNALS.some((signal) => haystack.includes(signal));
}

export default function DiscoverPlaylistsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadPlaylists() {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('playlists')
        .select('*, profiles(username)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (searchQuery.trim() !== '') {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      const { data, error: playlistError } = await query;
      if (playlistError) {
        setPlaylists([]);
        setError(playlistError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setPlaylists(
          (data as PlaylistRow[]).map((playlist) => ({
            ...playlist,
            profiles: Array.isArray(playlist.profiles)
              ? playlist.profiles[0] || { username: 'Unbekannt' }
              : playlist.profiles || { username: 'Unbekannt' },
          }))
        );
      } else {
        setPlaylists([]);
      }
      setLoading(false);
    }
    
    // Add a small debounce for search
    const timer = setTimeout(() => {
      loadPlaylists();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [supabase, searchQuery]);

  const officialPlaylists = playlists.filter(isOfficialPlaylist);
  const communityPlaylists = playlists.filter((playlist) => !isOfficialPlaylist(playlist));
  const hasResults = playlists.length > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      {/* Background Gradient Header */}
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none z-0">
        <div className="w-full h-full bg-gradient-to-b from-indigo-900/20 via-[#0A0A0A]/80 to-[#0A0A0A]" />
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white md:left-8 md:top-8"
        aria-label="Zurück"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>

      <div className="relative pt-16 px-6 md:px-10 pb-6 z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <p className="text-sm text-white/50 uppercase tracking-wider font-semibold mb-1">Entdecke die Welt der KI-Musik</p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Playlists Entdecken</h1>
          </div>
          
          {/* Search Bar */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input 
              type="text"
              placeholder="Playlists durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
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
            <h2 className="text-2xl font-bold text-white mb-2">Playlists nicht verfügbar</h2>
            <p className="text-white/50 max-w-md">{error}</p>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Search className="w-12 h-12 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Keine Playlists gefunden</h2>
            <p className="text-white/50 max-w-md">
              Es gibt zurzeit keine öffentlichen Playlists, die deiner Suche entsprechen.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <PlaylistSection
              accent="teal"
              description="Von YORIAX kuratierte Sammlungen für schnelle Orientierung und neue Releases."
              emptyText="Noch keine kuratierten offiziellen Playlists gefunden."
              icon={<Sparkles className="h-5 w-5" />}
              playlists={officialPlaylists}
              title="Kuratierte offizielle Playlists"
            />
            <PlaylistSection
              accent="purple"
              description="Öffentliche Playlists aus der Community."
              emptyText="Noch keine Community Playlists gefunden."
              icon={<Users className="h-5 w-5" />}
              playlists={communityPlaylists}
              title="Community Playlists"
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
            {playlists.length} Playlists
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
  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className={`group relative flex flex-col gap-3 rounded-2xl border p-3.5 transition-all duration-300 hover:-translate-y-1 ${
        official
          ? 'border-teal-300/18 bg-gradient-to-br from-teal-300/[0.10] via-white/[0.035] to-primary/[0.08] hover:border-teal-200/35'
          : 'border-white/8 bg-white/[0.03] hover:border-primary/30 hover:bg-white/[0.075]'
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#282828] shadow-lg flex items-center justify-center">
        {playlist.cover_url ? (
          <img
            src={playlist.cover_url}
            alt={playlist.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
        <span className="mt-0.5 truncate text-xs font-semibold text-white/40">
          Von {getPlaylistCreator(playlist)}
        </span>
        {playlist.description ? (
          <span className="mt-2 line-clamp-2 text-xs leading-5 text-white/35">{playlist.description}</span>
        ) : (
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30">
            <ListMusic className="h-3.5 w-3.5" />
            Öffentliche Playlist
          </span>
        )}
      </div>
    </Link>
  );
}
