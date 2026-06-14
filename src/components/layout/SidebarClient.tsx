'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Home, Library, PlusCircle, Heart, TrendingUp, Mic2, ListMusic, UserCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CreatePlaylistButton from '@/components/ui/CreatePlaylistButton';
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
  
  const isCreator = isCreatorUser(user);
  const isAdmin = isAdminUser(user);

  if (!user) return null;

  return (
    <div className="hidden w-52 bg-black h-full md:flex flex-col pt-6 pb-24 border-r border-white/5">
      <div className="px-5 mb-8">
        <Link href="/" className="flex items-center gap-4 group">
          <Image
            src="/brand/yoriax-logo.png"
            alt="YORIAX"
            width={164}
            height={38}
            priority
            className="h-9 w-auto transition-opacity duration-300 group-hover:opacity-85"
          />
        </Link>
      </div>

      <div className="px-3 mb-6">
        <p className="px-3 text-xs font-semibold text-muted tracking-wider uppercase mb-3">{t('nav.discover')}</p>
        <nav className="space-y-1">
          <Link href="/" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Home className="w-5 h-5 group-hover:text-primary transition-colors" />
            {t('nav.home')}
          </Link>
          <Link href="/feed" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Sparkles className="w-5 h-5 group-hover:text-primary transition-colors" />
            {t('nav.feed')}
          </Link>
          <Link href="/charts/viral" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <TrendingUp className="w-5 h-5 group-hover:text-primary transition-colors" />
            {t('nav.viralCharts')}
          </Link>
          <Link href="/artists" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Mic2 className="w-5 h-5 group-hover:text-primary transition-colors" />
            {t('home.quickAccess.artists')}
          </Link>
          <Link href="/discover/playlists" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <ListMusic className="w-5 h-5 group-hover:text-primary transition-colors" />
            {t('nav.discoverPlaylists')}
          </Link>
        </nav>
      </div>

      <div className="px-3 mb-6">
        <p className="px-3 text-xs font-semibold text-muted tracking-wider uppercase mb-3">{t('nav.library')}</p>
        <nav className="space-y-1">
          <Link href="/playlists" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Library className="w-5 h-5 group-hover:text-primary transition-colors" />
            {t('nav.myPlaylists')}
          </Link>
          <Link href="/collection/tracks" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Heart className="w-5 h-5 group-hover:text-primary transition-colors" />
            {t('nav.likedSongs')}
          </Link>
          <Link href="/following" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <UserCheck className="w-5 h-5 group-hover:text-primary transition-colors" />
            {t('nav.following')}
          </Link>
        </nav>
      </div>

      <div className="px-3 mt-auto">
        {isCreator && (
          <Link href="/upload" className="flex items-center gap-4 px-3 py-2.5 mb-2 text-sm font-bold text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors border border-white/10">
            <PlusCircle className="w-5 h-5" />
            {t('nav.upload')}
          </Link>
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
        </div>
        {isAdmin && appVersionLabel ? (
          <div className="mt-4 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/22">
            Version {appVersionLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
