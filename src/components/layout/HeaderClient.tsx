'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProfileDropdown from '@/components/ui/ProfileDropdown';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { useEffect } from 'react';

interface HeaderClientProps {
  user: SupabaseUser | null;
  signOutAction: () => Promise<void>;
}

export default function HeaderClient({ user, signOutAction }: HeaderClientProps) {
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      // Background call to track activity and country
      fetch('/api/user/track', { method: 'POST' }).catch(() => {});
    }
  }, [user]);

  return (
    <header className="h-16 w-full flex items-center justify-between px-6 sticky top-0 z-50 glass-panel border-b border-white/5">
      {/* Left side spacer for balance */}
      <div className="w-1/3 flex items-center"></div>

      {/* Center - Search Bar */}
      <div className="flex-1 flex justify-center items-center relative">
        <div className="relative w-full max-w-lg group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-white/40 group-hover:text-purple-400 transition-colors" />
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
                router.push('/search');
              }
            }}
            className="block w-full pl-11 pr-4 py-2.5 border border-purple-500/20 rounded-full leading-5 bg-black/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 hover:bg-black/60 hover:border-purple-500/40 sm:text-sm transition-all shadow-[0_0_15px_rgba(168,85,247,0.05)] focus:shadow-[0_0_20px_rgba(168,85,247,0.2)] backdrop-blur-md"
            placeholder={t('nav.search') + "..."}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="w-1/3 flex items-center justify-end gap-4">
        <button className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        {user ? (
          <div className="flex items-center gap-4 border-l border-white/10 pl-4">
            <ProfileDropdown user={user} signOutAction={signOutAction} />
          </div>
        ) : (
          <Link 
            href="/login" 
            className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform"
          >
            <LogIn className="w-4 h-4" />
            {t('nav.login')}
          </Link>
        )}
      </div>
    </header>
  );
}
