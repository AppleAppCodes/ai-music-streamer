'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, Share2, UserPlus, UserCheck, BadgeCheck, Clock, Shuffle, Edit2, Loader2, Save, X, Flag } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import LikeButton from '@/components/ui/LikeButton';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import MobileSongMenu from '@/components/ui/MobileSongMenu';
import ReportDialog from '@/components/ui/ReportDialog';
import { getErrorMessage } from '@/lib/errors';
import { compressImage } from '@/lib/imageCompression';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isCreatorUser, isModUser } from '@/lib/admin';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const ARTIST_SONG_PAGE_SIZE = 1000;
const MAX_ARTIST_VIDEO_BYTES = 150 * 1024 * 1024;
const ALLOWED_ARTIST_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ALLOWED_ARTIST_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);

// Only fetch the columns we actually use – reduces payload significantly
const SONG_SELECT_COLUMNS = 'id,title,cover_url,artist_name,audio_url,plays,duration,created_at,album_id,genre,creator_id,is_approved' as const;
const ALBUM_SELECT_COLUMNS = 'id,title,cover_url,created_at,type' as const;

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

type StorageFileMeta = {
  created_at?: string | null;
  name: string;
  updated_at?: string | null;
};

function getStorageCacheKey(file: StorageFileMeta) {
  return file.updated_at || file.created_at || file.name;
}

function getStorageSortTime(file: StorageFileMeta) {
  const metadataTime = Date.parse(file.updated_at || file.created_at || '');
  if (!Number.isNaN(metadataTime)) return metadataTime;

  const timestampMatch = file.name.match(/_(\d{10,})\.[^.]+$/);
  return timestampMatch ? Number(timestampMatch[1]) : 0;
}

