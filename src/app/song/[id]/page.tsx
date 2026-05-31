'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, Heart, MoreHorizontal, Clock3, Download } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import { useTranslation } from 'react-i18next';
import SongCard from '@/components/ui/SongCard';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function SongDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { t } = useTranslation();
  const { playSong, currentSong, isPlaying, togglePlayPause } = usePlayer();
  
  const [song, setSong] = useState<Song | null>(null);
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!id) return;

    const fetchSongDetails = async () => {
      setLoading(true);
      
      // Fetch the main song
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('id', id)
        .single();
        
      if (songData) {
        setSong(songData);
        
        // Fetch related songs by the same artist
        const artistName = songData.artist_name || 'Creator';
        const { data: relatedData } = await supabase
          .from('songs')
          .select('*')
          .eq('artist_name', artistName)
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (relatedData) {
          setRelatedSongs(relatedData);
        }
      }
      
      setLoading(false);
    };

    fetchSongDetails();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <h1 className="text-2xl text-white">Song not found</h1>
      </div>
    );
  }

  const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
  const displayArtist = song.artist_name || t('player.creatorFallback');
  const releaseYear = new Date(song.created_at).getFullYear();
  const durationText = formatDuration(song.duration);

  return (
    <div className="flex-1 overflow-y-auto bg-[#121212] relative pb-32">
      {/* Background Gradient Header */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#4A2B29] to-[#121212] opacity-80 pointer-events-none" />
      
      {/* Header Content */}
      <div className="relative pt-24 px-6 md:px-10 pb-6 flex flex-col md:flex-row gap-6 md:gap-8 items-end">
        <div className="w-48 h-48 md:w-60 md:h-60 flex-shrink-0 shadow-2xl shadow-black/50 overflow-hidden rounded-md">
          <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-2 md:gap-4 mt-4 md:mt-0">
          <span className="text-sm font-semibold text-white/90 drop-shadow-md tracking-wider uppercase">
            {t('song.single')}
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tighter drop-shadow-lg break-words">
            {song.title}
          </h1>
          <div className="flex items-center gap-2 text-sm text-white/90 mt-2 font-medium">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
              <span className="text-xs">{displayArtist.charAt(0)}</span>
            </div>
            <span className="hover:underline cursor-pointer font-bold">{displayArtist}</span>
            <span>•</span>
            <span>{releaseYear}</span>
            <span>•</span>
            <span>{t('song.songCount', { count: 1 })}</span>
            {song.duration && (
              <>
                <span>•</span>
                <span>{durationText}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Background overlay for lower section */}
      <div className="relative bg-black/20 backdrop-blur-3xl px-6 md:px-10 py-6 min-h-screen">
        
        {/* Action Bar */}
        <div className="flex items-center gap-6 mb-10">
          <button 
            onClick={() => {
              if (currentSong?.id === song.id) {
                togglePlayPause();
              } else {
                playSong({ ...song, creatorName: displayArtist } as any);
              }
            }}
            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-black hover:scale-105 hover:bg-primary-hover transition-all shadow-xl"
          >
            {isThisSongPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>
          
          <button className="text-white/60 hover:text-white transition-colors">
            <Heart className="w-8 h-8" />
          </button>
          
          <button className="text-white/60 hover:text-white transition-colors">
            <Download className="w-8 h-8" />
          </button>

          <button className="text-white/60 hover:text-white transition-colors">
            <MoreHorizontal className="w-8 h-8" />
          </button>
        </div>

        {/* Tracklist Table */}
        <div className="mb-16">
          {/* Table Header */}
          <div className="grid grid-cols-[16px_1fr_120px_40px] md:grid-cols-[16px_1fr_150px_40px] gap-4 px-4 py-2 border-b border-white/10 text-sm text-white/60 mb-2">
            <div>#</div>
            <div>{t('song.title')}</div>
            <div className="text-right">{t('song.plays')}</div>
            <div className="flex justify-end"><Clock3 className="w-4 h-4" /></div>
          </div>
          
          {/* Track Row */}
          <div 
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
                <span className="group-hover:hidden">1</span>
              )}
              {!isThisSongPlaying && <Play className="w-4 h-4 hidden group-hover:block fill-current" />}
            </div>
            
            <div className="flex flex-col">
              <span className={`text-base font-normal ${currentSong?.id === song.id ? 'text-primary' : 'text-white'}`}>
                {song.title}
              </span>
              <span className="text-sm text-white/60">{displayArtist}</span>
            </div>
            
            <div className="text-right text-sm text-white/60 font-mono tracking-wider">
              {song.plays.toLocaleString()}
            </div>
            
            <div className="text-right text-sm text-white/60">
              {durationText}
            </div>
          </div>
        </div>

        {/* More By Artist */}
        {relatedSongs.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">
              {t('song.moreBy', { artist: displayArtist })}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {relatedSongs.map(related => (
                <SongCard key={related.id} song={related} creatorName={displayArtist} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
