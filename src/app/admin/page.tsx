'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ShieldAlert, Users, Music, Trash2, Search, ArrowLeft, Radio, UploadCloud, Loader2, Edit2, FileAudio, Terminal, Play, Heart, Activity, UserPlus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { isAdminUser, isModUser } from '@/lib/admin';

type AdminTab = 'users' | 'songs' | 'approvals' | 'moderation' | 'ads' | 'bot';

interface McpLog {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  response_summary: string;
  created_at: string;
}

interface ProfileData {
  id: string;
  username: string;
  email?: string;
  last_active_at?: string;
  country?: string;
  created_at: string;
  subscription_tier: string;
  followers_count: number;
  avatar_url?: string;
  is_banned?: boolean;
  role?: string;
}

interface SongData {
  id: string;
  title: string;
  artist_name: string;
  plays: number;
  ai_tool?: string;
  created_at: string;
  is_approved?: boolean;
  audio_url?: string;
  cover_url?: string;
  is_spotlight?: boolean;
  spotlight_copy?: string | null;
}

function openTrustedExternalUrl(value?: string | null) {
  if (!value) return;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  } catch {
    // Ignore malformed URLs from pending creator submissions.
  }
}

interface Report {
  id: string;
  status: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  created_at: string;
  [key: string]: unknown;
}

