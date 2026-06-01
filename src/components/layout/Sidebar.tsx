'use client';

import Link from 'next/link';
import { Home, Library, PlusCircle, Heart, TrendingUp, Mic2, ListMusic, Radio, UserCheck, AudioWaveform, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CreatePlaylistButton from '@/components/ui/CreatePlaylistButton';

export default function Sidebar() {
  const { t } = useTranslation();

  return (
    <div className="hidden w-64 bg-black h-full md:flex flex-col pt-6 pb-24 border-r border-white/5">
      <div className="px-6 mb-8">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all duration-300">
            <AudioWaveform className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            Yoriax
          </span>
        </Link>
      </div>

      <div className="px-3 mb-6">
        <p className="px-3 text-xs font-semibold text-muted tracking-wider uppercase mb-3">{t('nav.discover')}</p>
        <nav className="space-y-1">
          <Link href="/" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Home className="w-5 h-5" />
            Home
          </Link>
          <Link href="/charts/viral" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <TrendingUp className="w-5 h-5" />
            Viral Charts
          </Link>
          <Link href="/artists" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Mic2 className="w-5 h-5" />
            {t('home.quickAccess.artists')}
          </Link>
          <Link href="/discover/playlists" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <ListMusic className="w-5 h-5" />
            Playlists Entdecken
          </Link>
          <Link href="/friends" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <UsersRound className="w-5 h-5" />
            Friend Feed
          </Link>
          <Link href="#" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Radio className="w-5 h-5" />
            {t('home.quickAccess.radio')}
          </Link>
        </nav>
      </div>

      <div className="px-3 mb-6">
        <p className="px-3 text-xs font-semibold text-muted tracking-wider uppercase mb-3">{t('nav.library')}</p>
        <nav className="space-y-1">
          <Link href="/playlists" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Library className="w-5 h-5" />
            Meine Playlists
          </Link>
          <Link href="/collection/tracks" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Heart className="w-5 h-5" />
            Liked Songs
          </Link>
          <Link href="/following" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <UserCheck className="w-5 h-5" />
            Folge ich
          </Link>
        </nav>
      </div>

      <div className="px-3 mt-auto">
        <Link href="/upload" className="flex items-center gap-4 px-3 py-2.5 mb-2 text-sm font-bold text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors border border-white/10">
          <PlusCircle className="w-5 h-5" />
          {t('nav.upload')}
        </Link>
        <CreatePlaylistButton />
      </div>
    </div>
  );
}
