'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { ilikePattern } from '@/lib/searchPattern';
import Link from 'next/link';
import { Mic2, Music, Search } from 'lucide-react';
import Image from 'next/image';

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
  const supabase = useMemo(() => createClient(), []);
  const searchTimeoutRef = useRef<number | null>(null);

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

      const searchPattern = ilikePattern(trimmedQuery);
      const [
        { data: songsData },
        { data: playlistsData },
        { data: { session } },
      ] = await Promise.all([
        supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays')
          .or(`title.ilike.${searchPattern},artist_name.ilike.${searchPattern},genre.ilike.${searchPattern}`)
          .order('plays', { ascending: false })
          .limit(20),
        supabase
          .from('playlists')
          .select('id, title, cover_url, is_public, profiles(username)')
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

      setSongs((songsData || []) as unknown as SearchSong[]);
      setPlaylists((playlistsData || []) as unknown as PlaylistResult[]);
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
      <div className="yoriax-page flex min-h-screen flex-1 items-center justify-center">
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
          if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = window.setTimeout(() => {
            if (q.trim()) {
              router.replace(`/search?q=${encodeURIComponent(q.trim())}`);
            } else {
              router.replace(`/search`);
            }
          }, 300);
        }}
        className="yoriax-input block w-full rounded-full py-3 pl-12 pr-4 text-base placeholder-white/50"
        placeholder="Was möchtest du hören?"
      />
    </div>
  );

  if (!query) {
    return (
      <div className="yoriax-page flex min-h-screen flex-1 flex-col items-center p-6 pt-10 text-center">
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
    <div className="yoriax-page flex-1 overflow-y-auto pb-32">
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
                      className="yoriax-card-interactive group relative flex h-[240px] flex-col justify-end gap-4 overflow-hidden rounded-[1.75rem] p-6"
                    >
                      <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/35 to-accent/20 shadow-lg">
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
                    <Link href={isAuthenticated ? `/song/${songs[0].id}` : '/login'} className="yoriax-card-interactive group relative flex h-[240px] flex-col justify-end gap-4 overflow-hidden rounded-[1.75rem] p-6">
                      <div className="relative mb-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/35 to-accent/20 shadow-lg">
                        {songs[0].cover_url ? (
                          <Image src={songs[0].cover_url} alt={songs[0].title} fill sizes="96px" className="object-cover" />
                        ) : (
                          <Music className="w-12 h-12 text-white/20" />
                        )}
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
                          className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-transparent p-2 transition-colors hover:border-white/10 hover:bg-surface/70"
                        >
                          <div className="relative w-12 h-12 shrink-0 rounded overflow-hidden">
                            {song.cover_url ? (
                              <Image src={song.cover_url} alt={song.title} fill sizes="48px" className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-surface-hover">
                                <Music className="w-6 h-6 text-white/20" />
                              </div>
                            )}
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
                      className="yoriax-card-interactive group flex flex-col items-center gap-3 rounded-2xl p-4 text-center"
                    >
                      <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/35 to-accent/20 shadow-lg">
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
                      className="yoriax-card-interactive group relative flex flex-col gap-3 rounded-2xl p-3.5"
                    >
                      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-surface-hover shadow-lg">
                        {playlist.cover_url ? (
                          <Image
                            src={playlist.cover_url}
                            alt={playlist.title}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 150px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
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
      <div className="yoriax-page flex min-h-screen flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <SearchResults />
    </Suspense>
  );
}