interface AdFile {
  id?: string | number;
  name: string;
  created_at?: string;
  metadata?: { size?: number; [key: string]: unknown };
  [key: string]: unknown;
}
export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isFullAdmin, setIsFullAdmin] = useState(false);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [songs, setSongs] = useState<SongData[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploadingAd, setIsUploadingAd] = useState(false);
  const [uploadAdStatus, setUploadAdStatus] = useState<string | null>(null);
  const [adFiles, setAdFiles] = useState<AdFile[]>([]);
  const [isReplacingAudio, setIsReplacingAudio] = useState<string | null>(null);
  const [mcpLogs, setMcpLogs] = useState<McpLog[]>([]);

  // Analytics
  const [totalStreams, setTotalStreams] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [dailyActiveUsers, setDailyActiveUsers] = useState(0);

  // Ad Settings
  const [adFrequency, setAdFrequency] = useState(3);
  const [isSavingAdFreq, setIsSavingAdFreq] = useState(false);


  const supabase = createClient();

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        router.push('/login');
        return;
      }

      if (!isModUser(user)) {
        router.push('/');
        return;
      }

      const adminCheck = isAdminUser(user);
      setIsAuthorized(true);
      setIsFullAdmin(adminCheck);

      if (!adminCheck) {
        setActiveTab('moderation');
      }

      if (adminCheck) {
        // Load Users
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, created_at, subscription_tier, followers_count, email, country, last_active_at, avatar_url, is_banned, role')
          .order('created_at', { ascending: false });

        if (profilesData) setProfiles(profilesData);

        // Load Songs & Streams
        const { data: songsData } = await supabase
          .from('songs')
          .select('id, title, artist_name, plays, ai_tool, created_at, is_approved, audio_url, cover_url, is_spotlight, spotlight_copy')
          .order('created_at', { ascending: false });

        if (songsData) {
          setSongs(songsData);
          setTotalStreams(songsData.reduce((acc, song) => acc + (song.plays || 0), 0));
        }

        // Load Analytics
        const { count: likesCount } = await supabase.from('liked_songs').select('*', { count: 'exact', head: true });
        if (likesCount) setTotalLikes(likesCount);

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: dauCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_active_at', yesterday);
        if (dauCount) setDailyActiveUsers(dauCount);

        // Load Ad Frequency
        const { data: settingsData } = await supabase.from('app_settings').select('ad_frequency').eq('id', 'global').single();
        if (settingsData) setAdFrequency(settingsData.ad_frequency);

        // Load Ads
        const { data: adsData } = await supabase.storage.from('ads').list();
        if (adsData) {
          // Filter out hidden files like .emptyFolderPlaceholder
          setAdFiles(adsData.filter(f => f.name !== '.emptyFolderPlaceholder') as unknown as AdFile[]);
        }

        // Load MCP Logs
        const { data: mcpData } = await supabase
          .from('mcp_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (mcpData) setMcpLogs(mcpData);
      }

      // Load Reports
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportsData) setReports(reportsData);

      setIsLoading(false);
    };

    checkAuthAndLoadData();
  }, [router, supabase]);

  const handleDeleteSong = async (id: string, title: string) => {
    if (!window.confirm(`Möchtest du den Song "${title}" wirklich unwiderruflich löschen?`)) return;

    const { error } = await supabase.from('songs').delete().eq('id', id);
    if (!error) {
      setSongs(prev => prev.filter(s => s.id !== id));
    } else {
      alert('Fehler beim Löschen des Songs: ' + error.message);
    }
  };

  const handleEditSongTitle = async (id: string, currentTitle: string) => {
    const newTitle = window.prompt(`Neuen Titel für "${currentTitle}" eingeben:`, currentTitle);
    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) return;

    const { error } = await supabase.from('songs').update({ title: newTitle.trim() }).eq('id', id);
    if (!error) {
      setSongs(prev => prev.map(s => s.id === id ? { ...s, title: newTitle.trim() } : s));
    } else {
      alert('Fehler beim Ändern des Songtitels: ' + error.message);
    }
  };

  const handleEditSpotlightCopy = async (id: string, title: string, currentCopy: string | null) => {
    const next = window.prompt(
      `Spotlight-Text für "${title}" (leer lassen für Default-Text):`,
      currentCopy ?? '',
    );
    if (next === null) return;
    const trimmed = next.trim();
    const value = trimmed.length > 0 ? trimmed : null;

    const previousSongs = songs;
    setSongs(prev => prev.map(song => song.id === id ? { ...song, spotlight_copy: value } : song));

    const { error } = await supabase
      .from('songs')
      .update({ spotlight_copy: value })
      .eq('id', id);

    if (error) {
      setSongs(previousSongs);
      alert('Fehler beim Speichern des Spotlight-Texts: ' + error.message);
    }
  };

  const handleSetSpotlightSong = async (id: string, title: string) => {
    if (!window.confirm(`Möchtest du "${title}" als Home-Spotlight setzen? Das ersetzt das aktuelle Spotlight.`)) return;

    const previousSongs = songs;
    setSongs(prev => prev.map(song => ({ ...song, is_spotlight: song.id === id })));

    const { error: clearError } = await supabase
      .from('songs')
      .update({ is_spotlight: false })
      .eq('is_spotlight', true);

    if (clearError) {
      setSongs(previousSongs);
      alert('Fehler beim Zurücksetzen des Spotlights: ' + clearError.message);
      return;
    }

    const { error: setError } = await supabase
      .from('songs')
      .update({ is_spotlight: true })
      .eq('id', id);

    if (setError) {
      setSongs(previousSongs);
      alert('Fehler beim Setzen des Spotlights: ' + setError.message);
    }
  };

  const handleReplaceAudio = async (event: React.ChangeEvent<HTMLInputElement>, id: string, title: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Bitte lade eine gültige Audiodatei hoch (mp3, wav, m4a).');
      event.target.value = '';
      return;
    }

    if (!window.confirm(`Möchtest du die Audiodatei für den Song "${title}" wirklich durch die neue ersetzen?`)) {
      event.target.value = '';
      return;
    }

    setIsReplacingAudio(id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'admin';

      const audioExt = file.name.split('.').pop();
      // eslint-disable-next-line react-hooks/purity
      const audioPath = `${userId}/replaced_${Date.now()}_song.${audioExt}`;

      const { error: uploadError } = await supabase.storage
        .from('songs')
        .upload(audioPath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl: audioUrl } } = supabase.storage
        .from('songs')
        .getPublicUrl(audioPath);

      const { error: updateError } = await supabase
        .from('songs')
        .update({ audio_url: audioUrl })
        .eq('id', id);

      if (updateError) throw updateError;

      alert('Audiodatei erfolgreich ausgetauscht!');
    } catch (err: unknown) {
      alert('Fehler beim Austauschen der Audiodatei: ' + (err as Error).message);
    } finally {
      setIsReplacingAudio(null);
      event.target.value = '';
    }
  };

  const handleToggleBan = async (id: string, currentStatus: boolean, username: string) => {
    if (!window.confirm(`Möchtest du den Nutzer "${username}" wirklich ${currentStatus ? 'entsperren' : 'sperren'}?`)) return;

    const { error } = await supabase.from('profiles').update({ is_banned: !currentStatus }).eq('id', id);
    if (!error) {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, is_banned: !currentStatus } : p));
    } else {
      alert('Fehler beim Ändern des Status: ' + error.message);
    }
  };

  const handleRoleChange = async (id: string, newRole: string, username: string) => {
    if (!window.confirm(`Möchtest du die Rolle von "${username}" wirklich zu "${newRole.toUpperCase()}" ändern?`)) return;

    try {
      const { error } = await supabase.rpc('set_user_role', { target_user_id: id, new_role: newRole });
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, role: newRole } : p));
    } catch (err: unknown) {
      alert('Fehler beim Ändern der Rolle: ' + (err as Error).message);
    }
  };

  const loadAds = async () => {
    const { data: adsData } = await supabase.storage.from('ads').list();
    if (adsData) {
      setAdFiles(adsData.filter(f => f.name !== '.emptyFolderPlaceholder') as unknown as AdFile[]);
    }
  };

  const handleAdUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Bitte lade eine gültige Audiodatei hoch (mp3, m4a, wav).');
      return;
    }

    setIsUploadingAd(true);
    setUploadAdStatus('Lädt hoch...');

    try {
      const extension = file.name.split('.').pop();
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

      const { error } = await supabase.storage
        .from('ads')
        .upload(uniqueFileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      setUploadAdStatus('Erfolgreich hochgeladen!');
      event.target.value = '';
      await loadAds();
      setTimeout(() => setUploadAdStatus(null), 5000);
    } catch (err: unknown) {
      setUploadAdStatus(null);
      alert('Fehler beim Hochladen der Werbung: ' + (err as Error).message);
    } finally {
      setIsUploadingAd(false);
    }
  };

  const handleAdDelete = async (fileName: string) => {
    if (!window.confirm(`Möchtest du die Werbung "${fileName}" wirklich löschen?`)) return;

    try {
      const { error } = await supabase.storage.from('ads').remove([fileName]);
      if (error) throw error;
      await loadAds();
    } catch (err: unknown) {
      alert('Fehler beim Löschen der Werbung: ' + (err as Error).message);
    }
  };

  const handleSaveAdFrequency = async () => {
    setIsSavingAdFreq(true);
    try {
      const { error } = await supabase.from('app_settings').update({ ad_frequency: adFrequency }).eq('id', 'global');
      if (error) throw error;
      alert('Werbe-Intervall erfolgreich gespeichert!');
    } catch (err: unknown) {
      alert('Fehler beim Speichern des Werbe-Intervalls: ' + (err as Error).message);
    } finally {
      setIsSavingAdFreq(false);
    }
  };

  const handleApproveSong = async (id: string, title: string) => {
    const { error } = await supabase.from('songs').update({ is_approved: true }).eq('id', id);
    if (!error) {
      setSongs(songs.map(s => s.id === id ? { ...s, is_approved: true } : s));
      alert(`Song "${title}" wurde freigegeben.`);
    } else {
      alert('Fehler beim Freigeben: ' + error.message);
    }
  };

  const handleRejectSong = async (id: string, title: string) => {
    if (confirm(`Möchtest du den Song "${title}" wirklich ablehnen und löschen?`)) {
      const { error } = await supabase.from('songs').delete().eq('id', id);
      if (!error) {
        setSongs(songs.filter(s => s.id !== id));
        alert(`Song "${title}" wurde gelöscht.`);
      } else {
        alert('Fehler beim Ablehnen: ' + error.message);
      }
    }
  };

  const filteredProfiles = profiles.filter(p => p.username?.toLowerCase().includes(searchTerm.toLowerCase()) || p.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  const liveSongs = songs.filter(s => s.is_approved !== false);
  const pendingSongs = songs.filter(s => s.is_approved === false);
  const filteredSongs = liveSongs.filter(s => s.title?.toLowerCase().includes(searchTerm.toLowerCase()) || s.artist_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-500" />
                <h1 className="text-xl font-bold text-white">
                  {isFullAdmin ? 'Admin Dashboard' : 'Moderation Dashboard'}
                </h1>
              </div>
            </div>
            {isFullAdmin && (
              <div className="text-sm font-medium text-white/50">
                {profiles.length} Nutzer • {songs.length} Songs
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* KPI Cards */}
        {isFullAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/50">Total Streams</p>
                <p className="text-2xl font-bold text-white">{totalStreams.toLocaleString('de-DE')}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-500/20 text-pink-400 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/50">Gespeicherte Tracks</p>
                <p className="text-2xl font-bold text-white">{totalLikes.toLocaleString('de-DE')}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/50">Daily Active Users</p>
                <p className="text-2xl font-bold text-white">{dailyActiveUsers.toLocaleString('de-DE')}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/50">Total Users</p>
                <p className="text-2xl font-bold text-white">{profiles.length.toLocaleString('de-DE')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
            {isFullAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'users'
                      ? 'bg-indigo-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Nutzer
                </button>
                <button
                  onClick={() => setActiveTab('songs')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'songs'
                      ? 'bg-indigo-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Music className="w-4 h-4" />
                  Songs
                </button>
                <button
                  onClick={() => setActiveTab('approvals')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'approvals'
                      ? 'bg-indigo-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Freigaben
                  {pendingSongs.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{pendingSongs.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('ads')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'ads'
                      ? 'bg-indigo-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  Werbung
                </button>
                <button
                  onClick={() => setActiveTab('bot')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'bot'
                      ? 'bg-indigo-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  Bot Control
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('moderation')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'moderation'
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Moderation
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-white text-red-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {reports.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
          {activeTab === 'users' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white/70">
                <thead className="text-xs uppercase bg-black/40 text-white/50">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Nutzername</th>
                    <th className="px-6 py-4 font-semibold">E-Mail</th>
                    <th className="px-6 py-4 font-semibold">Tarif (Plan)</th>
                    <th className="px-6 py-4 font-semibold">Land</th>
                    <th className="px-6 py-4 font-semibold">Zuletzt aktiv</th>
                    <th className="px-6 py-4 font-semibold">Beigetreten am</th>
                    <th className="px-6 py-4 font-semibold text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProfiles.length > 0 ? filteredProfiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                        {profile.avatar_url ? (
                          <Image src={profile.avatar_url} alt={profile.username} width={32} height={32} className="rounded-full object-cover shadow-md" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                            {profile.username?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="flex items-center gap-2">
                          {profile.username || 'Unbekannt'}
                          {profile.role === 'admin' && <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase">Admin</span>}
                          {profile.role === 'mod' && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold uppercase">Mod</span>}
                          {profile.role === 'creator' && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">Creator</span>}
                          {profile.is_banned && <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full font-bold uppercase">Gesperrt</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">{profile.email || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider ${
                          profile.subscription_tier === 'pro' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                          profile.subscription_tier === 'premium' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          'bg-white/10 text-white/60'
                        }`}>
                          {(profile.subscription_tier || 'Free').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">{profile.country || '-'}</td>
                      <td className="px-6 py-4">{profile.last_active_at ? new Date(profile.last_active_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                      <td className="px-6 py-4">{new Date(profile.created_at).toLocaleDateString('de-DE')}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <select
                          className="bg-white/5 border border-white/10 rounded-md text-xs px-2 py-1.5 text-white/80 focus:outline-none focus:border-indigo-500"
                          value={profile.role || 'user'}
                          onChange={(e) => handleRoleChange(profile.id, e.target.value, profile.username)}
                        >
                          <option value="user">User</option>
                          <option value="creator">Creator</option>
                          <option value="mod">MOD</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => handleToggleBan(profile.id, !!profile.is_banned, profile.username)}
                          className={`text-xs px-3 py-1.5 rounded-md font-bold transition-colors ${
                            profile.is_banned
                              ? 'bg-white/10 hover:bg-white/20 text-white'
                              : 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
                          }`}
                        >
                          {profile.is_banned ? 'Entsperren' : 'Sperren'}
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-white/40">Keine Nutzer gefunden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'songs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white/70">
                <thead className="text-xs uppercase bg-black/40 text-white/50">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Song Titel</th>
                    <th className="px-6 py-4 font-semibold">Künstler</th>
                    <th className="px-6 py-4 font-semibold">Plays</th>
                    <th className="px-6 py-4 font-semibold">AI Tool</th>
                    <th className="px-6 py-4 font-semibold text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSongs.length > 0 ? filteredSongs.map((song) => (
                    <tr key={song.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 font-medium text-white max-w-[200px] truncate" title={song.title}>
                        <Link href={`/song/${song.id}`} className="hover:text-indigo-400 hover:underline">
                          {song.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 max-w-[150px] truncate" title={song.artist_name}>{song.artist_name || 'Unbekannt'}</td>
                      <td className="px-6 py-4 font-mono">{song.plays?.toLocaleString() || 0}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-white/5 rounded text-xs border border-white/10">
                          {song.ai_tool || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <label
                          className="p-2 cursor-pointer text-white/40 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Audiodatei austauschen"
                        >
                          {isReplacingAudio === song.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileAudio className="w-4 h-4" />
                          )}
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => handleReplaceAudio(e, song.id, song.title)}
                            disabled={isReplacingAudio === song.id}
                          />
                        </label>
                        <button
                          onClick={() => handleSetSpotlightSong(song.id, song.title)}
                          className={`p-2 rounded-lg transition-all ${
                            song.is_spotlight
                              ? 'text-fuchsia-300 bg-fuchsia-400/15'
                              : 'text-white/40 hover:text-fuchsia-300 hover:bg-fuchsia-400/10 opacity-0 group-hover:opacity-100'
                          }`}
                          title={song.is_spotlight ? 'Aktuelles Home-Spotlight' : 'Als Home-Spotlight setzen'}
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                        {song.is_spotlight ? (
                          <button
                            onClick={() => handleEditSpotlightCopy(song.id, song.title, song.spotlight_copy ?? null)}
                            className="p-2 text-fuchsia-300/80 hover:text-fuchsia-200 hover:bg-fuchsia-400/10 rounded-lg transition-all"
                            title={song.spotlight_copy ? 'Spotlight-Text bearbeiten' : 'Spotlight-Text setzen'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => handleEditSongTitle(song.id, song.title)}
                          className="p-2 text-white/40 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Song umbenennen"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSong(song.id, song.title)}
                          className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Song endgültig löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-white/40">Keine Songs gefunden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'approvals' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white/70">
                <thead className="text-xs uppercase bg-black/40 text-white/50">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Titel</th>
                    <th className="px-6 py-4 font-semibold">Künstler</th>
                    <th className="px-6 py-4 font-semibold">Datum</th>
                    <th className="px-6 py-4 font-semibold text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pendingSongs.length > 0 ? pendingSongs.map((song) => (
                    <tr key={song.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white max-w-[200px] truncate" title={song.title}>
                        {song.title}
                      </td>
                      <td className="px-6 py-4 max-w-[150px] truncate" title={song.artist_name}>{song.artist_name || 'Unbekannt'}</td>
                      <td className="px-6 py-4">{new Date(song.created_at).toLocaleDateString('de-DE')}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        {song.audio_url && (
                          <button
                            onClick={() => openTrustedExternalUrl(song.audio_url)}
                            className="p-2 text-blue-400 hover:text-white hover:bg-blue-500 rounded-lg transition-all"
                            title="Song anhören"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleApproveSong(song.id, song.title)}
                          className="px-3 py-1.5 text-xs font-bold text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-md transition-all"
                        >
                          Freigeben
                        </button>
                        <button
                          onClick={() => handleRejectSong(song.id, song.title)}
                          className="px-3 py-1.5 text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-all"
                        >
                          Ablehnen
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-white/40">Keine ausstehenden Freigaben.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'moderation' && (
            <div className="overflow-x-auto">
              {reports.length === 0 ? (
                <div className="p-12 text-center text-white/50 flex flex-col items-center">
                  <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
                  <p>Keine Meldungen vorhanden. Alles sieht gut aus!</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-white/70">
                  <thead className="text-xs uppercase bg-black/40 text-white/50">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Typ</th>
                      <th className="px-6 py-4 font-semibold">Grund</th>
                      <th className="px-6 py-4 font-semibold">Datum</th>
                      <th className="px-6 py-4 font-semibold text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          {report.status === 'pending' ? (
                            <span className="text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md text-xs font-bold border border-amber-400/20">Ausstehend</span>
                          ) : (
                            <span className="text-green-400 bg-green-400/10 px-2 py-1 rounded-md text-xs font-bold border border-green-400/20">Erledigt</span>
                          )}
                        </td>
                        <td className="px-6 py-4 capitalize text-white font-medium">
                          {report.entity_type}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {report.reason}
                        </td>
                        <td className="px-6 py-4 text-white/40">
                          {new Date(report.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={async () => {
                              await supabase.from('reports').update({ status: 'resolved' }).eq('id', report.id);
                              setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'resolved' } : r));
                            }}
                            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            title="Als erledigt markieren"
                            disabled={report.status === 'resolved'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <Link
                            href={report.entity_type === 'playlist' ? `/playlist/${report.entity_id}` : `/artist/${report.entity_id}`}
                            target="_blank"
                            className="px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors"
                          >
                            Prüfen
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'ads' && isFullAdmin && (
            <div className="p-8">
              <div className="max-w-2xl mx-auto text-center">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Radio className="w-8 h-8 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Eigenwerbung Verwalten</h2>
                <p className="text-white/60 mb-8">
                  Lade hier eine neue Audiodatei hoch (.mp3, .m4a), die den Free-Nutzern nach jedem 3. Song abgespielt wird.
                  Die neue Datei überschreibt automatisch die alte Werbung und ist sofort live.
                </p>

                <div className="bg-black/40 border border-white/10 rounded-2xl p-8 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAdUpload}
                    disabled={isUploadingAd}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                    title="Klicke hier, um eine Audiodatei auszuwählen"
                  />
                  <div className="flex flex-col items-center justify-center gap-4">
                    {isUploadingAd ? (
                      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                    ) : (
                      <UploadCloud className="w-10 h-10 text-white/50 group-hover:text-indigo-400 transition-colors" />
                    )}
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {isUploadingAd ? 'Audiodatei wird hochgeladen...' : 'Klicke hier, um eine Audiodatei auszuwählen'}
                      </p>
                      <p className="text-sm text-white/40 mt-2">Maximal 10 MB (MP3, WAV, M4A)</p>
                    </div>
                  </div>
                </div>

                {uploadAdStatus && (
                  <div className={`mt-6 p-4 rounded-xl text-sm font-medium border ${
                    uploadAdStatus.includes('Erfolgreich')
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : uploadAdStatus.includes('Fehler')
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  }`}>
                    {uploadAdStatus}
                  </div>
                )}

                {/* Ad Frequency Setting */}
                <div className="mt-12 text-left bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-white mb-2">Werbe-Intervall</h3>
                  <p className="text-white/60 mb-6 text-sm">
                    Stelle hier ein, nach wie vielen Songs die Basic-Nutzer eine Werbung hören sollen.
                    (Bisher war dieser Wert fest auf 3 eingestellt).
                  </p>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-white font-medium">Werbung abspielen nach jedem:</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setAdFrequency(Math.max(1, adFrequency - 1))}
                          className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                        >-</button>
                        <span className="text-xl font-bold text-white w-8 text-center">{adFrequency}</span>
                        <button
                          onClick={() => setAdFrequency(adFrequency + 1)}
                          className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                        >+</button>
                        <span className="text-white/60 font-medium ml-2">. Song</span>
                      </div>
                    </div>
                    <button
                      onClick={handleSaveAdFrequency}
                      disabled={isSavingAdFreq}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isSavingAdFreq ? 'Speichert...' : 'Speichern'}
                    </button>
                  </div>
                </div>

                {/* List of active ads */}
                <div className="mt-12 text-left">
                  <h3 className="text-xl font-bold text-white mb-4">Aktive Werbungen ({adFiles.length})</h3>
                  {adFiles.length === 0 ? (
                    <div className="p-8 text-center bg-white/5 border border-white/10 rounded-2xl">
                      <p className="text-white/50">Keine Werbung hochgeladen. Nutze den Uploader oben!</p>
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                      <ul className="divide-y divide-white/5">
                        {adFiles.map((file) => (
                          <li key={file.id || file.name} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-4 truncate mr-4">
                              <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <Radio className="w-5 h-5 text-indigo-400" />
                              </div>
                              <div className="truncate">
                                <p className="text-sm font-medium text-white truncate">{file.name}</p>
                                <p className="text-xs text-white/50">
                                  {file.created_at ? new Date(file.created_at).toLocaleDateString('de-DE') : 'Unbekannt'} • {(((file.metadata?.size as number) || 0) / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAdDelete(file.name)}
                              className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all flex-shrink-0"
                              title="Werbung löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bot' && (
            <div className="p-8">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">OpenClaw Bot Control</h2>
                    <p className="text-white/60 text-sm">
                      Überwache hier in Echtzeit, welche Aktionen dein Telegram-Bot (MCP) ausführt.
                    </p>
                  </div>
                  <div className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    MCP Server Aktiv
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/10 bg-black/20 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-white/40" />
                    <span className="text-sm font-semibold text-white/70">Aktivitäts-Protokoll</span>
                  </div>
                  {mcpLogs.length === 0 ? (
                    <div className="p-8 text-center text-white/40 text-sm">
                      Noch keine Aktivitäten aufgezeichnet.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                      {mcpLogs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                              {log.tool_name}
                            </span>
                            <span className="text-xs text-white/40">
                              {new Date(log.created_at).toLocaleString('de-DE')}
                            </span>
                          </div>
                          {log.arguments && Object.keys(log.arguments).length > 0 && (
                            <div className="text-xs font-mono text-white/60 mb-2 bg-black/40 p-2 rounded border border-white/5">
                              {JSON.stringify(log.arguments)}
                            </div>
                          )}
                          {log.response_summary && (
                            <div className="text-sm text-white/80">
                              {log.response_summary}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
