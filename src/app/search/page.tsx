'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import SongCard from '@/components/ui/SongCard';
import Link from 'next/link';
import { Library, Mic2, Music, Search } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';

interface PlaylistResult {
  id: string;
  title: string;
  cover_url: string | null;
  profiles: { username: string };
}

interface ArtistResult {
  artist_name: string;
}

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const supabase = createClient();
  const { setQueue } = usePlayer();

  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistResult[]>([]);
  const [artists, setArtists] = useState<ArtistResult[]>([]);

  useEffect(() => {
    async function performSearch() {
      if (!query.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Search Songs (title or artist name)
      const { data: songsData } = await supabase
        .from('songs')
        .select('*, profiles(username)')
        .or(`title.ilike.%${query}%,artist_name.ilike.%${query}%`)
        .order('plays', { ascending: false })
        .limit(20);

      // Search Playlists
      const { data: playlistsData } = await supabase
        .from('playlists')
        .select('*, profiles(username)')
        .eq('is_public', true)
        .ilike('title', `%${query}%`)
        .limit(10);

      // Extract unique artists from the searched songs (simple simulation for artist search)
      const uniqueArtists = Array.from(new Set(
        (songsData || [])
          .filter(s => s.artist_name && s.artist_name.toLowerCase().includes(query.toLowerCase()))
          .map(s => s.artist_name)
      )).map(name => ({ artist_name: name }));

      setSongs(songsData as any[] || []);
      setPlaylists(playlistsData as any[] || []);
      setArtists(uniqueArtists);
      setLoading(false);
    }

    performSearch();
  }, [query, supabase]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A] p-6 text-center">
        <Search className="w-16 h-16 text-white/20 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Suche nach Inhalten</h1>
        <p className="text-white/50 max-w-md">Tippe etwas in die Suchleiste im Header ein, um nach Songs, Künstlern oder Playlists zu suchen.</p>
      </div>
    );
  }

  const hasNoResults = songs.length === 0 && playlists.length === 0 && artists.length === 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      <div className="relative pt-10 px-6 md:px-10 pb-6 z-10">
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-8">
          Ergebnisse für "{query}"
        </h1>

        {hasNoResults ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search className="w-16 h-16 text-white/10 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Nichts gefunden</h2>
            <p className="text-white/50">Für deine Suche nach "{query}" gibt es leider keine Treffer.</p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* Top Artists Result */}
            {artists.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6">Künstler</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {artists.slice(0, 5).map((artist, i) => (
                    <Link
                      key={i}
                      href={`/artist/${encodeURIComponent(artist.artist_name)}`}
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

            {/* Songs Result */}
            {songs.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6">Songs</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {songs.map((song) => (
                    <SongCard 
                      key={song.id} 
                      song={song} 
                      contextQueue={songs}
                    />
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
                      href={`/playlist/${playlist.id}`}
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
