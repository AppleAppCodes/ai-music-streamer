'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, MoreHorizontal, UserPlus, UserCheck, BadgeCheck, Shuffle, Edit2, Loader2 } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import LikeButton from '@/components/ui/LikeButton';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import { getErrorMessage } from '@/lib/errors';
import type { User as SupabaseUser } from '@supabase/supabase-js';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ArtistPage() {
  const params = useParams();
  const router = useRouter();
  // Ensure we decode the URL encoded name properly
  const artistName = decodeURIComponent(params.name as string);
  
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue } = usePlayer();
  const supabase = createClient();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadArtistData() {
      if (!artistName) return;
      
      setLoading(true);
      
      // Get current user to see if they are admin
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      // 1. Fetch Popular Songs by exactly this artist name
      const { data: songsData } = await supabase
        .from('songs')
        .select('*')
        .ilike('artist_name', artistName)
        .order('plays', { ascending: false })
        .limit(10); // Top 10
        
      if (songsData) {
        setSongs(songsData as Song[]);
      }
      
      // 2. Check if a custom banner exists
      const sanitizedName = artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const { data: files } = await supabase.storage
        .from('covers')
        .list('banners', {
          search: sanitizedName
        });
        
      if (files && files.length > 0) {
        // Find exact match (e.g. laz1tunes.jpg or laz1tunes.png)
        const bannerFile = files.find(f => f.name.startsWith(sanitizedName));
        if (bannerFile) {
          const { data } = supabase.storage
            .from('covers')
            .getPublicUrl(`banners/${bannerFile.name}`);
          setBannerUrl(data.publicUrl);
          const isVid = bannerFile.metadata?.mimetype?.startsWith('video/') || !!bannerFile.name.match(/\.(mp4|webm|ogg|mov)$/i);
          setIsVideo(isVid);
        }
      }
      
      // 3. Check if user follows this artist
      if (session?.user) {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('artist_name', artistName)
          .maybeSingle();
        setIsFollowing(!!followData);
      }
      
      setLoading(false);
    }
    
    loadArtistData();
  }, [artistName, supabase]);

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    
    if (currentSong?.id === songs[0].id) {
      togglePlayPause();
    } else {
      const queue = songs.map((s): Song => ({ ...s, creatorName: artistName }));
      setQueue(queue, 0);
      playSong(queue[0]);
    }
  };

  const toggleFollow = async () => {
    if (!user) {
      // Redirect to login if not logged in
      router.push('/login');
      return;
    }
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('user_id', user.id)
          .eq('artist_name', artistName);
        setIsFollowing(false);
      } else {
        await supabase
          .from('follows')
          .insert({ user_id: user.id, artist_name: artistName });
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('Follow error:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBanner(true);
    const sanitizedName = artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const ext = file.name.split('.').pop();
    const path = `banners/${sanitizedName}.${ext}`;

    try {
      const { error } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true });

      if (error) throw error;

      // Append timestamp to bust cache
      const { data } = supabase.storage
        .from('covers')
        .getPublicUrl(path);
        
      setBannerUrl(`${data.publicUrl}?t=${Date.now()}`);
      setIsVideo(file.type.startsWith('video/') || !!file.name.match(/\.(mp4|webm|ogg|mov)$/i));
    } catch (err: unknown) {
      console.error('Error uploading banner:', err);
      alert('Fehler beim Hochladen des Banners: ' + getErrorMessage(err));
    } finally {
      setIsUploadingBanner(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isAnyPlaying = songs.some(s => s.id === currentSong?.id) && isPlaying;
  
  // REAL Monthly Listeners Algorithm
  let monthlyListeners = 0;
  if (songs.length > 0) {
    const totalPlays = songs.reduce((sum, song) => sum + song.plays, 0);
    
    // Find the oldest song to determine how many months the artist is active
    const oldestSong = songs.reduce((oldest, song) => {
      return new Date(song.created_at) < new Date(oldest.created_at) ? song : oldest;
    }, songs[0]);
    
    const firstReleaseDate = new Date(oldestSong.created_at);
    const now = new Date();
    
    // Calculate months difference
    const msPerMonth = 1000 * 60 * 60 * 24 * 30.44;
    let monthsActive = (now.getTime() - firstReleaseDate.getTime()) / msPerMonth;
    
    // Minimum 1 month to avoid dividing by zero or inflating numbers for brand new songs
    monthsActive = Math.max(1, monthsActive);
    
    // Calculate average plays per month
    monthlyListeners = Math.round(totalPlays / monthsActive);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      {/* Background Banner */}
      <div className="absolute top-0 left-0 right-0 h-[600px] overflow-hidden pointer-events-none z-0">
        {bannerUrl ? (
          isVideo ? (
            <video 
              src={bannerUrl} 
              autoPlay 
              loop 
              muted 
              playsInline
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              className="w-full h-full object-cover opacity-60"
              style={{ 
                maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
              }}
            />
          ) : (
            <img 
              src={bannerUrl} 
              alt="Banner" 
              className="w-full h-full object-cover opacity-60"
              style={{ 
                maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
              }}
            />
          )
        ) : (
          <div 
            className="w-full h-full bg-cover bg-center opacity-30" 
            style={{ 
              backgroundImage: 'url(https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&q=80)',
              maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
            }}
          />
        )}
      </div>
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-b from-black/10 via-[#0A0A0A]/70 to-[#0A0A0A] pointer-events-none z-0" />
      
      {/* Hero Content */}
      <div className="relative pt-32 px-6 md:px-10 pb-8 flex flex-col justify-end min-h-[380px] z-10 group">
        
        {/* Admin Editable Overlay */}
        {user && (
          <div className="absolute top-10 right-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <input 
              type="file" 
              accept="image/*,video/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleBannerUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingBanner}
              className="flex items-center gap-2 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/20 transition-all text-sm font-medium"
            >
              {isUploadingBanner ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Edit2 className="w-4 h-4" />
              )}
              Banner bearbeiten
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mb-2 text-sm text-white/90">
          <BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20" />
          <span>Verifizierter Künstler</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl mb-4 truncate w-full max-w-5xl">
          {artistName}
        </h1>
        
        <div className="text-base text-white/70 font-medium">
          {monthlyListeners.toLocaleString('de-DE')} monatliche Hörer*innen
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative bg-[#0A0A0A] px-6 md:px-10 py-6 min-h-screen z-10">
        
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
          
          <button 
            onClick={toggleFollow}
            disabled={followLoading}
            className={`flex items-center gap-2 px-5 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${
              isFollowing 
                ? 'bg-white/10 border border-white/40 text-white hover:border-white hover:bg-white/20' 
                : 'border border-white/30 text-white hover:border-white hover:scale-105'
            }`}
          >
            {followLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isFollowing ? (
              <UserCheck className="w-4 h-4" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {isFollowing ? 'Folge ich' : 'Folgen'}
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
                      if (currentSong?.id !== song.id) {
                        const queueWithNames = songs.map(s => ({ ...s, creatorName: artistName }));
                        setQueue(queueWithNames, index);
                        playSong({ ...song, creatorName: artistName });
                      } else {
                        togglePlayPause();
                      }
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
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-4 mr-4">
                        <PlaylistAddButton songId={song.id} iconClassName="w-5 h-5" />
                        <LikeButton songId={song.id} iconClassName="w-5 h-5" />
                      </div>
                      {song.plays.toLocaleString('de-DE')}
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
