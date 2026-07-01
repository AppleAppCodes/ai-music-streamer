'use client';

import Link from 'next/link';
import { Mic2, Music2, Sparkles, Music } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Song } from '@/lib/types';
import Image from 'next/image';

type GuestSong = Pick<Song, 'id' | 'title' | 'artist_name' | 'cover_url' | 'plays'>;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{children}</h2>
    </div>
  );
}

export default function GuestHome({ songs }: { songs: GuestSong[] }) {
  const { t } = useTranslation();
  
  const artists = Array.from(
    songs.reduce((map, song) => {
      const name = song.artist_name?.trim();
      if (!name) return map;

      const current = map.get(name);
      if (!current) {
        map.set(name, { name, coverUrl: song.cover_url, plays: song.plays || 0 });
      } else {
        current.plays += song.plays || 0;
      }
      return map;
    }, new Map<string, { name: string; coverUrl: string; plays: number }>()),
  )
    .map(([, artist]) => artist)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 8);

  return (
    <div className="min-h-full bg-[#080808] pb-28">
      <section className="relative overflow-hidden px-5 pb-10 pt-12 sm:px-8 md:px-10 md:pb-14 md:pt-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(124,58,237,0.32),transparent_36%),radial-gradient(circle_at_82%_0%,rgba(45,212,191,0.16),transparent_30%)]" />
        <div className="relative max-w-3xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/80">
            <Sparkles className="h-4 w-4" />
            {t('guestHome.eyebrow')}
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
            {t('guestHome.title')}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/58 sm:text-base">
            {t('guestHome.description')}
          </p>
        </div>
      </section>

      <div className="space-y-14 px-5 sm:px-8 md:px-10">
        <section>
          <SectionTitle>{t('guestHome.trendingSongs')}</SectionTitle>
          {songs.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {songs.slice(0, 12).map((song, idx) => (
                <Link
                  key={song.id}
                  href="/login"
                  className="group min-w-0 rounded-2xl border border-white/5 bg-white/[0.035] p-3 transition-all hover:-translate-y-1 hover:border-white/12 hover:bg-white/[0.075]"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-white/5 shadow-xl flex items-center justify-center">
                    {song.cover_url ? (
                      <Image 
                        src={song.cover_url} 
                        alt={song.title} 
                        fill 
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 20vw, 150px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        priority={idx < 4}
                      />
                    ) : (
                      <Music className="h-12 w-12 text-white/20" />
                    )}
                  </div>
                  <h3 className="mt-3 truncate text-sm font-bold text-white">{song.title}</h3>
                  <p className="mt-1 truncate text-xs text-white/48">{song.artist_name || t('guestHome.unknownArtist')}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-sm text-white/50">{t('guestHome.noSongs')}</div>
          )}
        </section>

        <section>
          <SectionTitle>{t('guestHome.trendingArtists')}</SectionTitle>
          {artists.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {artists.map((artist) => (
                <Link
                  key={artist.name}
                  href="/login"
                  className="group min-w-0 rounded-2xl p-2 text-center transition-colors hover:bg-white/[0.055]"
                >
                  <div className="relative aspect-square overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-xl flex items-center justify-center">
                    {artist.coverUrl ? (
                      <Image 
                        src={artist.coverUrl} 
                        alt={artist.name} 
                        fill 
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 120px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Mic2 className="h-10 w-10 text-white/20" />
                      </div>
                    )}
                  </div>
                  <h3 className="mt-3 truncate text-sm font-bold text-white">{artist.name}</h3>
                  <p className="mt-1 text-xs text-white/45">{t('guestHome.artistLabel')}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-sm text-white/50">{t('guestHome.noArtists')}</div>
          )}
        </section>

        <section className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.075] to-white/[0.025] p-6 sm:p-8">
          <Music2 className="h-7 w-7 text-violet-300" />
          <h2 className="mt-4 text-2xl font-black text-white">{t('guestHome.ctaTitle')}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            {t('guestHome.ctaDescription')}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { href: '/ai-music', label: 'AI Music' },
              { href: '/ai-songs', label: 'AI Songs' },
              { href: '/artists', label: 'AI Artists' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-white/75 transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
