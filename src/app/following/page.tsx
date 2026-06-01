'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, Music } from 'lucide-react';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import MobileSongMenu from '@/components/ui/MobileSongMenu';
import { usePlayer } from '@/lib/player-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ArtistWithSongs {
  name: string;
  followedAt: string;
  songs: Song[];
  coverImage: string | null; // use latest song cover or banner
}

export default function FollowingPage() {
  const supabase = createClient();
  const router = useRouter();
  const { playSong, currentSong, isPlaying, togglePlayPause } = usePlayer();

  const [loading, setLoading] = useState(true);
  const [artistsWithSongs, setArtistsWithSongs] = useState<ArtistWithSongs[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // 1. Get followed artists
      const { data: follows } = await supabase
        .from('follows')
        .select('artist_name, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!follows || follows.length === 0) {
        setArtistsWithSongs([]);
        setLoading(false);
        return;
      }

      // 2. For each artist, fetch their latest songs
      const artistNames = follows.map(f => f.artist_name);
      const { data: allSongs } = await supabase
        .from('songs')
        .select('*')
        .in('artist_name', artistNames)
        .order('created_at', { ascending: false });

      // 3. Group songs by artist
      const grouped: ArtistWithSongs[] = follows.map(f => {
        const songs = (allSongs || []).filter(
          s => s.artist_name?.toLowerCase() === f.artist_name.toLowerCase()
        ) as Song[];
        return {
          name: f.artist_name,
          followedAt: f.created_at,
          songs: songs.slice(0, 8), // Latest 8 per artist
          coverImage: songs.length > 0 ? songs[0].cover_url : null,
        };
      });

      setArtistsWithSongs(grouped);
      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      {/* Background */}
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none z-0">
        <div className="w-full h-full bg-gradient-to-b from-emerald-900/30 via-[#0A0A0A]/80 to-[#0A0A0A]" />
      </div>

      {/* Header */}
      <div className="relative pt-16 px-6 md:px-10 pb-6 z-10">
        <p className="text-sm text-white/50 uppercase tracking-wider font-semibold mb-1">Dein Feed</p>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Folge ich</h1>
      </div>

      {/* Content */}
      <div className="relative px-6 md:px-10 z-10">

        {artistsWithSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Music className="w-12 h-12 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Noch keine Künstler</h2>
            <p className="text-white/50 max-w-md">
              Folge Künstlern, die dir gefallen, um hier ihre neusten Releases zu sehen.
            </p>
            <Link href="/charts/viral" className="mt-6 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-full font-bold transition-colors">
              Charts entdecken
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Per-Artist Sections */}
            {artistsWithSongs.map((artist) => (
              <section key={artist.name}>
                {/* Artist Section Header */}
                <div className="flex items-center justify-between mb-5">
                  <Link
                    href={`/artist/${encodeURIComponent(artist.name)}`}
                    className="group"
                  >
                    <h2 className="text-2xl font-bold text-white group-hover:underline">{artist.name}</h2>
                  </Link>
                  <Link
                    href={`/artist/${encodeURIComponent(artist.name)}`}
                    className="text-sm font-bold text-white/50 hover:text-white transition-colors uppercase tracking-wider"
                  >
                    Alle anzeigen
                  </Link>
                </div>

                {/* Song Cards Grid */}
                {artist.songs.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                    {artist.songs.map((song) => {
                      const isThisSongPlaying = currentSong?.id === song.id && isPlaying;

                      return (
                        <div
                          key={song.id}
                          className="group relative flex flex-col gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] transition-all duration-300 cursor-pointer"
                        >
                          {/* Cover */}
                          <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-lg">
                            <img
                              src={song.cover_url}
                              alt={song.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            {/* Play overlay */}
                            <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisSongPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (currentSong?.id === song.id) {
                                    togglePlayPause();
                                  } else {
                                    playSong({ ...song, creatorName: artist.name });
                                  }
                                }}
                                className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-xl hover:scale-110 hover:bg-primary-hover transition-all translate-y-2 group-hover:translate-y-0"
                              >
                                {isThisSongPlaying ? (
                                  <Pause className="w-5 h-5 fill-current" />
                                ) : (
                                  <Play className="w-5 h-5 fill-current" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col min-w-0 flex-1">
                              <Link
                                href={`/song/${song.id}`}
                                className="text-sm font-semibold text-white truncate hover:underline"
                              >
                                {song.title}
                              </Link>
                              <span className="text-xs text-white/40 truncate mt-0.5">
                                {song.genre || 'Single'}
                              </span>
                            </div>
                            <div className="-mt-1 -mr-2">
                              <MobileSongMenu song={song} />
                            </div>
                          </div>
                          <div className="absolute top-3 right-3 hidden opacity-0 group-hover:opacity-100 transition-opacity md:flex items-center gap-2">
                            <PlaylistAddButton songId={song.id} iconClassName="w-4 h-4" className="bg-black/50 p-1.5 rounded-full hover:bg-black/80" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-white/30 text-sm">Noch keine Veröffentlichungen.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
