'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, LogIn, Search, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProfileDropdown from '@/components/ui/ProfileDropdown';
import NotificationsDropdown from '@/components/ui/NotificationsDropdown';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { notifyPlayerForceSignOut } from '@/lib/player-events';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { usePlayer } from '@/lib/player-context';
import { Song } from '@/lib/types';
import { Loader2, Play, Mic2, Music } from 'lucide-react';

interface HeaderClientProps {
  user: SupabaseUser | null;
  signOutAction: () => Promise<void>;
}

export default function HeaderClient({ user, signOutAction }: HeaderClientProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchReturnPath = useRef<string | null>(null);
  const hideMobileSearch = pathname?.startsWith('/search');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchSongsResult, setSearchSongsResult] = useState<Song[]>([]);
  const [searchArtistsResult, setSearchArtistsResult] = useState<{artist_name: string}[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { playSong, setQueue } = usePlayer();

  useEffect(() => {
    if (user) {
      // Background call to track activity and country
      fetch('/api/user/track', { method: 'POST' }).catch(() => {});
    } else {
      notifyPlayerForceSignOut();
    }
    
    if (typeof navigator !== 'undefined') {
      setIsElectron(navigator.userAgent.toLowerCase().includes(' electron/'));
    }
  }, [user]);

  // Debounced search
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) {
      setSearchSongsResult([]);
      setSearchArtistsResult([]);
      return;
    }

    let isActive = true;
    async function searchSongs() {
      setSearchLoading(true);
      const searchPattern = `%${trimmedQuery}%`;
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .or(`title.ilike.${searchPattern},artist_name.ilike.${searchPattern},genre.ilike.${searchPattern}`)
        .order('plays', { ascending: false })
        .limit(10);

      if (!isActive) return;
      if (!error && data) {
        // Extract unique artists matching the query
        const uniqueArtists = Array.from(new Set(
          (data || [])
            .filter(s => s.artist_name && s.artist_name.toLowerCase().includes(trimmedQuery.toLowerCase()))
            .map(s => s.artist_name)
        )).map(name => ({ artist_name: name })).slice(0, 2); // Show top 2 artists
        
        setSearchArtistsResult(uniqueArtists);
        setSearchSongsResult((data as Song[]).slice(0, 5)); // Show top 5 songs
      }
      setSearchLoading(false);
    }

    const timer = window.setTimeout(searchSongs, 250);
    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, supabase]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between gap-2 border-b border-white/5 px-3 glass-panel sm:gap-3 md:h-16 md:px-6">
      <div className="hidden w-1/3 items-center md:flex">
        {!user ? (
          <Link href="/" className="group flex items-center gap-3" aria-label="Yoriax Home">
            <Image
              src="/brand/yoriax-logo.png"
              alt="YORIAX"
              width={170}
              height={39}
              priority
              className="h-8 w-auto transition-opacity duration-300 group-hover:opacity-85"
            />
          </Link>
        ) : null}
      </div>
      <Link href="/" className="group flex h-9 w-9 shrink-0 items-center justify-center md:hidden" aria-label="Yoriax Home">
        <Image
          src="/brand/yoriax-symbol.png"
          alt="YORIAX"
          width={36}
          height={36}
          priority
          className="h-8 w-8 object-contain transition-opacity duration-300 group-hover:opacity-85"
        />
      </Link>

      {/* Center - Search Bar */}
      <div className={`relative min-w-0 flex-1 items-center justify-center ${hideMobileSearch ? 'hidden md:flex' : 'flex'}`}>
        <div className="relative w-full max-w-lg" ref={searchContainerRef}>
          <label className="relative block w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
            <input
              type="search"
              defaultValue={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') || '' : ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const query = e.currentTarget.value;
                  setIsSearchFocused(false);
                  if (query.trim()) {
                    if (!window.location.pathname.includes('/search')) {
                      searchReturnPath.current = `${window.location.pathname}${window.location.search}`;
                    }
                    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                  } else if (window.location.pathname.includes('/search')) {
                    const returnPath = searchReturnPath.current;
                    searchReturnPath.current = null;
                    router.push(returnPath || `/search`);
                  }
                }
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/35 py-2.5 pl-12 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-primary/60 focus:bg-black/50 transition-colors"
              placeholder={t('nav.search') + "..."}
              aria-label={t('nav.search')}
            />
          </label>

          {/* Quick Search Dropdown */}
          {isSearchFocused && searchQuery.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A1A] shadow-2xl backdrop-blur-xl">
              <div className="p-2">
                {searchLoading ? (
                  <div className="flex items-center gap-3 p-4 text-sm font-semibold text-white/55">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Suche läuft...
                  </div>
                ) : searchSongsResult.length > 0 || searchArtistsResult.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {searchArtistsResult.length > 0 && (
                      <div className="mb-1">
                        <div className="px-2 py-1 text-xs font-bold text-white/40 uppercase tracking-wider">Künstler</div>
                        {searchArtistsResult.map((artist, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setIsSearchFocused(false);
                              router.push(`/artist/${encodeURIComponent(artist.artist_name)}`);
                            }}
                            className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.07]"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 group-hover:bg-primary/20">
                              <Mic2 className="h-5 w-5 text-white/50 group-hover:text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold text-white group-hover:text-primary">{artist.artist_name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {searchSongsResult.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs font-bold text-white/40 uppercase tracking-wider mt-1">Songs</div>
                        {searchSongsResult.map((song) => (
                          <button
                            key={song.id}
                            type="button"
                            onClick={() => {
                              const queueWithNames = searchSongsResult.map(s => ({ ...s, creatorName: s.artist_name || 'Creator' }));
                              setQueue(queueWithNames, 0);
                              playSong({ ...song, creatorName: song.artist_name || 'Creator' });
                              setIsSearchFocused(false);
                            }}
                            className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.07]"
                          >
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                              {song.cover_url ? (
                                <Image src={song.cover_url} alt={song.title} fill sizes="40px" className="object-cover" />
                              ) : (
                                <div className="w-full h-full bg-[#282828] flex items-center justify-center">
                                  <Music className="w-5 h-5 text-white/20" />
                                </div>
                              )}
                              <div className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
                                <Play className="h-4 w-4 fill-white text-white" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold text-white group-hover:text-primary">{song.title}</div>
                              <div className="truncate text-xs font-semibold text-white/45">{song.artist_name || 'Creator'}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <button 
                      onClick={() => {
                        setIsSearchFocused(false);
                        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      }}
                      className="mt-1 w-full rounded-xl bg-white/[0.03] p-3 text-center text-xs font-bold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      Alle Ergebnisse anzeigen
                    </button>
                  </div>
                ) : (
                  <div className="p-4 text-sm font-semibold text-white/45">
                    Keine Ergebnisse gefunden.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 md:w-1/3 md:gap-4">
        {!isElectron && (
          <Link 
            href="/download" 
            className="hidden lg:flex h-8 items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 text-xs font-bold text-white transition-colors hover:scale-105 hover:bg-white/10"
          >
            <Download className="w-3.5 h-3.5" />
            App installieren
          </Link>
        )}
        <div className="hidden lg:block h-6 w-px bg-white/20 mx-1"></div>
        {user ? (
          <div className="hidden sm:block">
            <NotificationsDropdown user={user} />
          </div>
        ) : null}

        {user ? (
          <div className="flex items-center gap-2 sm:border-l sm:border-white/10 sm:pl-3 md:gap-4 md:pl-4">
            <ProfileDropdown user={user} signOutAction={signOutAction} />
          </div>
        ) : (
          <Link 
            href="/login" 
            className="flex h-9 items-center gap-2 rounded-full bg-white px-3 text-sm font-bold text-black transition-transform hover:scale-105 sm:px-5"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">{t('nav.login')}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
