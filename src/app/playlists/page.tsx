'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Library, Music, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Playlist {
  id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
}

export default function PlaylistsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadPlaylists() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('playlists')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (data) setPlaylists(data);
      setLoading(false);
    }
    loadPlaylists();
  }, [supabase, router]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const newTitle = `Meine Playlist #${playlists.length + 1}`;
      const { data: newPlaylist, error } = await supabase
        .from('playlists')
        .insert({
          user_id: session.user.id,
          title: newTitle,
          is_public: false
        })
        .select()
        .single();

      if (error) throw error;
      if (newPlaylist) router.push(`/playlist/${newPlaylist.id}`);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Erstellen der Playlist.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none z-0">
        <div className="w-full h-full bg-gradient-to-b from-indigo-900/30 via-[#0A0A0A]/80 to-[#0A0A0A]" />
      </div>

      <div className="relative pt-16 px-6 md:px-10 pb-6 z-10">
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="text-sm text-white/50 uppercase tracking-wider font-semibold mb-1">Deine Bibliothek</p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Meine Playlists</h1>
          </div>
          <button 
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-gray-200 rounded-full font-bold transition-transform hover:scale-105 shadow-xl disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            Erstellen
          </button>
        </div>

        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Library className="w-12 h-12 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Noch keine Playlists</h2>
            <p className="text-white/50 max-w-md mb-8">
              Erstelle deine erste Playlist und fange an, deine Lieblingssongs zu sammeln.
            </p>
            <button 
              onClick={handleCreate}
              disabled={creating}
              className="px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-full font-bold transition-colors"
            >
              Playlist erstellen
            </button>
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
                    Von Dir
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
