import Link from 'next/link';
import { ArrowRight, Mic2, Music2, Sparkles } from 'lucide-react';
import type { Song } from '@/lib/types';

function SectionTitle({ children, href }: { children: React.ReactNode; href?: string }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{children}</h2>
      {href ? (
        <Link href={href} className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/55 transition-colors hover:text-white">
          Alle anzeigen
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

export default function GuestHome({ songs }: { songs: Song[] }) {
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
            Yoriax entdecken
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
            Entdecke Musik, die es nur hier gibt.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/58 sm:text-base">
            Durchsuche neue Releases, angesagte Songs und Künstler*innen. Mit einem kostenlosen Konto kannst du direkt loshören und Playlists erstellen.
          </p>
        </div>
      </section>

      <div className="space-y-14 px-5 sm:px-8 md:px-10">
        <section>
          <SectionTitle href="/search">Angesagte Songs</SectionTitle>
          {songs.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {songs.slice(0, 12).map((song) => (
                <Link
                  key={song.id}
                  href={`/song/${song.id}`}
                  className="group min-w-0 rounded-2xl border border-white/5 bg-white/[0.035] p-3 transition-all hover:-translate-y-1 hover:border-white/12 hover:bg-white/[0.075]"
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-white/5 shadow-xl">
                    <img src={song.cover_url} alt={song.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <h3 className="mt-3 truncate text-sm font-bold text-white">{song.title}</h3>
                  <p className="mt-1 truncate text-xs text-white/48">{song.artist_name || 'Unbekannt'}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-sm text-white/50">Noch keine Songs verfügbar.</div>
          )}
        </section>

        <section>
          <SectionTitle href="/artists">Angesagte Künstler*innen</SectionTitle>
          {artists.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {artists.map((artist) => (
                <Link
                  key={artist.name}
                  href={`/artist/${encodeURIComponent(artist.name)}`}
                  className="group min-w-0 rounded-2xl p-2 text-center transition-colors hover:bg-white/[0.055]"
                >
                  <div className="aspect-square overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-xl">
                    {artist.coverUrl ? (
                      <img src={artist.coverUrl} alt={artist.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Mic2 className="h-10 w-10 text-white/20" />
                      </div>
                    )}
                  </div>
                  <h3 className="mt-3 truncate text-sm font-bold text-white">{artist.name}</h3>
                  <p className="mt-1 text-xs text-white/45">Künstler*in</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-sm text-white/50">Noch keine Künstler*innen verfügbar.</div>
          )}
        </section>

        <section className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.075] to-white/[0.025] p-6 sm:p-8">
          <Music2 className="h-7 w-7 text-violet-300" />
          <h2 className="mt-4 text-2xl font-black text-white">Deine Musik beginnt mit einem Konto.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Registriere dich kostenlos, höre Songs vollständig und speichere deine Favoriten in eigenen Playlists.
          </p>
        </section>
      </div>
    </div>
  );
}
