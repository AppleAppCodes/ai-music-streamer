'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { ArrowLeft, Play, Pause, Clock3, MoreHorizontal, Edit2, Loader2, Trash2, Music, Globe, Lock, X, Search, Plus, CheckCircle2, ShieldCheck, Flag, Sparkles } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import LikeButton from '@/components/ui/LikeButton';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import MobileSongMenu from '@/components/ui/MobileSongMenu';
import ReportDialog from '@/components/ui/ReportDialog';
import Link from 'next/link';
import Image from 'next/image';
import { getErrorMessage } from '@/lib/errors';
import { compressImage } from '@/lib/imageCompression';
import { isModUser } from '@/lib/admin';
import { useTranslation } from 'react-i18next';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const formatter = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  return formatter.format(date);
}

interface PlaylistData {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  is_official: boolean;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  } | null;
}

export default function PlaylistPage() {
  const params = useParams();
  const playlistId = params?.id as string;
  const router = useRouter();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const shouldOpenAddSearch = searchParams?.get('add') === '1';
  
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue } = usePlayer();
  const supabase = useMemo(() => createClient(), []);
  
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [songs, setSongs] = useState<(Song & { added_at?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [songSearchResults, setSongSearchResults] = useState<Song[]>([]);
  const [songSearchLoading, setSongSearchLoading] = useState(false);
  const [addingSongId, setAddingSongId] = useState<string | null>(null);
  const addSearchInputRef = useRef<HTMLInputElement>(null);
  
  // Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadPlaylistData() {
      if (!playlistId) return;
      
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const dbPlaylistId = playlistId === 'daily-new-releases'
          ? 'da114eeb-ecea-5e55-9ee1-ea5e5da11111'
          : playlistId;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(dbPlaylistId)) {
          const { data: saveRelation } = await supabase
            .from('playlist_saves')
            .select('playlist_id')
            .eq('user_id', session.user.id)
            .eq('playlist_id', dbPlaylistId)
            .maybeSingle();
          setIsSaved(!!saveRelation);
        }
      }
      
      // Handle dynamic "Daily New Releases" playlist
      if (playlistId === 'daily-new-releases') {
        setPlaylist({
          id: 'daily-new-releases',
          user_id: 'system',
          title: t('playlists.dailyNewReleases.title'),
          description: t('playlists.dailyNewReleases.description'),
          cover_url: null, // Will render standard icon or we can provide an image
          is_public: true,
          is_official: true,
          created_at: new Date().toISOString(),
          profiles: {
            username: 'YORIAX Team',
            avatar_url: null
          }
        });
        setIsOwner(false);
        setIsAdmin(false);
        
        const { data: latestSongs, error } = await supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays, audio_url, duration, genre, album:albums(id, title)')
          .order('created_at', { ascending: false })
          .limit(20);
          
        if (!error && latestSongs) {
          setSongs(latestSongs as unknown as Song[]);
        }
        setLoading(false);
        return;
      }

      // 1. Fetch Playlist details
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('id, user_id, title, description, cover_url, is_public, is_official, created_at, profiles(username, avatar_url)')
        .eq('id', playlistId)
        .single();
        
      if (playlistError || !playlistData) {
        console.error('Playlist not found:', playlistError);
        router.push('/playlists');
        return;
      }
      
      setPlaylist(playlistData as unknown as PlaylistData);
      setEditTitle(playlistData.title);
      setEditDescription(playlistData.description || '');
      
      if (session?.user && session.user.id === playlistData.user_id) {
        setIsOwner(true);
      }
      
      if (session?.user && isModUser(session.user)) {
        setIsAdmin(true);
      }
      
      // 2. Fetch Songs in playlist
      const { data: mappingData } = await supabase
        .from('playlist_songs')
        .select('song_id, added_at')
        .eq('playlist_id', playlistId)
        .order('added_at', { ascending: false });
        
      if (mappingData && mappingData.length > 0) {
        const songIds = mappingData.map(m => m.song_id);
        const { data: songsData } = await supabase
          .from('songs')
          .select('id, title, artist_name, cover_url, plays, audio_url, duration, genre, album:albums(id, title)')
          .in('id', songIds);
          
        if (songsData) {
          // Reorder songs based on added_at mapping
          const orderedSongs = mappingData.map(m => {
            const s = songsData.find(s => s.id === m.song_id);
            if (s) {
              return { ...s, added_at: m.added_at };
            }
            return null;
          }).filter(Boolean) as unknown as (Song & { added_at?: string })[];
          setSongs(orderedSongs);
        }
      }
      
      setLoading(false);
    }
    
    loadPlaylistData();
  }, [playlistId, supabase, router, t]);

  useEffect(() => {
    if (!shouldOpenAddSearch || loading || !isOwner) return;
    addSearchInputRef.current?.focus();
  }, [isOwner, loading, shouldOpenAddSearch]);

  useEffect(() => {
    if (!isOwner) return;

    const trimmedQuery = songSearchQuery.trim();
    if (trimmedQuery.length < 2) {
      return;
    }

    let isActive = true;

    async function searchSongs() {
      setSongSearchLoading(true);
      const searchPattern = `%${trimmedQuery}%`;
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist_name, cover_url, plays')
        .or(`title.ilike.${searchPattern},artist_name.ilike.${searchPattern}`)
        .order('plays', { ascending: false })
        .limit(12);

      if (!isActive) return;
      if (error) {
        console.error('Song search failed:', error);
        setSongSearchResults([]);
      } else {
        setSongSearchResults((data || []) as unknown as Song[]);
      }
      setSongSearchLoading(false);
    }

    const timer = window.setTimeout(searchSongs, 250);
    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [isOwner, songSearchQuery, supabase]);

  useEffect(() => {
    const handleRemoved = (pid: string, sid: string) => {
      if (pid === playlistId) {
        setSongs(prev => prev.filter(s => s.id !== sid));
      }
    };
    
    const handleAdded = async (pid: string, sid: string) => {
      if (pid === playlistId) {
        const { data } = await supabase.from('songs').select('id, title, artist_name, cover_url, plays, audio_url, duration, genre').eq('id', sid).single();
        if (data) {
          setSongs(prev => [data as unknown as Song, ...prev]);
        }
      }
    };
    
    // Assign to window for direct synchronous calls
    window.removeSongFromPlaylistPage = handleRemoved;
    window.addSongToPlaylistPage = handleAdded;
    
    return () => {
      delete window.removeSongFromPlaylistPage;
      delete window.addSongToPlaylistPage;
    };
  }, [playlistId, supabase]);

  const handlePlayAll = useCallback(() => {
    if (songs.length === 0) return;
    const queueWithNames = songs.map(s => ({ ...s, creatorName: s.artist_name || 'Creator' }));
    setQueue(queueWithNames, 0);
    playSong({ ...songs[0], creatorName: songs[0].artist_name || 'Creator' });
  }, [songs, setQueue, playSong]);

  const handleToggleSave = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const dbPlaylistId = playlistId === 'daily-new-releases'
        ? 'da114eeb-ecea-5e55-9ee1-ea5e5da11111'
        : playlistId;
        
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dbPlaylistId)) {
        return;
      }

      if (isSaved) {
        const { error } = await supabase
          .from('playlist_saves')
          .delete()
          .eq('user_id', session.user.id)
          .eq('playlist_id', dbPlaylistId);
          
        if (error) throw error;
        setIsSaved(false);
      } else {
        const { error } = await supabase
          .from('playlist_saves')
          .insert({
            user_id: session.user.id,
            playlist_id: dbPlaylistId
          });
          
        if (error) throw error;
        setIsSaved(true);
      }
    } catch (err) {
      console.error('Error toggling save status:', err);
      alert(t('playlist.addError') + getErrorMessage(err));
    }
  }, [playlistId, isSaved, supabase, router, t]);

  const handleSaveTitle = useCallback(async () => {
    if (!playlist || !isOwner || editTitle.trim() === playlist.title) {
      setIsEditingTitle(false);
      setEditTitle(playlist?.title || '');
      return;
    }
    
    const newTitle = editTitle.trim() || 'Unbenannte Playlist';
    try {
      const { error } = await supabase
        .from('playlists')
        .update({ title: newTitle })
        .eq('id', playlistId);
        
      if (error) throw error;
      setPlaylist({ ...playlist, title: newTitle });
    } catch (err: unknown) {
      console.error('Error updating title:', err);
      alert('Fehler beim Aktualisieren: ' + getErrorMessage(err));
      setEditTitle(playlist.title);
    } finally {
      setIsEditingTitle(false);
    }
  }, [playlist, isOwner, editTitle, playlistId, supabase]);

  const handleSaveDetails = useCallback(async () => {
    if (!playlist || !isOwner) return;
    const newTitle = editTitle.trim() || 'Unbenannte Playlist';
    try {
      const { error } = await supabase
        .from('playlists')
        .update({ title: newTitle, description: editDescription.trim() })
        .eq('id', playlistId);
        
      if (error) throw error;
      setPlaylist({ ...playlist, title: newTitle, description: editDescription.trim() });
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      console.error('Error updating details:', err);
      alert('Fehler beim Aktualisieren: ' + getErrorMessage(err));
    }
  }, [playlist, isOwner, editTitle, editDescription, playlistId, supabase]);

  const handleTogglePublic = useCallback(async () => {
    if (!playlist) return;
    
    const newStatus = !playlist.is_public;
    const { error } = await supabase
      .from('playlists')
      .update({ is_public: newStatus })
      .eq('id', playlist.id);
      
    if (!error) {
      setPlaylist({ ...playlist, is_public: newStatus });
    }
  }, [playlist, supabase]);

  const handleToggleOfficial = useCallback(async () => {
    if (!playlist) return;
    
    const newStatus = !playlist.is_official;
    const { error } = await supabase
      .from('playlists')
      .update({ is_official: newStatus })
      .eq('id', playlist.id);
      
    if (!error) {
      setPlaylist({ ...playlist, is_official: newStatus });
    }
  }, [playlist, supabase]);

  const handleDeletePlaylist = useCallback(async () => {
    if (!playlist || !isOwner) return;
    const confirmed = window.confirm(t('playlist.deleteConfirm'));
    if (!confirmed) return;
    
    try {
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId);
        
      if (error) throw error;
      router.push('/playlists');
    } catch (err: unknown) {
      console.error('Error deleting playlist:', err);
      alert(t('playlist.deleteError') + getErrorMessage(err));
    }
  }, [playlist, isOwner, t, playlistId, supabase, router]);

  const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !isOwner || !playlist) return;

    setIsUploadingCover(true);
    
    try {
      file = await compressImage(file);
      const ext = file.name.split('.').pop();
      const path = `playlists/${playlistId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('covers')
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('playlists')
        .update({ cover_url: data.publicUrl })
        .eq('id', playlist.id);

      if (updateError) throw updateError;

      setPlaylist({ ...playlist, cover_url: data.publicUrl });
    } catch (err: unknown) {
      console.error('Error uploading cover:', err);
      alert('Fehler beim Hochladen des Covers: ' + getErrorMessage(err));
    } finally {
      setIsUploadingCover(false);
    }
  }, [isOwner, playlist, playlistId, supabase]);

  const handleSongSearchQueryChange = useCallback((value: string) => {
    setSongSearchQuery(value);

    if (value.trim().length < 2) {
      setSongSearchResults([]);
      setSongSearchLoading(false);
    }
  }, []);

  const handleAddSongFromSearch = useCallback(async (song: Song) => {
    if (!isOwner || addingSongId) return;

    setAddingSongId(song.id);
    try {
      const { error } = await supabase
        .from('playlist_songs')
        .insert({ playlist_id: playlistId, song_id: song.id });

      if (error && error.code !== '23505') throw error;

      setSongs((previousSongs) => {
        if (previousSongs.some((existingSong) => existingSong.id === song.id)) return previousSongs;
        return [{ ...song, added_at: new Date().toISOString() }, ...previousSongs];
      });
    } catch (err: unknown) {
      console.error('Error adding song to playlist:', err);
      alert(t('playlist.addError') + getErrorMessage(err));
    } finally {
      setAddingSongId(null);
    }
  }, [isOwner, addingSongId, playlistId, supabase, t]);

  const removeSongFromPlaylist = useCallback(async (songId: string) => {
    if (!confirm(t('playlist.removeConfirm'))) return;
    
    try {
      await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('song_id', songId);
        
      setSongs(songs.filter(s => s.id !== songId));
    } catch (err) {
      console.error(err);
      alert(t('playlist.removeError') + getErrorMessage(err));
    }
  }, [t, playlistId, supabase, songs]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      {/* Background Gradient matching cover or generic */}
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none z-0">
        <div className="w-full h-full bg-gradient-to-b from-blue-900/40 via-[#0A0A0A]/80 to-[#0A0A0A]" />
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white md:left-8 md:top-8"
        aria-label={t('charts.back')}
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      
      {/* Hero Content */}
      <div className="group relative z-10 flex flex-col items-center gap-5 px-5 pb-8 pt-20 text-center md:flex-row md:items-end md:gap-6 md:px-10 md:pt-24 md:text-left">
        
        {/* Cover Art */}
        <div 
          className="group/cover relative flex h-44 w-44 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-[#282828] shadow-2xl sm:h-48 sm:w-48 md:h-56 md:w-56"
          onClick={() => isOwner && fileInputRef.current?.click()}
        >
          {playlist.id === 'daily-new-releases' ? (
            <div className="w-full h-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-20 h-20 text-white" />
            </div>
          ) : playlist.cover_url ? (
            <Image
              src={playlist.cover_url}
              alt={playlist.title}
              fill
              sizes="(max-width: 768px) 176px, (max-width: 1024px) 192px, 224px"
              className="object-cover"
              priority
            />
          ) : (
            <Music className="w-20 h-20 text-white/20" />
          )}
          
          {isOwner && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
              {isUploadingCover ? (
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              ) : (
                <>
                  <Edit2 className="w-8 h-8 text-white mb-2" />
                  <span className="text-sm font-medium text-white">{t('playlist.changeCover')}</span>
                </>
              )}
            </div>
          )}
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleCoverUpload} />
        </div>

        {/* Info */}
        <div className="flex w-full min-w-0 flex-col items-center gap-3 pb-2 md:items-start">
          <span className="text-sm font-bold text-white uppercase tracking-wider">Playlist</span>
          
          {isEditingTitle ? (
            <input 
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
              autoFocus
              className="w-full border-b border-white/50 bg-transparent text-center text-4xl font-black text-white focus:border-white focus:outline-none sm:text-5xl md:text-left md:text-7xl"
            />
          ) : (
            <h1 
              className={`max-w-full break-words text-center text-4xl font-black tracking-tighter text-white sm:text-5xl md:text-left md:text-7xl md:truncate ${isOwner ? 'cursor-pointer hover:underline' : ''}`}
              onClick={() => isOwner && setIsEditingTitle(true)}
              title={isOwner ? t('playlist.clickToEdit') || "Click to edit" : ""}
            >
              {playlist.title}
            </h1>
          )}
          
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-white/70 md:justify-start">
            {playlist.profiles?.username === 'YORIAX Team' ? (
              <Image src="/brand/yoriax-symbol.png" alt="YORIAX" width={24} height={24} className="h-6 w-6 object-contain" />
            ) : playlist.profiles?.avatar_url ? (
              <Image src={playlist.profiles.avatar_url} alt={playlist.profiles.username} width={24} height={24} className="rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center text-xs text-white">
                {playlist.profiles?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <span className="text-white hover:underline cursor-pointer flex items-center gap-1">
              {playlist.profiles?.username === 'Unbekannt' || !playlist.profiles?.username ? t('guestHome.unknownArtist') : playlist.profiles.username}
              {playlist.profiles?.username === 'YORIAX Team' && (
                <ShieldCheck className="h-4 w-4 text-teal-300" />
              )}
            </span>
            <span>•</span>
            <span>{t('playlist.songCount', { count: songs.length })}</span>
            <span>•</span>
            {playlist.is_official ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-500/10 px-2 py-0.5 text-xs font-semibold text-teal-300 border border-teal-500/20">
                <Globe className="h-3 w-3" />
                {t('playlist.official') || 'Official'}
              </span>
            ) : playlist.is_public ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80 border border-white/5">
                <Globe className="h-3 w-3" />
                {t('playlist.public')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-white/50 border border-white/5">
                <Lock className="h-3 w-3" />
                {t('playlist.private') || 'Private'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 min-h-screen bg-[#0A0A0A] px-4 py-6 md:px-10">
        
        {/* Action Bar */}
        <div className="mb-10 flex items-center justify-center gap-6 md:justify-start">
          <button 
            onClick={handlePlayAll}
            disabled={songs.length === 0}
            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white hover:scale-105 transition-transform shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isPlaying && songs.some(s => s.id === currentSong?.id) ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current" />
            )}
          </button>

          {!isOwner && (
            <button
              onClick={handleToggleSave}
              className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold shadow-xl transition-transform hover:scale-105 ${
                isSaved
                  ? 'border-white/10 bg-white/10 text-white hover:bg-white/20'
                  : 'border-white/20 bg-white text-black hover:bg-gray-200'
              }`}
            >
              {isSaved ? t('playlist.unsavePlaylist') : t('playlist.savePlaylist')}
            </button>
          )}
          
          <div className="relative" ref={menuRef}>
            <button 
              className="text-white/50 hover:text-white transition-colors p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <MoreHorizontal className="w-8 h-8" />
            </button>
            
            {isMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-[#282828] rounded-md shadow-lg border border-white/10 overflow-hidden z-50 py-1">
                {(isOwner || isAdmin) && (
                  <>
                    <button 
                      className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex items-center gap-3 transition-colors"
                      onClick={() => { setIsMenuOpen(false); setIsEditModalOpen(true); }}
                    >
                      <Edit2 className="w-4 h-4 text-white/70" />
                      {t('playlist.editDetails')}
                    </button>
                    {isOwner && (
                      <button 
                        className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex items-center gap-3 transition-colors"
                        onClick={() => { setIsMenuOpen(false); handleTogglePublic(); }}
                      >
                        {playlist.is_public ? (
                          <><Lock className="w-4 h-4 text-white/70" /> {t('playlist.markPrivate')}</>
                        ) : (
                          <><Globe className="w-4 h-4 text-white/70" /> {t('playlist.markPublic')}</>
                        )}
                      </button>
                    )}
                    {isAdmin && (
                      <button 
                        className="w-full text-left px-4 py-3 text-sm text-teal-300 hover:bg-white/10 flex items-center gap-3 transition-colors"
                        onClick={() => { setIsMenuOpen(false); handleToggleOfficial(); }}
                      >
                        {playlist.is_official ? (
                          <><Lock className="w-4 h-4 text-teal-300/70" /> {t('playlist.removeOfficial')}</>
                        ) : (
                          <><Globe className="w-4 h-4 text-teal-300/70" /> {t('playlist.markOfficial')}</>
                        )}
                      </button>
                    )}
                    <div className="h-px w-full bg-white/10 my-1"></div>
                    <button 
                      className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/10 flex items-center gap-3 transition-colors"
                      onClick={() => { setIsMenuOpen(false); handleDeletePlaylist(); }}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('playlist.deletePlaylist')}
                    </button>
                    <div className="h-px w-full bg-white/10 my-1"></div>
                  </>
                )}
                
                <ReportDialog 
                  entityType="playlist" 
                  entityId={playlist.id} 
                  entityName={playlist.title} 
                  trigger={
                    <button className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/10 flex items-center gap-3 transition-colors">
                      <Flag className="w-4 h-4" />
                      {t('playlist.report')}
                    </button>
                  }
                />
              </div>
            )}
          </div>
        </div>

        {isOwner ? (
          <div className="mb-10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20">
            <div className="border-b border-white/10 px-5 py-4 md:px-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-black text-white">{t('playlist.addSongsTitle')}</h2>
                <p className="text-sm font-medium text-white/45">
                  {t('playlist.addSongsDesc')}
                </p>
              </div>
            </div>

            <div className="p-4 md:p-6">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
                <input
                  ref={addSearchInputRef}
                  type="search"
                  value={songSearchQuery}
                  onChange={(event) => handleSongSearchQueryChange(event.target.value)}
                  placeholder={t('playlist.searchSongsPlaceholder')}
                  className="w-full rounded-2xl border border-white/10 bg-black/35 py-3.5 pl-12 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-primary/60 focus:bg-black/50"
                  aria-label={t('playlist.searchSongsAria')}
                />
              </label>

              {songSearchQuery.trim().length > 0 && songSearchQuery.trim().length < 2 ? (
                <p className="mt-3 text-sm font-medium text-white/40">{t('playlist.minCharacters')}</p>
              ) : null}

              {songSearchLoading ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-4 text-sm font-semibold text-white/55">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('playlist.searching')}
                </div>
              ) : songSearchQuery.trim().length >= 2 && songSearchResults.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-5 text-sm font-semibold text-white/45">
                  {t('playlist.noSongsFound')}
                </div>
              ) : songSearchResults.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {songSearchResults.map((song) => {
                    const alreadyAdded = songs.some((existingSong) => existingSong.id === song.id);

                    return (
                      <button
                        key={song.id}
                        type="button"
                        onClick={() => handleAddSongFromSearch(song)}
                        disabled={alreadyAdded || addingSongId !== null}
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-left transition-colors hover:border-primary/40 hover:bg-white/[0.07] disabled:cursor-default disabled:opacity-60 disabled:hover:border-white/10 disabled:hover:bg-white/[0.025]"
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#282828] flex items-center justify-center">
                          {song.cover_url ? (
                            <Image src={song.cover_url} alt={song.title} fill sizes="48px" className="object-cover" loading="lazy" />
                          ) : (
                            <Music className="w-5 h-5 text-white/20" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-white">{song.title}</div>
                          <div className="truncate text-xs font-semibold text-white/45">{song.artist_name || 'Creator'}</div>
                        </div>
                        {addingSongId === song.id ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : alreadyAdded ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-black text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            {t('playlist.added')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-black">
                            <Plus className="h-4 w-4" />
                            {t('playlist.add')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}


        {/* Songs List */}
        <div className="mb-12">
          {songs.length > 0 ? (
            <div className="flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-[16px_1fr_50px] md:grid-cols-[24px_2fr_1.5fr_1fr_120px] gap-4 px-4 py-2 border-b border-white/10 text-xs text-white/40 uppercase tracking-wider mb-2">
                <div>#</div>
                <div>{t('song.title')}</div>
                <div className="hidden md:block">Album</div>
                <div className="hidden md:block">{t('playlist.addedAtCol')}</div>
                <div className="text-right flex items-center justify-end"><Clock3 className="w-4 h-4" /></div>
              </div>

              {songs.map((song, index) => {
                const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
                const displayArtist = song.artist_name || t('guestHome.unknownArtist');
                
                return (
                  <div 
                    key={song.id}
                    onClick={() => {
                    if (currentSong?.id !== song.id) {
                      const queueWithNames = songs.map(s => ({ ...s, creatorName: s.artist_name || 'Creator' }));
                      setQueue(queueWithNames, index);
                      playSong({ ...song, creatorName: displayArtist });
                    }
                      else togglePlayPause();
                    }}
                    className="grid grid-cols-[16px_1fr_50px] md:grid-cols-[24px_2fr_1.5fr_1fr_120px] gap-4 px-4 py-2.5 rounded-lg hover:bg-white/5 group cursor-pointer items-center transition-colors"
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
                      <div className="relative w-10 h-10 shrink-0 bg-[#282828] rounded flex items-center justify-center overflow-hidden">
                        {song.cover_url ? (
                          <Image
                            src={song.cover_url}
                            alt={song.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Music className="w-5 h-5 text-white/20" />
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className={`text-base font-medium truncate ${currentSong?.id === song.id ? 'text-primary' : 'text-white/90'}`}>
                          {song.title}
                        </span>
                        <Link href={`/artist/${encodeURIComponent(displayArtist)}`} onClick={e => e.stopPropagation()} className="text-sm text-white/50 hover:underline hover:text-white truncate">
                          {displayArtist}
                        </Link>
                      </div>
                    </div>
                    
                    <Link 
                      href={song.album_id ? `/album/${song.album_id}` : `/song/${song.id}`} 
                      onClick={e => e.stopPropagation()} 
                      className="hidden md:flex items-center text-sm text-white/50 hover:text-white hover:underline truncate"
                    >
                      {song.album?.title || song.title}
                    </Link>

                    <div className="hidden md:flex items-center text-sm text-white/50 truncate">
                      {formatDate(song.added_at)}
                    </div>

                    <div className="text-right text-sm text-white/50 tracking-wider flex items-center justify-end gap-3">
                      <div onClick={(e) => e.stopPropagation()} className="hidden md:flex items-center gap-4 mr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <LikeButton songId={song.id} iconClassName="w-5 h-5" />
                        <PlaylistAddButton 
                          songId={song.id} 
                          iconClassName="w-5 h-5" 
                          currentPlaylistId={playlistId}
                          onRemoveFromCurrent={isOwner ? () => removeSongFromPlaylist(song.id) : undefined}
                        />
                      </div>
                      
                      <span className="w-12 text-right hidden sm:block">{formatDuration(song.duration)}</span>
                      <div className="-mr-2 md:hidden" onClick={(e) => e.stopPropagation()}>
                        <MobileSongMenu song={song} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border-t border-white/5">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Music className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t('playlist.findMusicTitle')}</h3>
              <p className="text-white/50 text-sm mb-6">
                {isOwner
                  ? t('playlist.findMusicSearchDesc')
                  : t('playlist.findMusicDiscoverDesc')}
              </p>
              {!isOwner ? (
                <Link href="/charts/viral" className="px-6 py-2.5 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform">
                  {t('playlist.browseCharts')}
                </Link>
              ) : null}
            </div>
          )}
        </div>
        
      </div>

      {/* Edit Details Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center backdrop-blur-sm p-4" onClick={() => setIsEditModalOpen(false)}>
          <div className="bg-[#282828] rounded-xl w-full max-w-[520px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">{t('playlist.editDetails')}</h2>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-white/50 hover:text-white transition-colors p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Body */}
              <div className="flex gap-4 mb-4">
                {/* Left: Image Upload */}
                <div 
                  className="relative w-44 h-44 shrink-0 bg-[#333] rounded shadow-md group cursor-pointer flex items-center justify-center overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {playlist.cover_url ? (
                    <Image src={playlist.cover_url} alt="Cover" fill sizes="176px" className="object-cover" />
                  ) : (
                    <Music className="w-16 h-16 text-white/20" />
                  )}
                  
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isUploadingCover ? (
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                    ) : (
                      <>
                        <Edit2 className="w-8 h-8 text-white mb-2" />
                        <span className="text-sm font-medium text-white text-center px-2">{t('playlist.selectPhoto')}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Inputs */}
                <div className="flex flex-col gap-3 flex-1">
                  <input 
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#3E3E3E] text-white text-sm rounded p-3 outline-none focus:bg-[#4a4a4a] transition-colors"
                    placeholder={t('playlist.addNamePlaceholder')}
                  />
                  <textarea 
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-[#3E3E3E] text-white text-sm rounded p-3 outline-none focus:bg-[#4a4a4a] transition-colors resize-none flex-1 min-h-[100px]"
                    placeholder={t('playlist.addDescPlaceholder')}
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end mb-4">
                <button 
                  onClick={handleSaveDetails}
                  className="bg-white text-black font-bold px-8 py-3 rounded-full hover:scale-105 transition-transform"
                >
                  {t('playlist.save')}
                </button>
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] font-bold text-white/90">
                {t('playlist.consentText')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
