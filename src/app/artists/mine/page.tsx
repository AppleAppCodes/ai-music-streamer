'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mic2, Music, Play, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createClient } from '@/utils/supabase/client';
import { isCreatorUser } from '@/lib/admin';

type MyArtist = {
  name: string;
  songsCount: number;
  totalPlays: number;
  coverUrl: string | null;
  bannerUrl: string | null;
};

function sanitizeArtistName(name: string) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export default function MyArtistsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [artists, setArtists] = useState<MyArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/login?next=/artists/mine');
          return;
        }
        if (!isCreatorUser(session.user)) {
          router.push('/');
          return;
        }
        if (!mounted) return;

        const { data: songs, error: songsError } = await supabase
          .from('songs')
          .select('artist_name, cover_url, plays, created_at')
          .eq('creator_id', session.user.id)
          .order('created_at', { ascending: false });

        if (songsError) throw songsError;

        const grouped = new Map<string, MyArtist>();
        for (const row of songs ?? []) {
          const name = (row.artist_name as string | null)?.trim();
          if (!name) continue;
          const existing = grouped.get(name);
          const plays = (row.plays as number | null) ?? 0;
          if (existing) {
            existing.songsCount += 1;
            existing.totalPlays += plays;
            if (!existing.coverUrl && row.cover_url) existing.coverUrl = row.cover_url as string;
          } else {
            grouped.set(name, {
              name,
              songsCount: 1,
              totalPlays: plays,
              coverUrl: (row.cover_url as string | null) ?? null,
              bannerUrl: null,
            });
          }
        }

        const list = Array.from(grouped.values()).sort((a, b) => b.totalPlays - a.totalPlays);

        await Promise.all(
          list.map(async (artist) => {
            const sanitized = sanitizeArtistName(artist.name);
            const { data: files } = await supabase.storage
              .from('covers')
              .list('banners', { search: sanitized });
            const banner = (files ?? [])
              .filter((f) => f.name.startsWith(sanitized) && !f.name.includes('_video'))
              .sort((a, b) => {
                const ta = new Date(a.updated_at || a.created_at || 0).getTime();
                const tb = new Date(b.updated_at || b.created_at || 0).getTime();
                return tb - ta;
              })[0];
            if (banner) {
              const { data } = supabase.storage
                .from('covers')
                .getPublicUrl(`banners/${banner.name}`);
              const cacheKey = banner.updated_at || banner.created_at || banner.name;
              artist.bannerUrl = `${data.publicUrl}?v=${encodeURIComponent(cacheKey)}`;
            }
          }),
        );

        if (!mounted) return;
        setArtists(list);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : t('myArtists.loadError'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [router, t]);

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={t('myArtists.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-violet-300/80">{t('myArtists.eyebrow')}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-black text-white tracking-tight">{t('myArtists.title')}</h1>
          <p className="mt-1 text-sm font-medium text-white/55">{t('myArtists.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-6 text-sm font-medium text-red-200">
          {error}
        </div>
      ) : artists.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-violet-300/25 bg-violet-500/12 text-violet-200">
            <Mic2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">{t('myArtists.empty')}</h2>
            <p className="mt-1 max-w-sm text-sm text-white/55">{t('myArtists.emptyHint')}</p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(124,58,237,0.45)] transition-transform hover:scale-105"
          >
            <Play className="h-4 w-4 fill-current" />
            {t('myArtists.emptyCta')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist) => (
            <Link
              key={artist.name}
              href={`/artist/${encodeURIComponent(artist.name)}`}
              className="group relative block h-56 overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl transition-all duration-500 hover:-translate-y-1 hover:border-violet-300/30 hover:shadow-[0_0_40px_rgba(168,85,247,0.25)]"
            >
              {artist.bannerUrl ? (
                <Image
                  src={artist.bannerUrl}
                  alt={artist.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover opacity-70 transition-transform duration-700 group-hover:scale-105"
                  unoptimized
                />
              ) : artist.coverUrl ? (
                <Image
                  src={artist.coverUrl}
                  alt={artist.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover opacity-50 blur-sm transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-purple-900/20 to-black" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-5 py-5">
                <h3 className="text-2xl font-black text-white tracking-tight drop-shadow-lg">{artist.name}</h3>
                <div className="flex items-center gap-3 text-xs font-bold text-white/75">
                  <span className="inline-flex items-center gap-1.5">
                    <Music className="h-3.5 w-3.5" />
                    {artist.songsCount} {artist.songsCount === 1 ? 'Song' : 'Songs'}
                  </span>
                  <span className="text-white/30">•</span>
                  <span>{artist.totalPlays.toLocaleString('de-DE')} Aufrufe</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
