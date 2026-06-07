'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import Link from 'next/link';
import { Mic2, Music, Search } from 'lucide-react';

interface PlaylistResult {
  id: string;
  title: string;
  cover_url: string | null;
  profiles: { username: string };
}

interface ArtistResult {
  artist_name: string;
}

type SearchSong = Pick<Song, 'id' | 'title' | 'artist_name' | 'cover_url' | 'plays'>;

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams?.get('q') || '';
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<SearchSong[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistResult[]>([]);
  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function performSearch() {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        setSongs([]);
        setPlaylists([]);
        setArtists([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const [
        { data: songsData },
        { data: playlistsData },
        { data: { session } },
      ] = await Promise.all([
        supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays')
          .or(`title.ilike.%${trimmedQuery}%,artist_name.ilike.%${trimmedQuery}%`)
          .order('plays', { ascending: false })
          .limit(20),
        supabase
          .from('playlists')
          .select('*, profiles(username)')
          .eq('is_public', true)
          .ilike('title', `%${trimmedQuery}%`)
          .limit(10),
        supabase.auth.getSession(),
      ]);

      if (!isActive) return;

      // Extract unique artists from the searched songs (simple simulation for artist search)
      const uniqueArtists = Array.from(new Set(
        (songsData || [])
          .filter(s => s.artist_name && s.artist_name.toLowerCase().includes(trimmedQuery.toLowerCase()))
          .map(s => s.artist_name)
      )).map(name => ({ artist_name: name }));

      setSongs((songsData || []) as SearchSong[]);
      setPlaylists((playlistsData || []) as PlaylistResult[]);
      setArtists(uniqueArtists);
      setIsAuthenticated(!!session);
      setLoading(false);
    }

    performSearch();
    return () => {
      isActive = false;
    };
  }, [query, supabase]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const searchInput = (
    <div className="md:hidden relative w-full mb-8">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-white/60" />
      </div>
      <input
        type="text"
        defaultValue={query}
        autoFocus
        onChange={(e) => {
          const q = e.target.value;
          if (q.trim()) {
            router.replace(`/search?q=${encodeURIComponent(q.trim())}`);
          } else {
            router.replace(`/search`);
          }
        }}
        className="block w-full rounded-full border border-white/10 bg-white/10 py-3 pl-12 pr-4 text-base text-white placeholder-white/50 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all"
        placeholder="Was möchtest du hören?"
      />
    </div>
  );

  if (!query) {
    return (
      <div className="flex-1 flex flex-col items-center min-h-screen bg-[#0A0A0A] p-6 pt-10 text-center">
        {searchInput}
        <div className="flex-1 flex flex-col items-center justify-center -mt-20">
          <Search className="w-16 h-16 text-white/20 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Suche nach Inhalten</h1>
          <p className="text-white/50 max-w-md hidden md:block">Tippe etwas in die Suchleiste im Header ein, um nach Songs, Künstlern oder Playlists zu suchen.</p>
          <p className="text-white/50 max-w-md md:hidden">Benutze die Suchleiste oben, um nach Songs, Künstlern oder Playlists zu suchen.</p>
        </div>
      </div>
    );
  }

  const hasNoResults = songs.length === 0 && playlists.length === 0 && artists.length === 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      <div className="relative pt-6 md:pt-10 px-6 md:px-10 pb-6 z-10">
        {searchInput}
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-8">
          Ergebnisse für &quot;{query}&quot;
        </h1>

        {hasNoResults ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search className="w-16 h-16 text-white/10 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Nichts gefunden</h2>
            <p className="text-white/50">Für deine Suche nach &quot;{query}&quot; gibt es leider keine Treffer.</p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* Top Result & Songs Split Layout */}
            <div className="flex flex-col lg:flex-row gap-8 mb-12">
              
              {/* Left Side: Top Result */}
              {(artists.length > 0 || songs.length > 0) && (
                <section className="lg:w-2/5">
                  <h2 className="text-2xl font-bold text-white mb-6">Top-Ergebnis</h2>
                  {artists.length > 0 ? (
                    <Link
                      href={isAuthenticated ? `/artist/${encodeURIComponent(artists[0].artist_name)}` : '/login'}
                      className="group flex flex-col gap-4 p-6 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-all duration-300 relative overflow-hidden h-[240px] justify-end"
                    >
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center shadow-lg mb-2">
                        <Mic2 className="w-12 h-12 text-white/50" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-3xl font-black text-white truncate">{artists[0].artist_name}</span>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-white/10 text-white text-sm font-bold px-3 py-1 rounded-full">Künstler</span>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <Link href={isAuthenticated ? `/song/${songs[0].id}` : '/login'} className="group flex flex-col gap-4 p-6 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-all duration-300 relative overflow-hidden h-[240px] justify-end">
                      <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center shadow-lg overflow-hidden mb-2">
                        <img src={songs[0].cover_url} alt={songs[0].title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-3xl font-black text-white truncate">{songs[0].title}</span>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-white/60 text-sm font-semibold">{songs[0].artist_name}</span>
                          <span className="bg-white/10 text-white text-xs font-bold px-3 py-1 rounded-full">Song</span>
                        </div>
                      </div>
                    </Link>
                  )}
                </section>
              )}

              {/* Right Side: Songs List */}
              {songs.length > 0 && (
                <section className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-6">Songs</h2>
                  <div className="flex flex-col gap-1">
                    {songs.slice(0, 4).map((song) => {
                      return (
                        <Link 
                          href={isAuthenticated ? `/song/${song.id}` : '/login'}
                          key={song.id}
                          className="flex items-center gap-4 p-2 rounded-md hover:bg-white/10 group cursor-pointer transition-colors"
                        >
                          <div className="relative w-12 h-12 shrink-0 rounded overflow-hidden">
                            <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-base font-semibold truncate text-white">{song.title}</span>
                            <span className="text-sm text-white/60 truncate">{song.artist_name}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* Other Artists Row (if more than 1) */}
            {artists.length > 1 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6">Weitere Künstler</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {artists.slice(1, 7).map((artist, i) => (
                    <Link
                      key={i}
                      href={isAuthenticated ? `/artist/${encodeURIComponent(artist.artist_name)}` : '/login'}
                      className="group flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] transition-all duration-300"
                    >
                      <div className="w-full aspect-square rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-2 shadow-lg">
                        <Mic2 className="w-12 h-12 text-white/50" />
                      </div>
                      <span className="font-bold text-white truncate w-full">{artist.artist_name}</span>
                      <span className="text-xs text-white/50">Künstler</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Playlists Result */}
            {playlists.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6">Playlists</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {playlists.map((playlist) => (
                    <Link
                      key={playlist.id}
                      href={isAuthenticated ? `/playlist/${playlist.id}` : '/login'}
                      className="group relative flex flex-col gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] transition-all duration-300"
                    >
                      <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-lg bg-[#282828] flex items-center justify-center">
                        {playlist.cover_url ? (
                          <img
                            src={playlist.cover_url}
                            alt={playlist.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <Music className="w-16 h-16 text-white/20" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white truncate">{playlist.title}</span>
                        <span className="text-xs text-white/40 truncate mt-0.5">
                          Von {playlist.profiles?.username || 'Unbekannt'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <SearchResults />
    </Suspense>
  );
}
