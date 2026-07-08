import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowDownWideNarrow, Edit2, FileAudio, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { GENRES } from '@/lib/constants';
import { formatAdminNumber, formatTrendPercent, getTrendClasses, type SongData } from '../types';

type SongSortKey =
  | 'newest'
  | 'oldest'
  | 'tracked'
  | 'plays7d'
  | 'display'
  | 'title'
  | 'artist'
  | 'lastPlayed'
  | 'listeners'
  | 'trend';

const SORT_OPTIONS: Array<[SongSortKey, string]> = [
  ['newest', 'Upload: neueste zuerst'],
  ['oldest', 'Upload: älteste zuerst'],
  ['tracked', 'Echte Plays (gesamt)'],
  ['plays7d', 'Echte Plays (7 Tage)'],
  ['display', 'Anzeige-Plays'],
  ['listeners', 'Hörer'],
  ['trend', 'Trend vs. Vorwoche'],
  ['lastPlayed', 'Zuletzt gehört'],
  ['title', 'Titel A–Z'],
  ['artist', 'Künstler A–Z'],
];

function compareSongs(a: SongData, b: SongData, key: SongSortKey): number {
  switch (key) {
    case 'newest':
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    case 'oldest':
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    case 'tracked':
      return (b.plays_tracked_total ?? 0) - (a.plays_tracked_total ?? 0);
    case 'plays7d':
      return (b.plays_7d ?? 0) - (a.plays_7d ?? 0);
    case 'display':
      return (b.plays ?? 0) - (a.plays ?? 0);
    case 'listeners':
      return (b.unique_listeners ?? 0) - (a.unique_listeners ?? 0);
    case 'trend':
      return (b.trend_percent ?? 0) - (a.trend_percent ?? 0);
    case 'lastPlayed':
      return (b.last_played_at ? new Date(b.last_played_at).getTime() : 0) - (a.last_played_at ? new Date(a.last_played_at).getTime() : 0);
    case 'title':
      return a.title.localeCompare(b.title, 'de');
    case 'artist':
      return (a.artist_name ?? '').localeCompare(b.artist_name ?? '', 'de');
  }
}

