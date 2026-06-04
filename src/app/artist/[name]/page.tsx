'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, Share2, UserPlus, UserCheck, BadgeCheck, Shuffle, Edit2, Loader2, Save, X } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import LikeButton from '@/components/ui/LikeButton';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import MobileSongMenu from '@/components/ui/MobileSongMenu';
import { getErrorMessage } from '@/lib/errors';
import { compressImage } from '@/lib/imageCompression';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/admin';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const ARTIST_SONG_PAGE_SIZE = 1000;

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

const TiktokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
  </svg>
);

type ArtistSocials = {
  instagram_url?: string;
  tiktok_url?: string;
  youtube_url?: string;
};

function normalizeExternalUrl(value?: string | null) {
  const rawValue = value?.trim();
  if (!rawValue) return '';

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeArtistSocials(input: ArtistSocials): ArtistSocials {
  return {
    instagram_url: normalizeExternalUrl(input.instagram_url),
    tiktok_url: normalizeExternalUrl(input.tiktok_url),
    youtube_url: normalizeExternalUrl(input.youtube_url),
  };
}

function hasInvalidSocialUrl(raw: ArtistSocials, normalized: ArtistSocials) {
  return (['instagram_url', 'tiktok_url', 'youtube_url'] as const).some((key) => {
    return Boolean(raw[key]?.trim()) && !normalized[key];
  });
}

export default function ArtistPage() {
  const params = useParams();
  const router = useRouter();
  // Ensure we decode the URL encoded name properly
  const artistName = decodeURIComponent(params.name as string);
  
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue, isShuffling, toggleShuffle } = usePlayer();
  const supabase = createClient();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [artistVideoUrl, setArtistVideoUrl] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingArtistVideo, setIsUploadingArtistVideo] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [socials, setSocials] = useState<ArtistSocials | null>(null);
  const [isEditingSocials, setIsEditingSocials] = useState(false);
  const [editSocials, setEditSocials] = useState({instagram_url: '', tiktok_url: '', youtube_url: ''});
  const [isSavingSocials, setIsSavingSocials] = useState(false);
  const isAdmin = isAdminUser(user);

  useEffect(() => {
    async function loadArtistData() {
      if (!artistName) return;
      
      setLoading(true);
      
      // Get current user to see if they are admin
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      // 1. Fetch all songs by exactly this artist name, ordered by popularity.
      const artistSongs: Song[] = [];
      let rangeStart = 0;

      while (true) {
        const { data: songsData, error } = await supabase
          .from('songs')
          .select('*')
          .ilike('artist_name', artistName)
          .order('plays', { ascending: false })
          .range(rangeStart, rangeStart + ARTIST_SONG_PAGE_SIZE - 1);

        if (error) {
          console.error('Failed to load artist songs:', error);
          break;
        }

        if (!songsData || songsData.length === 0) {
          break;
        }

        artistSongs.push(...(songsData as Song[]));

        if (songsData.length < ARTIST_SONG_PAGE_SIZE) {
          break;
        }

        rangeStart += ARTIST_SONG_PAGE_SIZE;
      }

      setSongs(artistSongs);
      
      // 2. Check if a custom banner exists
      const sanitizedName = artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const { data: files } = await supabase.storage
        .from('covers')
        .list('banners', {
          search: sanitizedName
        });
        
      if (files && files.length > 0) {
        // Find background banner matches (not video)
        const bannerFiles = files.filter(f => f.name.startsWith(sanitizedName) && !f.name.includes('_video'));
        if (bannerFiles.length > 0) {
          bannerFiles.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          const bannerFile = bannerFiles[0];
          
          const { data } = supabase.storage
            .from('covers')
            .getPublicUrl(`banners/${bannerFile.name}`);
          setBannerUrl(data.publicUrl);
        }

        // Find artist video matches
        const videoFiles = files.filter(f => f.name.startsWith(sanitizedName + '_video'));
        if (videoFiles.length > 0) {
          videoFiles.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          const videoFile = videoFiles[0];
          
          const { data } = supabase.storage
            .from('covers')
            .getPublicUrl(`banners/${videoFile.name}`);
          setArtistVideoUrl(data.publicUrl);
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
      // 4. Fetch artist socials
      const { data: socialsData } = await supabase
        .from('artist_profiles')
        .select('*')
        .eq('artist_name', artistName)
        .maybeSingle();
      if (socialsData) {
        const normalizedSocials = normalizeArtistSocials(socialsData);
        setSocials(normalizedSocials);
        setEditSocials({
          instagram_url: normalizedSocials.instagram_url || '',
          tiktok_url: normalizedSocials.tiktok_url || '',
          youtube_url: normalizedSocials.youtube_url || ''
        });
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

  const handleShuffle = () => {
    if (songs.length === 0) return;

    toggleShuffle();
    if (!isShuffling) {
      const queue = songs.map((song): Song => ({ ...song, creatorName: artistName }));
      const startIndex = Math.floor(Math.random() * queue.length);
      setQueue(queue, startIndex);
      playSong(queue[startIndex]);
    }
  };

  const handleShareArtist = async () => {
    const artistUrl = `${window.location.origin}/artist/${encodeURIComponent(artistName)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: artistName,
          text: `${artistName} auf YORIAX`,
          url: artistUrl,
        });
        setShareStatus('Geteilt');
      } else {
        await navigator.clipboard.writeText(artistUrl);
        setShareStatus('Link kopiert');
      }
      window.setTimeout(() => setShareStatus(''), 1800);
    } catch {
      // Closing the native share sheet is not an error the UI needs to surface.
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

  const handleSaveSocials = async () => {
    if (!isAdmin) return;
    const normalizedSocials = normalizeArtistSocials(editSocials);
    if (hasInvalidSocialUrl(editSocials, normalizedSocials)) {
      alert('Bitte nur gültige http/https Social-Links speichern.');
      return;
    }

    setIsSavingSocials(true);
    try {
      const { error } = await supabase
        .from('artist_profiles')
        .upsert({ 
          artist_name: artistName,
          instagram_url: normalizedSocials.instagram_url,
          tiktok_url: normalizedSocials.tiktok_url,
          youtube_url: normalizedSocials.youtube_url
        }, { onConflict: 'artist_name' });
        
      if (error) throw error;
      setSocials(normalizedSocials);
      setEditSocials({
        instagram_url: normalizedSocials.instagram_url || '',
        tiktok_url: normalizedSocials.tiktok_url || '',
        youtube_url: normalizedSocials.youtube_url || '',
      });
      setIsEditingSocials(false);
    } catch (err) {
      console.error('Error saving socials', err);
      alert('Fehler beim Speichern der Socials');
    } finally {
      setIsSavingSocials(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    let file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBanner(true);
    
    try {
      file = await compressImage(file);
      const sanitizedName = artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const ext = file.name.split('.').pop();
      const path = `banners/${sanitizedName}.${ext}`;

      const { error } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true });

      if (error) throw error;

      // Append timestamp to bust cache
      const { data } = supabase.storage
        .from('covers')
        .getPublicUrl(path);
        
      setBannerUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch (err: unknown) {
      console.error('Error uploading banner:', err);
      alert('Fehler beim Hochladen des Banners: ' + getErrorMessage(err));
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleArtistVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingArtistVideo(true);
    const sanitizedName = artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const ext = file.name.split('.').pop();
    const path = `banners/${sanitizedName}_video.${ext}`;

    try {
      const { error } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from('covers')
        .getPublicUrl(path);
        
      setArtistVideoUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch (err: unknown) {
      console.error('Error uploading video:', err);
      alert('Fehler beim Hochladen des Videos: ' + getErrorMessage(err));
    } finally {
      setIsUploadingArtistVideo(false);
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
          <img 
            src={bannerUrl} 
            alt="Banner" 
            className="w-full h-full object-cover opacity-60"
            style={{ 
              maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
            }}
          />
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
      <div className="relative pt-32 px-6 md:px-10 pb-8 flex flex-col md:flex-row w-full items-center md:items-end gap-10 min-h-[380px] z-10 group">
        
        <div className="flex flex-col justify-end items-center md:items-start flex-shrink-0 max-w-3xl text-center md:text-left">
          {/* Admin Editable Overlay for Background */}
          {isAdmin && (
            <div className="absolute top-10 right-10 md:right-auto md:left-10 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <input 
                type="file" 
                accept="image/*" 
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
                Hintergrundbild bearbeiten
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-2 text-sm text-white/90">
            <BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20" />
            <span>Verifizierter Künstler</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl mb-4 truncate w-full">
            {artistName}
          </h1>
          
          <div className="text-base text-white/70 font-medium">
            {monthlyListeners.toLocaleString('de-DE')} monatliche Hörer*innen
          </div>
        </div>

        {/* Artist Profile Video & Socials */}
        <div className="flex-1 flex flex-col md:flex-row w-full justify-center items-center gap-6 mt-6 md:mt-0">
          
          {/* Artist Profile Video (Canvas) */}
          {(artistVideoUrl || isAdmin) && (
            <div className="relative w-full max-w-[320px] md:max-w-[480px] lg:max-w-[540px] aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0 group/video bg-black/20 backdrop-blur-sm">
              {artistVideoUrl ? (
              <>
                <video 
                  src={`${artistVideoUrl}#t=0.001`}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  className="w-full h-full object-cover pointer-events-none select-none scale-[1.16] origin-center"
                />
                <div className="absolute inset-0 z-10" onContextMenu={(e) => e.preventDefault()} />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 text-xs p-4 text-center border-dashed border-2 border-white/10 rounded-2xl">
                Kein Video vorhanden
              </div>
            )}
            
            {/* Admin Upload Video Overlay */}
            {isAdmin && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/video:opacity-100 transition-opacity flex flex-col items-center justify-center z-30">
                <input 
                  type="file" 
                  accept="video/*" 
                  ref={videoInputRef} 
                  className="hidden" 
                  onChange={handleArtistVideoUpload}
                />
                <button 
                  onClick={(e) => { e.preventDefault(); videoInputRef.current?.click(); }}
                  disabled={isUploadingArtistVideo}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full border border-white/30 backdrop-blur-md transition-all text-sm font-medium"
                >
                  {isUploadingArtistVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                  Video ändern
                </button>
              </div>
            )}
            </div>
          )}

          {/* Socials */}
          <div className="flex flex-row md:flex-col items-center gap-3">
            {isEditingSocials ? (
              <div className="flex flex-col gap-2 bg-black/50 p-3 rounded-lg backdrop-blur-md border border-white/10 w-48 shadow-xl">
                <input 
                  type="text" 
                  placeholder="Instagram URL" 
                  value={editSocials.instagram_url} 
                  onChange={e => setEditSocials({...editSocials, instagram_url: e.target.value})}
                  className="bg-white/10 text-xs px-2 py-1.5 rounded text-white w-full border border-white/10 outline-none focus:border-primary"
                />
                <input 
                  type="text" 
                  placeholder="TikTok URL" 
                  value={editSocials.tiktok_url} 
                  onChange={e => setEditSocials({...editSocials, tiktok_url: e.target.value})}
                  className="bg-white/10 text-xs px-2 py-1.5 rounded text-white w-full border border-white/10 outline-none focus:border-primary"
                />
                <input 
                  type="text" 
                  placeholder="YouTube URL" 
                  value={editSocials.youtube_url} 
                  onChange={e => setEditSocials({...editSocials, youtube_url: e.target.value})}
                  className="bg-white/10 text-xs px-2 py-1.5 rounded text-white w-full border border-white/10 outline-none focus:border-primary"
                />
                <div className="flex justify-end gap-2 mt-1">
                  <button onClick={() => setIsEditingSocials(false)} className="text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={handleSaveSocials} disabled={isSavingSocials} className="bg-primary hover:bg-primary/80 text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors">
                    {isSavingSocials ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Speichern
                  </button>
                </div>
              </div>
            ) : (
              <>
                {socials?.instagram_url && (
                  <a href={socials.instagram_url} target="_blank" rel="noopener noreferrer" className="p-3 md:p-2.5 bg-white/5 hover:bg-white/10 hover:scale-110 rounded-full transition-all text-white/80 hover:text-[#E1306C] shadow-lg border border-white/5">
                    <InstagramIcon className="w-5 h-5 md:w-6 md:h-6" />
                  </a>
                )}
                {socials?.tiktok_url && (
                  <a href={socials.tiktok_url} target="_blank" rel="noopener noreferrer" className="p-3 md:p-2.5 bg-white/5 hover:bg-white/10 hover:scale-110 rounded-full transition-all text-white/80 hover:text-[#00f2fe] shadow-lg border border-white/5">
                    <TiktokIcon className="w-5 h-5 md:w-6 md:h-6" />
                  </a>
                )}
                {socials?.youtube_url && (
                  <a href={socials.youtube_url} target="_blank" rel="noopener noreferrer" className="p-3 md:p-2.5 bg-white/5 hover:bg-white/10 hover:scale-110 rounded-full transition-all text-white/80 hover:text-[#FF0000] shadow-lg border border-white/5">
                    <YoutubeIcon className="w-5 h-5 md:w-6 md:h-6" />
                  </a>
                )}
                
                {isAdmin && (
                  <button 
                    onClick={() => setIsEditingSocials(true)}
                    className="flex items-center justify-center p-3 md:p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white shadow-lg border border-white/5 border-dashed"
                    title={(!socials?.instagram_url && !socials?.tiktok_url && !socials?.youtube_url) ? 'Socials hinzufügen' : 'Socials bearbeiten'}
                  >
                    {(!socials?.instagram_url && !socials?.tiktok_url && !socials?.youtube_url) ? (
                      <span className="text-xs font-medium px-2">+ Socials</span>
                    ) : (
                      <Edit2 className="w-4 h-4 md:w-4 md:h-4" />
                    )}
                  </button>
                )}
              </>
            )}
          </div>
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
              <Play className="w-7 h-7 fill-current" />
            )}
          </button>
          
          <button
            onClick={handleShuffle}
            disabled={songs.length === 0}
            className={`transition-all hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 ${
              isShuffling ? 'text-primary' : 'text-white/40 hover:text-white'
            }`}
            title={isShuffling ? 'Shuffle deaktivieren' : 'Shuffle aktivieren'}
            aria-pressed={isShuffling}
          >
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
          
          <div className="relative flex items-center">
            <button
              onClick={handleShareArtist}
              className="text-white/40 hover:text-white transition-colors"
              title="Künstler teilen"
              aria-label={`${artistName} teilen`}
            >
              <Share2 className="w-6 h-6" />
            </button>
            {shareStatus && (
              <span className="absolute left-full ml-3 whitespace-nowrap rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-md">
                {shareStatus}
              </span>
            )}
          </div>
        </div>

        {/* Songs Section */}
        <div className="mb-12">
          <div className="mb-6 flex items-baseline gap-3">
            <h2 className="text-2xl font-bold text-white">Alle Songs</h2>
            <span className="text-sm font-semibold text-white/45">
              {songs.length.toLocaleString('de-DE')} {songs.length === 1 ? 'Song' : 'Songs'}
            </span>
          </div>
          
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
                      <div onClick={(e) => e.stopPropagation()} className="hidden md:flex items-center gap-4 mr-4">
                        <PlaylistAddButton songId={song.id} iconClassName="w-5 h-5" />
                        <LikeButton songId={song.id} iconClassName="w-5 h-5" />
                      </div>
                      <span className="hidden sm:inline-block mr-2 md:mr-0">{song.plays.toLocaleString('de-DE')}</span>
                      <div className="-mr-2 md:hidden" onClick={(e) => e.stopPropagation()}>
                        <MobileSongMenu song={song} />
                      </div>
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
