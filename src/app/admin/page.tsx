'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ShieldAlert, Users, Music, Trash2, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type AdminTab = 'users' | 'songs';

interface ProfileData {
  id: string;
  username: string;
  created_at: string;
  subscription_tier: string;
  followers_count: number;
}

interface SongData {
  id: string;
  title: string;
  artist_name: string;
  plays: number;
  ai_tool: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [songs, setSongs] = useState<SongData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const router = useRouter();
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

      // Very simple admin check: If email matches David's or has 'admin', or for now, we just let the logged in user see it so you can test it!
      // To tighten security later, uncomment the strict check below:
      const adminEmails = [process.env.NEXT_PUBLIC_ADMIN_EMAIL, 'heindavid91@gmail.com', 'admin@ai-music.com'];
      const isUserAdmin = adminEmails.includes(user.email) || user.email?.includes('admin') || true; // <-- Remove "|| true" to enforce strict security

      if (!isUserAdmin) {
        router.push('/');
        return;
      }

      setIsAuthorized(true);

      // Load Users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, created_at, subscription_tier, followers_count')
        .order('created_at', { ascending: false });
        
      if (profilesData) setProfiles(profilesData);

      // Load Songs
      const { data: songsData } = await supabase
        .from('songs')
        .select('id, title, artist_name, plays, ai_tool, created_at')
        .order('created_at', { ascending: false });

      if (songsData) setSongs(songsData);

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

  const filteredProfiles = profiles.filter(p => p.username?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSongs = songs.filter(s => 
    s.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.artist_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
              </div>
            </div>
            <div className="text-sm font-medium text-white/50">
              {profiles.length} Nutzer • {songs.length} Songs
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Tabs & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
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
          {activeTab === 'users' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white/70">
                <thead className="text-xs uppercase bg-black/40 text-white/50">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Nutzername</th>
                    <th className="px-6 py-4 font-semibold">Tarif (Plan)</th>
                    <th className="px-6 py-4 font-semibold">Followers</th>
                    <th className="px-6 py-4 font-semibold">Beigetreten am</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProfiles.length > 0 ? filteredProfiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                          {profile.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        {profile.username || 'Unbekannt'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider ${
                          profile.subscription_tier === 'pro' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 
                          profile.subscription_tier === 'premium' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 
                          'bg-white/10 text-white/60'
                        }`}>
                          {(profile.subscription_tier || 'Free').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono">{profile.followers_count || 0}</td>
                      <td className="px-6 py-4">{new Date(profile.created_at).toLocaleDateString('de-DE')}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-white/40">Keine Nutzer gefunden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
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
                      <td className="px-6 py-4 text-right">
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
        </div>

      </div>
    </div>
  );
}
