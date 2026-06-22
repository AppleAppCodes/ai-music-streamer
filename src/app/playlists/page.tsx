'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, Heart, Library, Music, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';

interface Playlist {
  id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
}

interface SavedPlaylist {
  id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
  user_id: string | null;
  is_official: boolean;
  profiles: {
    username: string;
  } | {
    username: string;
  }[] | null;
}

export default function PlaylistsPage() {
  const { t } = useTranslation();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadPlaylists() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const [playlistsRes, savedRes, likedRes] = await Promise.all([
        supabase
          .from('playlists')
          .select('id, title, cover_url, created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('playlist_saves')
          .select('playlist:playlists(id, title, cover_url, created_at, user_id, is_official, profiles(username))')
          .eq('user_id', session.user.id),
        supabase
          .from('liked_songs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id),
      ]);

      if (playlistsRes.error) console.error('Error loading playlists:', playlistsRes.error);
      if (savedRes.error) console.error('Error loading saved playlists:', savedRes.error);
      if (likedRes.error) console.error('Error loading liked songs count:', likedRes.error);

      if (playlistsRes.data) setPlaylists(playlistsRes.data);
      if (savedRes.data) {
        const mapped = savedRes.data
          .map((item: Record<string, unknown>) => item.playlist)
          .filter(Boolean) as SavedPlaylist[];
        setSavedPlaylists(mapped);
      }
      setLikedSongsCount(likedRes.count || 0);
      setLoading(false);
    }
    loadPlaylists();
  }, [supabase, router]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const newTitle = `${t('nav.myPlaylists')} #${playlists.length + 1}`;
      const { data: newPlaylist, error } = await supabase
        .from('playlists')
        .insert({
          user_id: session.user.id,
          title: newTitle,
          is_public: false
        })
        .select()
        .single();

      if (error) throw error;
      if (newPlaylist) router.push(`/playlist/${newPlaylist.id}`);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Erstellen der Playlist.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="yoriax-page flex min-h-screen flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="yoriax-page flex-1 overflow-y-auto pb-32">
      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white md:left-8 md:top-8"
        aria-label={t('charts.back')}
      >
        <ArrowLeft className="h-6 w-6" />
      </button>

      <div className="relative z-10 px-4 pb-6 pt-16 sm:px-6 md:px-10 md:pt-16">
        <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
          <div>
            <p className="text-sm text-white/50 uppercase tracking-wider font-semibold mb-1">{t('library.eyebrow')}</p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{t('library.title')}</h1>
          </div>
          <button 
            onClick={handleCreate}
            disabled={creating}
            className="flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-black shadow-xl transition-transform hover:scale-105 hover:bg-gray-200 disabled:opacity-50 sm:px-6"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">{t('library.create')}</span>
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <Link
              href="/collection/tracks"
              className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.055] p-3.5 shadow-xl shadow-black/20 transition-all hover:border-white/20 hover:bg-white/[0.09] md:max-w-xl"
            >
              <div className="bg-gradient-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-xl shadow-[0_0_22px_rgba(168,85,247,0.35)]">
                <Heart className="h-8 w-8 fill-white text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-black text-white">{t('library.favorites')}</h2>
                <p className="mt-0.5 text-sm font-medium text-white/45">
                  {likedSongsCount} {likedSongsCount === 1 ? t('song.song') : t('charts.artist.songs')}
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white/55 transition-colors group-hover:text-white">
                {t('library.open')}
              </span>
            </Link>
          </section>

          {/* Saved Playlists Section */}
          {savedPlaylists.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight text-white">{t('playlists.savedTitle')}</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {savedPlaylists.map((playlist, index) => {
                  const rawProfiles = playlist.profiles;
                  const profileObj = Array.isArray(rawProfiles) ? rawProfiles[0] : rawProfiles;
                  const rawCreator = profileObj?.username;
                  const creatorName =
                    playlist.id === 'da114eeb-ecea-5e55-9ee1-ea5e5da11111'
                      ? 'YORIAX Team'
                      : rawCreator === 'Unbekannt' || !rawCreator
                      ? t('guestHome.unknownArtist')
                      : rawCreator;

                  const playlistRoute =
                    playlist.id === 'da114eeb-ecea-5e55-9ee1-ea5e5da11111'
                      ? '/playlist/daily-new-releases'
                      : `/playlist/${playlist.id}`;

                  return (
                    <Link
                      key={playlist.id}
                      href={playlistRoute}
                      className="yoriax-card-interactive group relative flex items-center gap-3 rounded-2xl p-3 sm:flex-col sm:items-stretch sm:gap-3 sm:p-3.5"
                    >
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-hover shadow-lg sm:aspect-square sm:h-auto sm:w-full">
                        {playlist.id === 'da114eeb-ecea-5e55-9ee1-ea5e5da11111' ? (
                          <div className="bg-gradient-primary flex h-full w-full items-center justify-center">
                            <Sparkles className="h-8 w-8 text-white sm:h-16 sm:w-16" />
                          </div>
                        ) : playlist.cover_url ? (
                          <Image
                            src={playlist.cover_url}
                            alt={playlist.title}
                            fill
                            sizes="(max-width: 640px) 64px, 200px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            priority={index < 6}
                          />
                        ) : (
                          <Music className="h-8 w-8 text-white/20 sm:h-16 sm:w-16" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-white">
                          {playlist.id === 'da114eeb-ecea-5e55-9ee1-ea5e5da11111'
                            ? t('playlists.dailyNewReleases.title')
                            : playlist.title}
                        </span>
                        <span className="mt-0.5 truncate text-xs text-white/40">
                          {playlist.id === 'da114eeb-ecea-5e55-9ee1-ea5e5da11111'
                            ? t('library.byYoriax')
                            : t('playlists.byCreator', { creator: creatorName })}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight text-white">{t('library.ownPlaylists')}</h2>
            </div>

            {playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.035] px-5 py-16 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <Library className="w-10 h-10 text-white/20" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{t('library.noPlaylists')}</h3>
                <p className="text-white/50 max-w-md mb-8">
                  {t('library.noPlaylistsDesc')}
                </p>
                <button 
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-full font-bold transition-colors"
                >
                  {t('library.createBtn')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {playlists.map((playlist, index) => (
                  <Link
                    key={playlist.id}
                    href={`/playlist/${playlist.id}`}
                    className="yoriax-card-interactive group relative flex items-center gap-3 rounded-2xl p-3 sm:flex-col sm:items-stretch sm:gap-3 sm:p-3.5"
                  >
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-hover shadow-lg sm:aspect-square sm:h-auto sm:w-full">
                      {playlist.cover_url ? (
                        <Image
                          src={playlist.cover_url}
                          alt={playlist.title}
                          fill
                          sizes="(max-width: 640px) 64px, 200px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          priority={index < 6}
                        />
                      ) : (
                        <Music className="h-8 w-8 text-white/20 sm:h-16 sm:w-16" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-white">{playlist.title}</span>
                      <span className="mt-0.5 truncate text-xs text-white/40">
                        {t('library.byYou')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
