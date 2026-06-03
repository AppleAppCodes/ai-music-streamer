'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Music, Search } from 'lucide-react';
import Link from 'next/link';

interface Playlist {
  id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
  profiles: {
    username: string;
  };
}

type PlaylistRow = Omit<Playlist, 'profiles'> & {
  profiles: Playlist['profiles'] | Playlist['profiles'][] | null;
};

export default function DiscoverPlaylistsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadPlaylists() {
      let query = supabase
        .from('playlists')
        .select('*, profiles(username)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (searchQuery.trim() !== '') {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      const { data } = await query;
      if (data) {
        setPlaylists(
          (data as PlaylistRow[]).map((playlist) => ({
            ...playlist,
            profiles: Array.isArray(playlist.profiles)
              ? playlist.profiles[0] || { username: 'Unbekannt' }
              : playlist.profiles || { username: 'Unbekannt' },
          }))
        );
      }
      setLoading(false);
    }
    
    // Add a small debounce for search
    const timer = setTimeout(() => {
      loadPlaylists();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [supabase, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      {/* Background Gradient Header */}
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none z-0">
        <div className="w-full h-full bg-gradient-to-b from-indigo-900/20 via-[#0A0A0A]/80 to-[#0A0A0A]" />
      </div>

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
        ) : playlists.length === 0 ? (
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
        )}
      </div>
    </div>
  );
}
