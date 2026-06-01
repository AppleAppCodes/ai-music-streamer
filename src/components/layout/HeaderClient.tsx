'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AudioWaveform, Bell, LogIn, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProfileDropdown from '@/components/ui/ProfileDropdown';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { useEffect, useRef } from 'react';

interface HeaderClientProps {
  user: SupabaseUser | null;
  signOutAction: () => Promise<void>;
}

export default function HeaderClient({ user, signOutAction }: HeaderClientProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchAutoNav = useRef(false);

  useEffect(() => {
    if (user) {
      // Background call to track activity and country
      fetch('/api/user/track', { method: 'POST' }).catch(() => {});
    }
  }, [user]);

  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between gap-2 border-b border-white/5 px-3 glass-panel sm:gap-3 md:h-16 md:px-6">
      {/* Left side spacer for balance */}
      <div className="hidden w-1/3 items-center md:flex"></div>
      <Link href="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 shadow-lg shadow-purple-500/20 md:hidden" aria-label="AI Stream Home">
        <AudioWaveform className="h-5 w-5 text-white" strokeWidth={2.5} />
      </Link>

      {/* Center - Search Bar */}
      <div className="relative flex min-w-0 flex-1 items-center justify-center">
        <div className="relative w-full max-w-lg group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
          </div>
          <input
            type="text"
            defaultValue={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') || '' : ''}
            onChange={(e) => {
              const query = e.target.value;
              if (query.trim()) {
                router.replace(`/search?q=${encodeURIComponent(query.trim())}`);
              } else if (window.location.pathname.includes('/search')) {
                router.replace(`/search`);
              }
            }}
            onFocus={() => {
              if (!window.location.pathname.includes('/search')) {
                searchAutoNav.current = true;
                router.push('/search');
              }
            }}
            onBlur={(e) => {
              if (!e.target.value.trim() && searchAutoNav.current) {
                searchAutoNav.current = false;
                router.back();
              }
            }}
            className="block w-full rounded-full border border-white/20 bg-white/10 py-2 pl-10 pr-3 text-sm leading-5 text-white shadow-lg backdrop-blur-md transition-all placeholder-white/60 hover:border-purple-500/40 hover:bg-white/15 hover:shadow-[0_0_15px_rgba(168,85,247,0.15)] focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:shadow-[0_0_20px_rgba(168,85,247,0.3)] sm:py-2.5 sm:pl-11 sm:pr-4"
            placeholder={t('nav.search') + "..."}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 md:w-1/3 md:gap-4">
        <button className="hidden rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white sm:block" aria-label="Benachrichtigungen">
          <Bell className="w-5 h-5" />
        </button>

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
