'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, UserCheck, Clock3, Music } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LikeButton from '@/components/ui/LikeButton';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays < 7) return `vor ${diffDays} ${diffDays === 1 ? 'Tag' : 'Tagen'}`;
  if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface FollowedArtist {
  artist_name: string;
  created_at: string;
}

export default function FollowingPage() {
  const supabase = createClient();
  const router = useRouter();
  const { playSong, currentSong, isPlaying, togglePlayPause } = usePlayer();

  const [loading, setLoading] = useState(true);
  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>([]);
  const [latestSongs, setLatestSongs] = useState<Song[]>([]);

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
        setFollowedArtists([]);
        setLatestSongs([]);
        setLoading(false);
        return;
      }

      setFollowedArtists(follows);

      // 2. Get latest songs from all followed artists
      const artistNames = follows.map(f => f.artist_name);
      const { data: songs } = await supabase
        .from('songs')
        .select('*')
        .in('artist_name', artistNames)
        .order('created_at', { ascending: false })
        .limit(50);

      if (songs) {
        setLatestSongs(songs as Song[]);
      }

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
        <div className="w-full h-full bg-gradient-to-b from-emerald-900/40 via-[#0A0A0A]/80 to-[#0A0A0A]" />
      </div>

      {/* Header */}
      <div className="relative pt-20 px-6 md:px-10 pb-8 z-10">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <UserCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-sm text-white/50 uppercase tracking-wider font-semibold">Dein Feed</p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Folge ich</h1>
          </div>
        </div>
        <p className="text-white/50 mt-3">
          Die neusten Releases der Künstler, denen du folgst
        </p>
      </div>

      {/* Content */}
      <div className="relative px-6 md:px-10 z-10">

        {followedArtists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Music className="w-12 h-12 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Noch keine Künstler</h2>
            <p className="text-white/50 max-w-md">
              Folge Künstlern, die dir gefallen, um hier ihre neusten Releases zu sehen. 
              Geh auf eine Künstlerseite und klicke auf &quot;Folgen&quot;!
            </p>
            <Link href="/charts/viral" className="mt-6 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-full font-bold transition-colors">
              Charts entdecken
            </Link>
          </div>
        ) : (
          <>
            {/* Followed Artists Chips */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-white mb-4">Deine Künstler ({followedArtists.length})</h2>
              <div className="flex flex-wrap gap-3">
                {followedArtists.map((artist) => (
                  <Link
                    key={artist.artist_name}
                    href={`/artist/${encodeURIComponent(artist.artist_name)}`}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-4 py-2 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xs font-bold text-white">
                      {artist.artist_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white/80 group-hover:text-white">{artist.artist_name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Latest Releases */}
            <div className="mb-12">
              <h2 className="text-lg font-bold text-white mb-4">Neueste Releases</h2>

              {latestSongs.length > 0 ? (
                <div className="flex flex-col">
                  {/* Table Header */}
                  <div className="grid grid-cols-[16px_1fr_150px_80px_40px] gap-4 px-4 py-2 border-b border-white/10 text-xs text-white/40 uppercase tracking-wider mb-1">
                    <div>#</div>
                    <div>Titel</div>
                    <div className="text-right">Hinzugefügt</div>
                    <div className="text-right">Streams</div>
                    <div className="flex justify-end"><Clock3 className="w-3.5 h-3.5" /></div>
                  </div>

                  {latestSongs.map((song, index) => {
                    const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
                    const displayArtist = song.artist_name || 'Unbekannt';

                    return (
                      <div
                        key={song.id}
                        onClick={() => {
                          if (currentSong?.id !== song.id) playSong({ ...song, creatorName: displayArtist } as any);
                          else togglePlayPause();
                        }}
                        className="grid grid-cols-[16px_1fr_150px_80px_40px] gap-4 px-4 py-2.5 rounded-lg hover:bg-white/5 group cursor-pointer items-center transition-colors"
                      >
                        {/* Number / Playing indicator */}
                        <div className="text-white/40 group-hover:text-white text-sm font-mono">
                          {isThisSongPlaying ? (
                            <div className="w-4 h-4 flex items-end justify-between">
                              <div className="w-1 bg-primary h-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-1 bg-primary h-2/3 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-1 bg-primary h-4/5 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                          ) : (
                            <span className="group-hover:hidden">{index + 1}</span>
                          )}
                          {!isThisSongPlaying && <Play className="w-4 h-4 hidden group-hover:block fill-current" />}
                        </div>

                        {/* Song info */}
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img src={song.cover_url} alt={song.title} className="w-10 h-10 object-cover rounded shadow-md flex-shrink-0" />
                          <div className="flex flex-col overflow-hidden">
                            <span className={`text-sm font-medium truncate ${currentSong?.id === song.id ? 'text-primary' : 'text-white/90'}`}>
                              {song.title}
                            </span>
                            <Link 
                              href={`/artist/${encodeURIComponent(displayArtist)}`} 
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-white/40 truncate hover:text-white hover:underline"
                            >
                              {displayArtist}
                            </Link>
                          </div>
                          <div className="ml-auto flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <LikeButton songId={song.id} iconClassName="w-4 h-4" />
                          </div>
                        </div>

                        {/* Added */}
                        <div className="text-right text-xs text-white/40">
                          {timeAgo(song.created_at)}
                        </div>

                        {/* Plays */}
                        <div className="text-right text-xs text-white/40">
                          {song.plays.toLocaleString('de-DE')}
                        </div>

                        {/* Duration */}
                        <div className="text-right text-xs text-white/40">
                          {formatDuration(song.duration)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-white/40">Deine Künstler haben noch keine Songs veröffentlicht.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