export function SongsTab({
  songs,
  expandedSongId,
  isReplacingAudio,
  onToggleExpanded,
  onChangeGenre,
  onReplaceAudio,
  onSetSpotlightSong,
  onEditSpotlightCopy,
  onEditSongTitle,
  onDeleteSong,
}: {
  songs: SongData[];
  expandedSongId: string | null;
  isReplacingAudio: string | null;
  onToggleExpanded: (id: string | null) => void;
  onChangeGenre: (id: string, newGenre: string) => void;
  onReplaceAudio: (event: React.ChangeEvent<HTMLInputElement>, id: string, title: string) => void;
  onSetSpotlightSong: (id: string, title: string) => void;
  onEditSpotlightCopy: (id: string, title: string, currentCopy: string | null) => void;
  onEditSongTitle: (id: string, currentTitle: string) => void;
  onDeleteSong: (id: string, title: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SongSortKey>('newest');
  const sortedSongs = useMemo(
    () => [...songs].sort((a, b) => compareSongs(a, b, sortKey)),
    [songs, sortKey],
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-2 px-6 py-3">
        <ArrowDownWideNarrow className="h-4 w-4 text-white/40" />
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Sortieren</span>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SongSortKey)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 focus:border-indigo-500 focus:outline-none"
        >
          {SORT_OPTIONS.map(([key, label]) => (
            <option key={key} value={key} className="bg-neutral-900">
              {label}
            </option>
          ))}
        </select>
      </div>
      <table className="w-full text-left text-sm text-white/70">
        <thead className="text-xs uppercase bg-black/40 text-white/50">
          <tr>
            <th className="px-6 py-4 font-semibold">Song Titel</th>
            <th className="px-6 py-4 font-semibold">Künstler</th>
            <th className="px-6 py-4 font-semibold">Performance</th>
            <th className="px-6 py-4 font-semibold">Engagement</th>
            <th className="px-6 py-4 font-semibold">Trend</th>
            <th className="px-6 py-4 font-semibold">Zuletzt</th>
            <th className="px-6 py-4 font-semibold">AI Tool</th>
            <th className="px-6 py-4 font-semibold text-right">Aktion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sortedSongs.length > 0 ? sortedSongs.map((song) => {
            const expanded = expandedSongId === song.id;
            const trend = song.trend_percent ?? 0;
            const isNewTrend = (song.previous_7d ?? 0) === 0 && (song.plays_7d ?? 0) > 0;

            return (
              <Fragment key={song.id}>
                <tr className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 font-medium text-white max-w-[220px] truncate" title={song.title}>
                    <Link href={`/song/${song.id}`} className="hover:text-indigo-400 hover:underline">
                      {song.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 max-w-[150px] truncate" title={song.artist_name}>{song.artist_name || 'Unbekannt'}</td>
                  <td className="px-6 py-4">
                    <div className="whitespace-nowrap font-mono text-white" title="Echte, getrackte Wiedergaben (seit 31.05.)">
                      {formatAdminNumber(song.plays_tracked_total)} <span className="font-sans text-[10px] uppercase tracking-wider text-emerald-400/80">echt</span>
                    </div>
                    <div className="mt-1 whitespace-nowrap text-xs text-white/40">
                      24h {formatAdminNumber(song.plays_24h)} · 7d {formatAdminNumber(song.plays_7d)} · 30d {formatAdminNumber(song.plays_30d)}
                    </div>
                    <div className="mt-0.5 whitespace-nowrap text-xs text-sky-300/70" title="Anspielungen (Song gestartet, egal wie lange) — Interesse vs. echtes Hören">
                      ▷ {formatAdminNumber(song.starts_total)} Starts
                    </div>
                    <div className="mt-0.5 whitespace-nowrap text-xs text-white/30" title="Öffentlicher Anzeige-Zähler in der App">
                      Anzeige: {formatAdminNumber(song.plays)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="whitespace-nowrap text-white/75">👤 {formatAdminNumber(song.unique_listeners)} Listener</div>
                    <div className="mt-1 whitespace-nowrap text-xs text-white/40">
                      ❤ {formatAdminNumber(song.likes_count)} · ☰ {formatAdminNumber(song.playlist_adds)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex min-w-[72px] justify-center rounded-full border px-2.5 py-1 text-xs font-bold ${getTrendClasses(trend)}`}>
                      {isNewTrend ? 'Neu' : formatTrendPercent(trend)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-white/50">
                    {song.last_played_at ? new Date(song.last_played_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-white/5 rounded text-xs border border-white/10">
                      {song.ai_tool || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => onToggleExpanded(expanded ? null : song.id)}
                      className={`p-2 rounded-lg transition-all ${
                        expanded
                          ? 'text-indigo-300 bg-indigo-400/15'
                          : 'text-white/40 hover:text-indigo-300 hover:bg-indigo-400/10'
                      }`}
                      title={expanded ? 'Details schließen' : 'Performance-Details anzeigen'}
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                    <select
                      value={song.genre ?? ''}
                      onChange={(e) => onChangeGenre(song.id, e.target.value)}
                      title="Genre ändern"
                      className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/80 focus:border-indigo-400/55 focus:outline-none"
                    >
                      {!song.genre && <option value="" disabled>Genre…</option>}
                      {song.genre && !GENRES.some((g) => g.name === song.genre) && (
                        <option value={song.genre}>{song.genre}</option>
                      )}
                      {GENRES.map((g) => (
                        <option key={g.name} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                    <label
                      className="p-2 cursor-pointer text-white/40 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Audiodatei austauschen"
                    >
                      {isReplacingAudio === song.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileAudio className="w-4 h-4" />
                      )}
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => onReplaceAudio(e, song.id, song.title)}
                        disabled={isReplacingAudio === song.id}
                      />
                    </label>
                    <button
                      onClick={() => onSetSpotlightSong(song.id, song.title)}
                      className={`p-2 rounded-lg transition-all ${
                        song.is_spotlight
                          ? 'text-fuchsia-300 bg-fuchsia-400/15'
                          : 'text-white/40 hover:text-fuchsia-300 hover:bg-fuchsia-400/10 opacity-0 group-hover:opacity-100'
                      }`}
                      title={song.is_spotlight ? 'Aktuelles Home-Spotlight' : 'Als Home-Spotlight setzen'}
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    {song.is_spotlight ? (
                      <button
                        onClick={() => onEditSpotlightCopy(song.id, song.title, song.spotlight_copy ?? null)}
                        className="p-2 text-fuchsia-300/80 hover:text-fuchsia-200 hover:bg-fuchsia-400/10 rounded-lg transition-all"
                        title={song.spotlight_copy ? 'Spotlight-Text bearbeiten' : 'Spotlight-Text setzen'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    ) : null}
                    <button
                      onClick={() => onEditSongTitle(song.id, song.title)}
                      className="p-2 text-white/40 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Song umbenennen"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteSong(song.id, song.title)}
                      className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Song endgültig löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="bg-indigo-500/[0.035]">
                    <td colSpan={8} className="px-6 py-4">
                      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
                        {[
                          ['Echte Plays gesamt', formatAdminNumber(song.plays_tracked_total)],
                          ['Anspielungen (Starts)', formatAdminNumber(song.starts_total)],
                          ['Anzeige-Plays', formatAdminNumber(song.plays)],
                          ['24h', formatAdminNumber(song.plays_24h)],
                          ['7 Tage', formatAdminNumber(song.plays_7d)],
                          ['30 Tage', formatAdminNumber(song.plays_30d)],
                          ['Unique Listener', formatAdminNumber(song.unique_listeners)],
                          ['Likes', formatAdminNumber(song.likes_count)],
                          ['Playlist-Adds', formatAdminNumber(song.playlist_adds)],
                          ['Trend vs. Vorwoche', isNewTrend ? 'Neu' : formatTrendPercent(song.trend_percent)],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</div>
                            <div className="mt-1 text-lg font-black text-white">{value}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          }) : (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-white/40">Keine Songs gefunden.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