function withCacheBust(url: string, key: string | number) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(String(key))}`;
}

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

interface Release {
  id: string;
  title: string;
  cover_url: string;
  created_at: string;
  type: 'album' | 'ep' | 'single';
  is_song: boolean;
}

export default function ArtistPageClient({ artistName }: { artistName: string }) {
  const router = useRouter();
  
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue, isShuffling, toggleShuffle } = usePlayer();
  const supabase = useMemo(() => createClient(), []);
  
  const { t } = useTranslation();
  const [songs, setSongs] = useState<Song[]>([]);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  
  const [releases, setReleases] = useState<Release[]>([]);
  const [albumFilter, setAlbumFilter] = useState<'albums' | 'singles'>('albums');
  
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [artistVideoUrl, setArtistVideoUrl] = useState<string | null>(null);
  const [bannerPosition, setBannerPosition] = useState<string | null>(null);
  const [videoPosition, setVideoPosition] = useState<string | null>(null);
  const [positioningTarget, setPositioningTarget] = useState<'banner' | 'video' | null>(null);
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
  const isAdmin = isModUser(user);
  // Creators can manage banner / video / socials for any artist whose
  // catalogue contains at least one song they uploaded themselves.
  // Admins and mods stay allowed regardless of authorship.
  const ownsAnyArtistSong = isCreatorUser(user) && Boolean(user?.id) && songs.some((song) => song.creator_id === user?.id);
  const canEditArtist = isAdmin || ownsAnyArtistSong;
  // If none of the songs visible to the current viewer is approved yet,
  // the artist is still pending — show that instead of "Verifizierter
  // Künstler". (Anon users never reach this page in that state thanks
  // to the server-side approval guard; this branch is for the creator
  // and admins/mods who can preview their pending profile.)
  const hasApprovedSong = songs.some((song) => (song as Song & { is_approved?: boolean | null }).is_approved !== false);

  useEffect(() => {
    async function loadArtistData() {
      if (!artistName) return;
      
      setLoading(true);
      
      // Get current user to see if they are admin
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      // 1. Fetch all songs by exactly this artist name, ordered by popularity.
      //    Using specific columns instead of SELECT * to reduce payload.
      const artistSongs: Song[] = [];
      let rangeStart = 0;

      while (true) {
        const { data: songsData, error } = await supabase
          .from('songs')
          .select(SONG_SELECT_COLUMNS)
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

        artistSongs.push(...(songsData as unknown as Song[]));

        if (songsData.length < ARTIST_SONG_PAGE_SIZE) {
          break;
        }

        rangeStart += ARTIST_SONG_PAGE_SIZE;
      }

      setSongs(artistSongs);

      // Extract releases (albums and standalone songs)
      const standaloneSongs = artistSongs.filter(s => !s.album_id).map(s => ({
        id: s.id,
        title: s.title,
        cover_url: s.cover_url,
        created_at: s.created_at,
        type: 'single' as const,
        is_song: true
      }));

      const albumIds = [...new Set(artistSongs.map(s => s.album_id).filter(Boolean))] as string[];
      let fetchedAlbums: Release[] = [];
      if (albumIds.length > 0) {
        const { data: albumsData } = await supabase
          .from('albums')
          .select(ALBUM_SELECT_COLUMNS)
          .in('id', albumIds);
        if (albumsData) {
          fetchedAlbums = albumsData.map(a => ({
            id: a.id,
            title: a.title,
            cover_url: a.cover_url,
            created_at: a.created_at,
            type: a.type as 'album' | 'ep' | 'single',
            is_song: false
          }));
        }
      }

      const combinedReleases = [...fetchedAlbums, ...standaloneSongs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setReleases(combinedReleases);
      
      // Default albumFilter to 'singles' if they have no albums
      if (fetchedAlbums.filter(a => a.type === 'album').length === 0 && combinedReleases.length > 0) {
        setAlbumFilter('singles');
      }
      
      // 2–4. Run banner, follow-check, and socials fetch in PARALLEL
      //       since they are independent of each other.
      const sanitizedName = artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      const [bannerResult, followResult, socialsResult] = await Promise.all([
        // 2. Check if a custom banner exists
        supabase.storage.from('covers').list('banners', { search: sanitizedName }),
        // 3. Check if user follows this artist
        session?.user
          ? supabase.from('follows').select('id').eq('user_id', session.user.id).eq('artist_name', artistName).maybeSingle()
          : Promise.resolve({ data: null }),
        // 4. Fetch artist socials (only the columns we need)
        supabase.from('artist_profiles').select('instagram_url,tiktok_url,youtube_url,banner_position,video_position').eq('artist_name', artistName).maybeSingle(),
      ]);

      // Process banner files
      const files = bannerResult.data;
      if (files && files.length > 0) {
        const bannerFiles = files.filter(f => f.name.startsWith(sanitizedName) && !f.name.includes('_video'));
        if (bannerFiles.length > 0) {
          bannerFiles.sort((a, b) => getStorageSortTime(b) - getStorageSortTime(a));
          const bannerFile = bannerFiles[0];
          const { data } = supabase.storage.from('covers').getPublicUrl(`banners/${bannerFile.name}`);
          setBannerUrl(withCacheBust(data.publicUrl, getStorageCacheKey(bannerFile)));
        }

        const videoFiles = files.filter(f => f.name.startsWith(sanitizedName + '_video'));
        if (videoFiles.length > 0) {
          videoFiles.sort((a, b) => getStorageSortTime(b) - getStorageSortTime(a));
          const videoFile = videoFiles[0];
          const { data } = supabase.storage.from('covers').getPublicUrl(`banners/${videoFile.name}`);
          setArtistVideoUrl(withCacheBust(data.publicUrl, getStorageCacheKey(videoFile)));
        }
      }

      // Process follow status
      setIsFollowing(!!followResult.data);

      // Process socials
      const socialsData = socialsResult.data;
      if (socialsData) {
        const normalizedSocials = normalizeArtistSocials(socialsData);
        setSocials(normalizedSocials);
        setEditSocials({
          instagram_url: normalizedSocials.instagram_url || '',
          tiktok_url: normalizedSocials.tiktok_url || '',
          youtube_url: normalizedSocials.youtube_url || ''
        });
        const profileRecord = socialsData as Record<string, unknown>;
        const rawBannerPosition = profileRecord.banner_position;
        const rawVideoPosition = profileRecord.video_position;
        setBannerPosition(typeof rawBannerPosition === 'string' ? rawBannerPosition : null);
        setVideoPosition(typeof rawVideoPosition === 'string' ? rawVideoPosition : null);
      }
      
      setLoading(false);
    }
    
    loadArtistData();
  }, [artistName, supabase]);

  const handlePlayAll = useCallback(() => {
    if (songs.length === 0) return;
    
    if (currentSong?.id === songs[0].id) {
      togglePlayPause();
    } else {
      const queue = songs.map((s): Song => ({ ...s, creatorName: artistName }));
      setQueue(queue, 0);
      playSong(queue[0]);
    }
  }, [songs, currentSong?.id, artistName, togglePlayPause, setQueue, playSong]);

  const handleShuffle = useCallback(() => {
    if (songs.length === 0) return;

    toggleShuffle();
    if (!isShuffling) {
      const queue = songs.map((song): Song => ({ ...song, creatorName: artistName }));
      const startIndex = Math.floor(Math.random() * queue.length);
      setQueue(queue, startIndex);
      playSong(queue[startIndex]);
    }
  }, [songs, artistName, toggleShuffle, isShuffling, setQueue, playSong]);

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
    if (!canEditArtist) return;
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

  const savePositionToDb = useCallback(async (field: 'banner_position' | 'video_position', value: string) => {
    if (!canEditArtist) return;
    const { error } = await supabase
      .from('artist_profiles')
      .upsert({ artist_name: artistName, [field]: value }, { onConflict: 'artist_name' });
    if (error) {
      console.error(`Failed to save ${field}`, error);
    }
  }, [artistName, canEditArtist, supabase]);

  const beginPositioning = useCallback((target: 'banner' | 'video', event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditArtist || positioningTarget !== target) return;
    const container = event.currentTarget;
    container.setPointerCapture(event.pointerId);
    const rect = container.getBoundingClientRect();
    const updateFromEvent = (clientX: number, clientY: number) => {
      const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
      const next = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
      if (target === 'banner') setBannerPosition(next);
      else setVideoPosition(next);
    };
    updateFromEvent(event.clientX, event.clientY);
    const onMove = (ev: PointerEvent) => updateFromEvent(ev.clientX, ev.clientY);
    const onUp = (ev: PointerEvent) => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
      try { container.releasePointerCapture(ev.pointerId); } catch { /* already released */ }
      const finalX = Math.min(100, Math.max(0, ((ev.clientX - rect.left) / rect.width) * 100));
      const finalY = Math.min(100, Math.max(0, ((ev.clientY - rect.top) / rect.height) * 100));
      const finalValue = `${finalX.toFixed(1)}% ${finalY.toFixed(1)}%`;
      void savePositionToDb(target === 'banner' ? 'banner_position' : 'video_position', finalValue);
    };
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onUp);
  }, [canEditArtist, positioningTarget, savePositionToDb]);

  const resetPosition = useCallback((target: 'banner' | 'video') => {
    const defaultValue = '50% 50%';
    if (target === 'banner') setBannerPosition(defaultValue);
    else setVideoPosition(defaultValue);
    void savePositionToDb(target === 'banner' ? 'banner_position' : 'video_position', defaultValue);
  }, [savePositionToDb]);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditArtist) return;
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
    if (!canEditArtist) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('?')[0]?.split('.').pop()?.toLowerCase() || '';
    if (file.size > MAX_ARTIST_VIDEO_BYTES) {
      alert('Das Video ist zu groß. Maximal erlaubt sind 150 MB.');
      e.target.value = '';
      return;
    }
    if (!ALLOWED_ARTIST_VIDEO_TYPES.has(file.type) && !ALLOWED_ARTIST_VIDEO_EXTENSIONS.has(ext)) {
      alert('Bitte lade nur MP4-, MOV- oder WebM-Videos hoch.');
      e.target.value = '';
      return;
    }

    setIsUploadingArtistVideo(true);
    const sanitizedName = artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cacheKey = Date.now();
    const uploadExt = ext || (file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4');
    const videoFileName = `${sanitizedName}_video_${cacheKey}.${uploadExt}`;
    const path = `banners/${videoFileName}`;

    try {
      const { error } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data: existingFiles } = await supabase.storage
        .from('covers')
        .list('banners', { search: `${sanitizedName}_video` });
      const staleVideoPaths = (existingFiles || [])
        .filter((existingFile) => existingFile.name.startsWith(`${sanitizedName}_video`) && existingFile.name !== videoFileName)
        .map((existingFile) => `banners/${existingFile.name}`);

      if (staleVideoPaths.length > 0) {
        const { error: removeError } = await supabase.storage.from('covers').remove(staleVideoPaths);
        if (removeError) {
          console.warn('Failed to remove stale artist videos:', removeError.message);
        }
      }

      const { data } = supabase.storage
        .from('covers')
        .getPublicUrl(path);
        
      setArtistVideoUrl(withCacheBust(data.publicUrl, cacheKey));
    } catch (err: unknown) {
      console.error('Error uploading video:', err);
      alert('Fehler beim Hochladen des Videos: ' + getErrorMessage(err));
    } finally {
      setIsUploadingArtistVideo(false);
      e.target.value = '';
    }
  };

  const isAnyPlaying = songs.some(s => s.id === currentSong?.id) && isPlaying;
  
  // Total Plays Calculation – memoized to avoid recalculation on every render
  const totalPlays = useMemo(
    () => songs.reduce((sum, song) => sum + (song.plays || 0), 0),
    [songs]
  );

  if (loading) {
    return (
      <div className="yoriax-page flex min-h-screen flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="yoriax-page flex-1 overflow-y-auto pb-32">
      {/* Background Banner */}
      <div
        className={`absolute top-0 left-0 right-0 h-[600px] overflow-hidden z-0 ${positioningTarget === 'banner' ? 'cursor-move touch-none' : 'pointer-events-none'}`}
        onPointerDown={positioningTarget === 'banner' ? (e) => beginPositioning('banner', e) : undefined}
      >
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt="Banner"
            draggable={false}
            className={`w-full h-full object-cover ${positioningTarget === 'banner' ? 'opacity-100' : 'opacity-80'}`}
            style={{
              objectPosition: bannerPosition ?? '50% 50%',
              maskImage: positioningTarget === 'banner' ? undefined : 'linear-gradient(to bottom, black 0%, transparent 100%)',
              WebkitMaskImage: positioningTarget === 'banner' ? undefined : 'linear-gradient(to bottom, black 0%, transparent 100%)'
            }}
          />
        ) : (
          <div
            className="w-full h-full bg-cover bg-center opacity-45"
            style={{ 
              backgroundImage: 'url(https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&q=80)',
              maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
            }}
          />
        )}
      </div>
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-0 h-[600px] bg-gradient-to-b from-black/10 via-background/70 to-background" />

      {/* Hero Content */}
      <div className={`relative pt-20 px-6 md:px-10 pb-4 md:pb-8 flex flex-col md:flex-row w-full items-center md:items-end gap-4 md:gap-10 min-h-[250px] md:min-h-[380px] z-10 group ${positioningTarget === 'banner' ? 'pointer-events-none' : ''}`}>
        
        <div className="flex flex-col justify-end items-center md:items-start flex-shrink-0 max-w-3xl text-center md:text-left">
          {/* Admin Editable Overlay for Background */}
          {canEditArtist && (
            <div className={`absolute top-10 right-10 md:right-auto md:left-10 transition-opacity z-20 flex flex-wrap gap-2 ${positioningTarget === 'banner' ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100'}`}>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleBannerUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingBanner || positioningTarget !== null}
                className="flex items-center gap-2 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/20 transition-all text-sm font-medium disabled:opacity-50"
              >
                {isUploadingBanner ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Edit2 className="w-4 h-4" />
                )}
                {t('artistPage.editBanner')}
              </button>
              {bannerUrl ? (
                <button
                  onClick={() => setPositioningTarget((prev) => (prev === 'banner' ? null : 'banner'))}
                  disabled={isUploadingBanner}
                  className={`flex items-center gap-2 backdrop-blur-md text-white px-4 py-2 rounded-full border transition-all text-sm font-medium ${positioningTarget === 'banner' ? 'bg-primary/80 hover:bg-primary border-primary-light' : 'bg-black/50 hover:bg-black/80 border-white/20'}`}
                >
                  {positioningTarget === 'banner' ? t('artistPage.positionDone') : t('artistPage.positionBanner')}
                </button>
              ) : null}
              {positioningTarget === 'banner' ? (
                <button
                  onClick={() => resetPosition('banner')}
                  className="flex items-center gap-2 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/20 transition-all text-sm font-medium"
                >
                  {t('artistPage.recenter')}
                </button>
              ) : null}
              {positioningTarget === 'banner' ? (
                <span className="text-xs text-white/80 self-center bg-black/50 px-3 py-1 rounded-full">
                  {t('artistPage.dragBannerHint')}
                </span>
              ) : null}
            </div>
          )}

          <div className="flex items-center gap-2 mb-2 text-sm">
            {hasApprovedSong ? (
              <>
                <BadgeCheck className="w-5 h-5 fill-primary/20 text-primary-light" />
                <span className="text-white/90">{t('artistPage.verified')}</span>
              </>
            ) : (
              <>
                <Clock className="w-5 h-5 text-amber-300" />
                <span className="text-amber-200/90">{t('artistPage.pending')}</span>
              </>
            )}
          </div>
          
          <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl mb-1 md:mb-4 truncate w-full">
            {artistName}
          </h1>
          
          <div className="text-base text-white/70 font-medium">
            {totalPlays.toLocaleString('de-DE')} {t('artistPage.totalPlays')}
          </div>
        </div>

        {/* Artist Profile Video & Socials */}
        <div className="flex-1 flex flex-col md:flex-row w-full justify-center items-center gap-4 md:gap-6 mt-4 md:mt-0">
          
          {/* Artist Profile Video (Canvas) */}
          {(artistVideoUrl || canEditArtist) && (
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
                  style={{ objectPosition: videoPosition ?? '50% 50%' }}
                />
                {positioningTarget === 'video' ? (
                  <div
                    className="absolute inset-0 z-20 cursor-move touch-none"
                    onPointerDown={(e) => beginPositioning('video', e)}
                  />
                ) : (
                  <div className="absolute inset-0 z-10" onContextMenu={(e) => e.preventDefault()} />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 text-xs p-4 text-center border-dashed border-2 border-white/10 rounded-2xl">
                {t('artistPage.noVideo')}
              </div>
            )}
            
            {/* Admin Upload Video Overlay */}
            {canEditArtist && (
              <div className={`absolute inset-0 transition-opacity flex flex-col items-center justify-center gap-2 z-30 pointer-events-none ${positioningTarget === 'video' ? 'opacity-100' : 'opacity-0 group-hover/video:opacity-100 bg-black/60'}`}>
                <input
                  type="file"
                  accept="video/*"
                  ref={videoInputRef}
                  className="hidden"
                  onChange={handleArtistVideoUpload}
                />
                <div className="flex flex-col items-center gap-2 pointer-events-auto">
                  <button
                    onClick={(e) => { e.preventDefault(); videoInputRef.current?.click(); }}
                    disabled={isUploadingArtistVideo || positioningTarget !== null}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full border border-white/30 backdrop-blur-md transition-all text-sm font-medium disabled:opacity-50"
                  >
                    {isUploadingArtistVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                    {t('artistPage.editVideo')}
                  </button>
                  {artistVideoUrl ? (
                    <button
                      onClick={(e) => { e.preventDefault(); setPositioningTarget((prev) => (prev === 'video' ? null : 'video')); }}
                      disabled={isUploadingArtistVideo}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all text-sm font-medium ${positioningTarget === 'video' ? 'bg-primary/80 hover:bg-primary border-primary-light text-white' : 'bg-white/10 hover:bg-white/20 text-white border-white/30'}`}
                    >
                      {positioningTarget === 'video' ? t('artistPage.positionDone') : t('artistPage.positionVideo')}
                    </button>
                  ) : null}
                  {positioningTarget === 'video' ? (
                    <button
                      onClick={(e) => { e.preventDefault(); resetPosition('video'); }}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full border border-white/30 backdrop-blur-md transition-all text-sm font-medium"
                    >
                      {t('artistPage.recenter')}
                    </button>
                  ) : null}
                  {positioningTarget === 'video' ? (
                    <span className="text-[11px] text-white/80 bg-black/50 px-2 py-1 rounded-full text-center">
                      {t('artistPage.dragVideoHint')}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            </div>
          )}

        </div>
      </div>


      {/* Main Content Area */}
      <div className="relative z-10 min-h-screen border-t border-white/5 bg-background/80 px-6 py-6 backdrop-blur-2xl md:px-10">
        
        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-10">
          <button 
            onClick={handlePlayAll}
            disabled={songs.length === 0}
            className="w-14 h-14 shrink-0 rounded-full bg-primary flex items-center justify-center text-white hover:scale-105 transition-transform shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] disabled:opacity-50 disabled:hover:scale-100"
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
            
            <div className="ml-4 pl-4 border-l border-white/10 flex items-center">
              <ReportDialog 
                entityType="artist" 
                entityId={artistName} 
                entityName={artistName} 
                trigger={
                  <button className="text-white/40 hover:text-red-400 transition-colors cursor-pointer" title="Künstler melden">
                    <Flag className="w-5 h-5" />
                  </button>
                }
              />
            </div>
          </div>

          {/* Socials */}
          <div className="flex items-center gap-3 ml-4 pl-6 border-l border-white/10">
            {isEditingSocials ? (
              <div className="absolute right-6 mt-16 z-50 flex flex-col gap-2 bg-black/90 p-4 rounded-xl backdrop-blur-md border border-white/20 w-64 shadow-2xl">
                <h4 className="text-white text-sm font-bold mb-1">Social Links bearbeiten</h4>
                <input 
                  type="text" 
                  placeholder="Instagram URL" 
                  value={editSocials.instagram_url} 
                  onChange={e => setEditSocials({...editSocials, instagram_url: e.target.value})}
                  className="bg-white/10 text-xs px-3 py-2 rounded text-white w-full border border-white/10 outline-none focus:border-primary transition-colors"
                />
                <input 
                  type="text" 
                  placeholder="TikTok URL" 
                  value={editSocials.tiktok_url} 
                  onChange={e => setEditSocials({...editSocials, tiktok_url: e.target.value})}
                  className="bg-white/10 text-xs px-3 py-2 rounded text-white w-full border border-white/10 outline-none focus:border-primary transition-colors"
                />
                <input 
                  type="text" 
                  placeholder="YouTube URL" 
                  value={editSocials.youtube_url} 
                  onChange={e => setEditSocials({...editSocials, youtube_url: e.target.value})}
                  className="bg-white/10 text-xs px-3 py-2 rounded text-white w-full border border-white/10 outline-none focus:border-primary transition-colors"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setIsEditingSocials(false)} className="text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={handleSaveSocials} disabled={isSavingSocials} className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    {isSavingSocials ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Speichern
                  </button>
                </div>
              </div>
            ) : (
              <>
                {socials?.instagram_url && (
                  <a href={socials.instagram_url} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white/5 hover:bg-white/10 hover:scale-110 rounded-full transition-all text-white/80 hover:text-[#E1306C] shadow-lg border border-white/5">
                    <InstagramIcon className="w-5 h-5" />
                  </a>
                )}
                {socials?.tiktok_url && (
                  <a href={socials.tiktok_url} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white/5 hover:bg-white/10 hover:scale-110 rounded-full transition-all text-white/80 hover:text-[#00f2fe] shadow-lg border border-white/5">
                    <TiktokIcon className="w-5 h-5" />
                  </a>
                )}
                {socials?.youtube_url && (
                  <a href={socials.youtube_url} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white/5 hover:bg-white/10 hover:scale-110 rounded-full transition-all text-white/80 hover:text-[#FF0000] shadow-lg border border-white/5">
                    <YoutubeIcon className="w-5 h-5" />
                  </a>
                )}
                
                {canEditArtist && (
                  <button
                    onClick={() => setIsEditingSocials(true)}
                    className="flex items-center justify-center p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white shadow-lg border border-white/5 border-dashed"
                    title={(!socials?.instagram_url && !socials?.tiktok_url && !socials?.youtube_url) ? t('artistPage.addSocials') : t('artistPage.editSocials')}
                  >
                    {(!socials?.instagram_url && !socials?.tiktok_url && !socials?.youtube_url) ? (
                      <span className="text-xs font-bold px-2">+ Socials</span>
                    ) : (
                      <Edit2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </>
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
              {(showAllSongs ? songs : songs.slice(0, 5)).map((song, index) => {
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
                      <Image src={song.cover_url} alt={song.title} width={40} height={40} className="w-10 h-10 object-cover rounded shadow-md" loading="lazy" />
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
              {!showAllSongs && songs.length > 5 && (
                <button
                  onClick={() => setShowAllSongs(true)}
                  className="mt-6 mx-auto bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-6 rounded-full border border-white/10 transition-colors text-sm"
                >
                  Alle anzeigen
                </button>
              )}
              {showAllSongs && songs.length > 5 && (
                <button
                  onClick={() => setShowAllSongs(false)}
                  className="mt-6 mx-auto bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-6 rounded-full border border-white/10 transition-colors text-sm"
                >
                  Weniger anzeigen
                </button>
              )}
            </div>
          ) : (
            <div className="text-white/50">
              Dieser Künstler hat noch keine Songs hochgeladen.
            </div>
          )}
        </div>
        
        {/* Diskografie Section */}
        {releases.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Diskografie</h2>
            </div>
            
            <div className="flex items-center gap-3 mb-6">
              <button 
                onClick={() => setAlbumFilter('albums')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${albumFilter === 'albums' ? 'bg-white text-black' : 'bg-surface-hover text-white hover:bg-surface-active'}`}
              >
                Alben
              </button>
              <button 
                onClick={() => setAlbumFilter('singles')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${albumFilter === 'singles' ? 'bg-white text-black' : 'bg-surface-hover text-white hover:bg-surface-active'}`}
              >
                Singles und EPs
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
               {releases
                  .filter(a => albumFilter === 'albums' ? a.type === 'album' : (a.type === 'single' || a.type === 'ep'))
                  .map(release => (
                     <div 
                       key={release.id} 
                       onClick={() => {
                         if (release.is_song) {
                           router.push(`/song/${release.id}`);
                         } else {
                           router.push(`/album/${release.id}`);
                         }
                       }}
                       className="yoriax-card-interactive group flex cursor-pointer flex-col gap-3 rounded-2xl p-4"
                     >
                       <div className="relative aspect-square w-full rounded-md shadow-lg overflow-hidden bg-[#333]">
                          <Image src={release.cover_url} alt={release.title} fill sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2">
                             {release.is_song && (
                               <div 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   if (currentSong?.id === release.id) {
                                     togglePlayPause();
                                   } else {
                                     const song = songs.find(s => s.id === release.id);
                                     if (song) {
                                       const queueWithNames = [{ ...song, creatorName: artistName }];
                                       setQueue(queueWithNames, 0);
                                       playSong(queueWithNames[0]);
                                     }
                                   }
                                 }}
                                 className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform"
                               >
                                 {currentSong?.id === release.id && isPlaying ? (
                                   <Pause className="w-5 h-5 fill-current" />
                                 ) : (
                                   <Play className="w-5 h-5 fill-current ml-1" />
                                 )}
                               </div>
                             )}
                          </div>
                       </div>
                       <div className="flex flex-col gap-1">
                          <span className="text-white font-bold truncate">{release.title}</span>
                          <span className="text-white/50 text-sm truncate">{new Date(release.created_at).getFullYear()} • {release.type === 'album' ? 'Album' : release.type === 'ep' ? 'EP' : 'Single'}</span>
                       </div>
                     </div>
                  ))
               }
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
