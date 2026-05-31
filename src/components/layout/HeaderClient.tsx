'use client';

import Link from 'next/link';
import { Search, Bell, LogIn, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HeaderClientProps {
  user: any;
  signOutAction: () => Promise<void>;
}

export default function HeaderClient({ user, signOutAction }: HeaderClientProps) {
  const { t } = useTranslation();

  return (
    <header className="h-16 w-full flex items-center justify-between px-6 sticky top-0 z-10 glass-panel border-b border-white/5">
      {/* Left side spacer for balance */}
      <div className="w-1/3 flex items-center"></div>

      {/* Center - Search Bar */}
      <div className="flex-1 flex justify-center items-center">
        <div className="relative w-full max-w-lg group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-white/40 group-hover:text-purple-400 transition-colors" />
          </div>
          <input
            type="text"
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
            <Link href="#" className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/30 hover:border-purple-500 transition-colors">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" alt="User Avatar" className="w-full h-full object-cover" />
            </Link>
            
            <form action={signOutAction}>
              <button type="submit" className="text-white/60 hover:text-white transition-colors" title={t('nav.logout')}>
                <LogOut className="w-4 h-4" />
              </button>
            </form>
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
