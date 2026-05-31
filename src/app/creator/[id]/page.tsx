'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, Clock3, MoreHorizontal, UserPlus, BadgeCheck, Shuffle } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import { useTranslation } from 'react-i18next';
import LikeButton from '@/components/ui/LikeButton';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function CreatorPage() {
  const { t } = useTranslation();
  const params = useParams();
  const creatorId = params.id as string;
  
  const { playSong, currentSong, isPlaying, togglePlayPause } = usePlayer();
  const supabase = createClient();
  
  const [profile, setProfile] = useState<any>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCreatorData() {
      if (!creatorId) return;
      
      setLoading(true);
      
      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', creatorId)
        .single();
        
      if (profileData) {
        setProfile(profileData);
      }
      
      // 2. Fetch Popular Songs
      const { data: songsData } = await supabase
        .from('songs')
        .select('*')
        .eq('creator_id', creatorId)
        .order('plays', { ascending: false })
        .limit(10); // Top 10 like Spotify
        
      if (songsData) {
        setSongs(songsData as Song[]);
      }
      
      setLoading(false);
    }
    
    loadCreatorData();
  }, [creatorId, supabase]);

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    
    if (currentSong?.id === songs[0].id) {
      togglePlayPause();
    } else {
      const displayArtist = profile?.username || t('player.creatorFallback');
      const queue = songs.map(s => ({ ...s, creatorName: s.artist_name || displayArtist } as any));
      playSong(queue[0]);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A] text-white">
        <h1 className="text-3xl font-bold mb-2">Künstler nicht gefunden</h1>
        <p className="text-white/50">Das Profil konnte nicht geladen werden.</p>
      </div>
    );
  }

  const isAnyPlaying = songs.some(s => s.id === currentSong?.id) && isPlaying;
  
  // Calculate fake monthly listeners based on plays or randomly if not enough data
  const totalPlays = songs.reduce((sum, song) => sum + song.plays, 0);
  const monthlyListeners = totalPlays > 0 ? Math.floor(totalPlays * 0.42) + 500 : 54200;

  const displayArtist = profile?.username || t('player.creatorFallback');

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      {/* Background Gradient Header - Gray/Silver Glassmorphism for Artist */}
      <div 
        className="absolute top-0 left-0 right-0 h-[600px] bg-cover bg-center opacity-40 pointer-events-none transition-all duration-1000" 
        style={{ 
          backgroundImage: profile?.avatar_url 
            ? `url(${profile.avatar_url})` 
            : 'url(https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&q=80)',
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-black/20 via-[#0A0A0A]/60 to-[#0A0A0A] pointer-events-none" />
      
      {/* Hero Content */}
      <div className="relative pt-32 px-6 md:px-10 pb-8 flex flex-col justify-end min-h-[340px]">
        <div className="flex items-center gap-2 mb-2 text-sm text-white/90">
          <BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20" />
          <span>Verifizierter Künstler</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl mb-4 truncate w-full max-w-5xl">
          {displayArtist}
        </h1>
        
        <div className="text-base text-white/70 font-medium">
          {monthlyListeners.toLocaleString()} monatliche Hörer*innen
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative bg-[#0A0A0A] px-6 md:px-10 py-6 min-h-screen">
        
        {/* Action Bar */}
        <div className="flex items-center gap-6 mb-10">
          <button 
            onClick={handlePlayAll}
            disabled={songs.length === 0}
            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white hover:scale-105 transition-transform shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isAnyPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>
          
          <button className="text-white/40 hover:text-white transition-all hover:scale-110" title="Shuffle">
            <Shuffle className="w-7 h-7" />
          </button>
          
          <button className="flex items-center gap-2 px-4 py-1.5 border border-white/30 rounded-full text-white hover:border-white transition-colors text-sm font-bold uppercase tracking-wider">
            Folgen
          </button>
          
          <button className="text-white/40 hover:text-white transition-colors">
            <MoreHorizontal className="w-8 h-8" />
          </button>
        </div>

        {/* Popular Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Beliebt</h2>
          
          {songs.length > 0 ? (
            <div className="flex flex-col">
              {songs.map((song, index) => {
                const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
                
                return (
                  <div 
                    key={song.id}
                    onClick={() => {
                      if (currentSong?.id !== song.id) playSong({ ...song, creatorName: displayArtist } as any);
                    }}
                    className="grid grid-cols-[16px_1fr_120px_40px] md:grid-cols-[24px_1fr_150px_40px] gap-4 px-4 py-2 rounded-lg hover:bg-white/5 group cursor-pointer items-center transition-colors"
                  >
                    <div className="text-white/50 group-hover:text-white text-base font-mono">
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
                      <img src={song.cover_url} alt={song.title} className="w-10 h-10 object-cover rounded shadow-md" />
                      <span className={`text-base font-medium truncate ${currentSong?.id === song.id ? 'text-primary' : 'text-white/90'}`}>
                        {song.title}
                      </span>
                    </div>
                    
                    <div className="text-right text-sm text-white/50 tracking-wider flex items-center justify-end">
                      <div onClick={(e) => e.stopPropagation()}>
                        <LikeButton songId={song.id} iconClassName="w-5 h-5 mr-4" />
                      </div>
                      {song.plays.toLocaleString()}
                    </div>
                    
                    <div className="text-right text-sm text-white/50">
                      {formatDuration(song.duration)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-white/50">
              Dieser Künstler hat noch keine Songs hochgeladen.
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
