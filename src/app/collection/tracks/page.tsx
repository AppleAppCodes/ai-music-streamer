'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, Clock3, Heart } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import { useTranslation } from 'react-i18next';
import LikeButton from '@/components/ui/LikeButton';
import { useRouter } from 'next/navigation';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function LikedSongsPage() {
  const { t } = useTranslation();
  const { playSong, currentSong, isPlaying, togglePlayPause } = usePlayer();
  const router = useRouter();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const supabase = createClient();

  useEffect(() => {
    const fetchLikedSongs = async () => {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);
      
      // Fetch liked songs joined with songs table
      const { data, error } = await supabase
        .from('liked_songs')
        .select(`
          created_at,
          songs (*)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
        
      if (data) {
        // Extract the actual song objects and filter out any nulls if a song was deleted
        const validSongs = data
          .map(item => item.songs as unknown as Song)
          .filter(song => song !== null);
          
        setSongs(validSongs);
      }
      
      setLoading(false);
    };

    fetchLikedSongs();
  }, [supabase, router]);

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    
    // Check if the first liked song is already playing
    if (currentSong?.id === songs[0].id) {
      togglePlayPause();
    } else {
      // Create a queue from all liked songs
      const queue = songs.map(s => ({ ...s, creatorName: s.artist_name || t('player.creatorFallback') } as any));
      playSong(queue[0]);
      // setQueue(queue) - If we implement setQueue in context later. For now, it just plays the first.
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isAnyPlaying = songs.some(s => s.id === currentSong?.id) && isPlaying;

  return (
    <div className="flex-1 overflow-y-auto bg-[#121212] relative pb-32">
      {/* Background Gradient Header - Deep Purple/Indigo like Spotify */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#4A148C] to-[#121212] opacity-80 pointer-events-none" />
      
      {/* Header Content */}
      <div className="relative pt-24 px-6 md:px-10 pb-6 flex flex-col md:flex-row gap-6 md:gap-8 items-end">
        <div className="w-48 h-48 md:w-60 md:h-60 flex-shrink-0 shadow-2xl shadow-black/50 overflow-hidden rounded-md bg-gradient-to-br from-[#5E35B1] to-[#D81B60] flex items-center justify-center">
          <Heart className="w-24 h-24 text-white fill-white shadow-lg" />
        </div>
        <div className="flex flex-col gap-2 md:gap-4 mt-4 md:mt-0">
          <span className="text-sm font-semibold text-white/90 drop-shadow-md tracking-wider uppercase">
            Playlist
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tighter drop-shadow-lg break-words">
            Liked Songs
          </h1>
          <div className="flex items-center gap-2 text-sm text-white/90 mt-2 font-medium">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
              <span className="text-xs">{user?.email?.charAt(0).toUpperCase()}</span>
            </div>
            <span className="font-bold">{user?.email?.split('@')[0]}</span>
            <span>•</span>
            <span>{songs.length} {songs.length === 1 ? 'song' : 'songs'}</span>
          </div>
        </div>
      </div>

      {/* Background overlay for lower section */}
      <div className="relative bg-black/20 backdrop-blur-3xl px-6 md:px-10 py-6 min-h-screen">
        
        {/* Action Bar */}
        <div className="flex items-center gap-6 mb-10">
          <button 
            onClick={handlePlayAll}
            disabled={songs.length === 0}
            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-black hover:scale-105 hover:bg-primary-hover transition-all shadow-xl disabled:opacity-50 disabled:hover:scale-100"
          >
            {isAnyPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>
        </div>

        {/* Tracklist Table */}
        {songs.length > 0 ? (
          <div className="mb-16">
            {/* Table Header */}
            <div className="grid grid-cols-[16px_1fr_120px_40px] md:grid-cols-[16px_1fr_150px_40px] gap-4 px-4 py-2 border-b border-white/10 text-sm text-white/60 mb-2">
              <div>#</div>
              <div>{t('song.title')}</div>
              <div className="text-right">{t('song.plays')}</div>
              <div className="flex justify-end"><Clock3 className="w-4 h-4" /></div>
            </div>
            
            {/* Track Rows */}
            {songs.map((song, index) => {
              const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
              const displayArtist = song.artist_name || t('player.creatorFallback');
              
              return (
                <div 
                  key={song.id}
                  onClick={() => {
                    if (currentSong?.id !== song.id) playSong({ ...song, creatorName: displayArtist } as any);
                  }}
                  className="grid grid-cols-[16px_1fr_120px_40px] md:grid-cols-[16px_1fr_150px_40px] gap-4 px-4 py-3 rounded-md hover:bg-white/10 group cursor-pointer items-center transition-colors"
                >
                  <div className="text-white/60 group-hover:text-white text-base">
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
                  
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img src={song.cover_url} alt={song.title} className="w-10 h-10 object-cover rounded" />
                    <div className="flex flex-col truncate">
                      <span className={`text-base font-normal truncate ${currentSong?.id === song.id ? 'text-primary' : 'text-white'}`}>
                        {song.title}
                      </span>
                      <span className="text-sm text-white/60 truncate">{displayArtist}</span>
                    </div>
                  </div>
                  
                  <div className="text-right text-sm text-white/60 font-mono tracking-wider flex items-center justify-end">
                    <div onClick={(e) => e.stopPropagation()}>
                      <LikeButton songId={song.id} iconClassName="w-5 h-5 mr-4" />
                    </div>
                    {song.plays.toLocaleString()}
                  </div>
                  
                  <div className="text-right text-sm text-white/60">
                    {formatDuration(song.duration)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart className="w-16 h-16 text-white/20 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Songs you like will appear here</h2>
            <p className="text-white/60">Save songs by tapping the heart icon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
