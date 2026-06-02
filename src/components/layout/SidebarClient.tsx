'use client';

import Link from 'next/link';
import { Home, Library, PlusCircle, Heart, TrendingUp, Mic2, ListMusic, UserCheck, UsersRound, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CreatePlaylistButton from '@/components/ui/CreatePlaylistButton';
import { isAdminUser } from '@/lib/admin';

import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function SidebarClient({ user }: { user: SupabaseUser | null }) {
  const { t } = useTranslation();
  
  const isAdmin = isAdminUser(user);

  if (!user) return null;

  return (
    <div className="hidden w-52 bg-black h-full md:flex flex-col pt-6 pb-24 border-r border-white/5">
      <div className="px-5 mb-8">
        <Link href="/" className="flex items-center gap-4 group">
          <div className="flex items-end justify-center gap-[3px] w-8 h-8 pb-1">
            <div className="w-[5px] h-[14px] bg-white rounded-full group-hover:h-[24px] group-hover:bg-primary transition-all duration-300 ease-out" />
            <div className="w-[5px] h-[26px] bg-white rounded-full group-hover:h-[16px] group-hover:bg-[#a855f7] transition-all duration-300 ease-out" />
            <div className="w-[5px] h-[18px] bg-white rounded-full group-hover:h-[28px] group-hover:bg-primary transition-all duration-300 ease-out" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white uppercase group-hover:text-[#e9d5ff] transition-colors duration-300" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
            Yoriax
          </span>
        </Link>
      </div>

      <div className="px-3 mb-6">
        <p className="px-3 text-xs font-semibold text-muted tracking-wider uppercase mb-3">{t('nav.discover')}</p>
        <nav className="space-y-1">
          <Link href="/" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Home className="w-5 h-5 group-hover:text-primary transition-colors" />
            Home
          </Link>
          <Link href="/feed" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Sparkles className="w-5 h-5 group-hover:text-primary transition-colors" />
            Für dich
          </Link>
          <Link href="/charts/viral" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <TrendingUp className="w-5 h-5 group-hover:text-primary transition-colors" />
            Viral Charts
          </Link>
          <Link href="/artists" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Mic2 className="w-5 h-5 group-hover:text-primary transition-colors" />
            {t('home.quickAccess.artists')}
          </Link>
          <Link href="/discover/playlists" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <ListMusic className="w-5 h-5 group-hover:text-primary transition-colors" />
            Playlists Entdecken
          </Link>
          <Link href="/friends" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <UsersRound className="w-5 h-5 group-hover:text-primary transition-colors" />
            Friend Feed
          </Link>
        </nav>
      </div>

      <div className="px-3 mb-6">
        <p className="px-3 text-xs font-semibold text-muted tracking-wider uppercase mb-3">{t('nav.library')}</p>
        <nav className="space-y-1">
          <Link href="/playlists" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Library className="w-5 h-5 group-hover:text-primary transition-colors" />
            Meine Playlists
          </Link>
          <Link href="/collection/tracks" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <Heart className="w-5 h-5 group-hover:text-primary transition-colors" />
            Liked Songs
          </Link>
          <Link href="/following" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-primary/10 group rounded-md transition-all">
            <UserCheck className="w-5 h-5 group-hover:text-primary transition-colors" />
            Folge ich
          </Link>
        </nav>
      </div>

      <div className="px-3 mt-auto">
        {isAdmin && (
          <Link href="/upload" className="flex items-center gap-4 px-3 py-2.5 mb-2 text-sm font-bold text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors border border-white/10">
            <PlusCircle className="w-5 h-5" />
            {t('nav.upload')}
          </Link>
        )}
        <CreatePlaylistButton />
      </div>
    </div>
  );
}
