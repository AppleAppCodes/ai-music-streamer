'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clapperboard, Home, Library, Search, Upload } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/admin';

const BASE_NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Suche', icon: Search },
  { href: '/feed', label: 'Feed', icon: Clapperboard },
  { href: '/playlists', label: 'Bibliothek', icon: Library },
] as const;

export default function MobileNavigationClient({ user }: { user: SupabaseUser | null }) {
  const pathname = usePathname();
  
  const isAdmin = isAdminUser(user);

  if (!user) return null;
  
  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(isAdmin ? [{ href: '/upload', label: 'Upload', icon: Upload }] : [])
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[60] flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center justify-around border-t border-white/10 bg-black/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Mobile Navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-white' : 'text-white/45 hover:text-white/80'
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? 'text-violet-400' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
