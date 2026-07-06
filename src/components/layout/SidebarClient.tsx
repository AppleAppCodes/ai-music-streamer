'use client';

import Link from 'next/link';
import { Home, Library, PlusCircle, Heart, Mic2, ListMusic, UserCheck, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import CreatePlaylistButton from '@/components/ui/CreatePlaylistButton';
import BrandLogo from '@/components/BrandLogo';
import { isAdminUser, isCreatorUser } from '@/lib/admin';
import CookieSettingsButton from '@/components/ui/CookieSettingsButton';

import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function SidebarClient({
  user,
  appVersionLabel,
}: {
  user: SupabaseUser | null;
  appVersionLabel?: string;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  
  const isCreator = isCreatorUser(user);
  const isAdmin = isAdminUser(user);

  if (!user) return null;

  const navLinkClass = (href: string) => {
    const active = href === '/' ? pathname === href : pathname?.startsWith(href);
    return `group relative flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-bold transition-all ${
      active
        ? 'border-violet-400/30 bg-gradient-to-r from-violet-500/20 via-violet-500/10 to-transparent text-white shadow-[0_12px_34px_rgba(76,29,149,0.18)]'
        : 'border-transparent text-white/58 hover:border-white/8 hover:bg-white/[0.055] hover:text-white'
    }`;
  };

  const iconClass = (href: string) => {
    const active = href === '/' ? pathname === href : pathname?.startsWith(href);
    return `h-5 w-5 transition-colors ${active ? 'text-violet-300' : 'text-white/42 group-hover:text-violet-300'}`;
  };

  return (
    <aside className="relative hidden h-full w-60 shrink-0 flex-col overflow-hidden border-r border-white/8 bg-[linear-gradient(180deg,rgba(23,17,31,0.96),rgba(5,5,5,0.98))] pb-24 pt-5 md:flex">
      <div className="pointer-events-none absolute -left-24 top-24 h-56 w-56 rounded-full bg-violet-600/12 blur-[80px]" />
      <div className="pointer-events-none absolute -right-28 bottom-20 h-52 w-52 rounded-full bg-teal-400/8 blur-[80px]" />

      <div className="relative mb-8 px-6">
        {isAdmin ? (
          <div className="flex items-center gap-3">
            <BrandLogo
              user={user}
              width={36}
              height={36}
              priority
              className="h-9 w-9"
              imageClassName="h-full w-full rounded-xl object-cover transition-transform duration-300"
            />
            <Link
              href="/"
              className="text-[15px] font-bold tracking-[0.24em] text-white transition-opacity hover:opacity-80"
              style={{ fontFamily: 'var(--font-syncopate)' }}
              aria-label="YORIAX Home"
            >
              YORIAX
            </Link>
          </div>
        ) : (
          <Link href="/" className="group flex items-center gap-3" aria-label="YORIAX Home">
            <BrandLogo
              user={user}
              width={36}
              height={36}
              priority
              className="h-9 w-9"
              imageClassName="h-full w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span
              className="text-[15px] font-bold tracking-[0.24em] text-white"
              style={{ fontFamily: 'var(--font-syncopate)' }}
            >
              YORIAX
            </span>
          </Link>
        )}
      </div>

      <div className="relative mb-6 px-3">
        <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/30">{t('nav.discover')}</p>
        <nav className="space-y-1.5">
          <Link href="/" className={navLinkClass('/')}>
            <Home className={iconClass('/')} />
            {t('nav.home')}
          </Link>
          <Link href="/feed" className={navLinkClass('/feed')}>
            <Sparkles className={iconClass('/feed')} />
            {t('nav.feed')}
          </Link>
          <Link href="/artists" className={navLinkClass('/artists')}>
            <Mic2 className={iconClass('/artists')} />
            {t('home.quickAccess.artists')}
          </Link>
          <Link href="/discover/playlists" className={navLinkClass('/discover/playlists')}>
            <ListMusic className={iconClass('/discover/playlists')} />
            {t('nav.discoverPlaylists')}
          </Link>
          <Link href="/genres" className={navLinkClass('/genres')}>
            <Sparkles className={iconClass('/genres')} />
            {t('nav.genres')}
          </Link>
        </nav>
      </div>

      <div className="relative mb-6 px-3">
        <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/30">{t('nav.library')}</p>
        <nav className="space-y-1.5">
          <Link href="/playlists" className={navLinkClass('/playlists')}>
            <Library className={iconClass('/playlists')} />
            {t('nav.myPlaylists')}
          </Link>
          <Link href="/collection/tracks" className={navLinkClass('/collection/tracks')}>
            <Heart className={iconClass('/collection/tracks')} />
            {t('nav.likedSongs')}
          </Link>
          <Link href="/following" className={navLinkClass('/following')}>
            <UserCheck className={iconClass('/following')} />
            {t('nav.following')}
          </Link>
        </nav>
      </div>

      <div className="relative mt-auto px-3">
        {isCreator && (
          <>
            <Link href="/upload" className="mb-2 flex items-center gap-3 rounded-2xl border border-violet-300/20 bg-violet-500/14 px-3 py-3 text-sm font-black text-white transition-colors hover:bg-violet-500/22">
              <PlusCircle className="w-5 h-5" />
              {t('nav.upload')}
            </Link>
            <Link href="/artists/mine" className={navLinkClass('/artists/mine') + ' mb-2'}>
              <Mic2 className={iconClass('/artists/mine')} />
              {t('nav.myArtists')}
            </Link>
          </>
        )}
        <CreatePlaylistButton />
        <CookieSettingsButton className="mt-4 px-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white/30 transition-colors hover:text-white/60">
          Cookies
        </CookieSettingsButton>
        <div className="mt-3 flex flex-col gap-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/25">
          <Link href="/impressum" className="transition-colors hover:text-white/60">
            {t('nav.impressum')}
          </Link>
          <Link href="/datenschutz" className="transition-colors hover:text-white/60">
            {t('nav.datenschutz')}
          </Link>
          <Link href="/agb" className="transition-colors hover:text-white/60">
            {t('nav.agb')}
          </Link>
          <Link href="/widerruf" className="transition-colors hover:text-white/60">
            {t('nav.widerruf')}
          </Link>
        </div>
        {isAdmin && appVersionLabel ? (
          <div className="mt-4 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/22">
            Version {appVersionLabel}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
