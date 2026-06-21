'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Library, Search, Sparkles, Upload } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isCreatorUser } from '@/lib/admin';
import { useState } from 'react';

const BASE_NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Suche', icon: Search },
  { href: '/feed', label: 'Für dich', icon: Sparkles },
  { href: '/playlists', label: 'Bibliothek', icon: Library },
] as const;

export default function MobileNavigationClient({ user }: { user: SupabaseUser | null }) {
  const pathname = usePathname();
  const [pendingNav, setPendingNav] = useState<{ href: string; from: string } | null>(null);
  
  const isCreator = isCreatorUser(user);
  
  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(isCreator ? [{ href: '/upload', label: 'Upload', icon: Upload }] : [])
  ];

  if (!user) return null;

  return (
    <nav
      className="fixed bottom-[max(0.7rem,env(safe-area-inset-bottom))] left-3 right-3 z-[60] flex h-16 items-center justify-around rounded-[1.45rem] border border-white/12 bg-[#0c0912]/92 px-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.58)] backdrop-blur-2xl md:hidden"
      aria-label="Mobile Navigation"
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActivePath = href === '/' ? pathname === href : pathname?.startsWith(href);
        const isPending = pendingNav?.href === href && pendingNav.from === pathname;
        const isActive = isPending || isActivePath;

        return (
          <Link
            key={href}
            href={href}
            prefetch
            onClick={() => setPendingNav({ href, from: pathname || '' })}
            className={`relative flex h-[calc(100%-0.65rem)] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[1.1rem] px-1 text-[10px] font-bold transition-all ${
              isActive
                ? 'bg-violet-500/16 text-white shadow-[inset_0_0_0_1px_rgba(168,85,247,0.16)]'
                : 'text-white/42 hover:bg-white/[0.055] hover:text-white/80'
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? 'text-violet-300' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
            <span className="truncate">{label}</span>
            {isActive ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.95)]" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
