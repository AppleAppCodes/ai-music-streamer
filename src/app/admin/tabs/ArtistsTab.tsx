import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatAdminNumber } from '../types';

// Row shape of the get_admin_artist_performance RPC. Lives here (not in
// ../types) so the shared types file stays untouched while Codex works in it.
export type ArtistPerformanceRow = {
  artist_name: string;
  songs_count: number;
  followers: number;
  display_plays: number | string;
  plays_tracked_total: number | string;
  plays_7d: number | string;
  plays_30d: number | string;
  unique_listeners: number | string;
  likes: number | string;
  last_played_at: string | null;
};

type SortKey = 'artist_name' | 'songs_count' | 'followers' | 'display_plays' | 'plays_tracked_total' | 'plays_7d' | 'plays_30d' | 'unique_listeners' | 'likes';

const COLUMNS: Array<{ key: SortKey; label: string; hint?: string }> = [
  { key: 'artist_name', label: 'Künstler' },
  { key: 'songs_count', label: 'Songs' },
  { key: 'followers', label: 'Follower' },
  { key: 'plays_7d', label: 'Plays 7 T', hint: 'getrackt' },
  { key: 'plays_30d', label: 'Plays 30 T', hint: 'getrackt' },
  { key: 'plays_tracked_total', label: 'Plays gesamt', hint: 'getrackt seit 31.05.' },
  { key: 'unique_listeners', label: 'Hörer' },
  { key: 'likes', label: 'Likes' },
  { key: 'display_plays', label: 'Anzeige-Plays', hint: 'öffentlicher Zähler' },
];

export function ArtistsTab({ rows }: { rows: ArtistPerformanceRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('plays_30d');
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === 'artist_name') {
        const result = a.artist_name.localeCompare(b.artist_name, 'de');
        return sortDesc ? -result : result;
      }
      const result = Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0);
      return sortDesc ? -result : result;
    });
    return copy;
  }, [rows, sortKey, sortDesc]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((current) => !current);
    } else {
      setSortKey(key);
      setSortDesc(key !== 'artist_name');
    }
  }

  if (rows.length === 0) {
    return <div className="p-12 text-center text-white/50">Noch keine Künstler-Daten vorhanden.</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-4">
        <h2 className="mb-1 text-2xl font-bold text-white">Künstler-Performance</h2>
        <p className="text-sm text-white/60">
          Alle Kennzahlen pro Künstler. Plays-Spalten zeigen echte, getrackte Wiedergaben — nur
          &bdquo;Anzeige-Plays&ldquo; ist der öffentliche Zähler aus der App. Klick auf eine Spalte sortiert.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-white/70">
          <thead className="bg-black/40 text-xs uppercase text-white/50">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-4 font-semibold">
                  <button
                    onClick={() => handleSort(column.key)}
                    className={`flex items-center gap-1 uppercase transition-colors hover:text-white ${sortKey === column.key ? 'text-white' : ''}`}
                    title={column.hint}
                  >
                    {column.label}
                    {sortKey === column.key ? (sortDesc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((row) => (
              <tr key={row.artist_name} className="transition-colors hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-white">
                  <a href={`/artist/${encodeURIComponent(row.artist_name)}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {row.artist_name}
                  </a>
                </td>
                <td className="px-4 py-3">{formatAdminNumber(row.songs_count)}</td>
                <td className="px-4 py-3">{formatAdminNumber(row.followers)}</td>
                <td className="px-4 py-3">{formatAdminNumber(Number(row.plays_7d))}</td>
                <td className="px-4 py-3">{formatAdminNumber(Number(row.plays_30d))}</td>
                <td className="px-4 py-3">{formatAdminNumber(Number(row.plays_tracked_total))}</td>
                <td className="px-4 py-3">{formatAdminNumber(Number(row.unique_listeners))}</td>
                <td className="px-4 py-3">{formatAdminNumber(Number(row.likes))}</td>
                <td className="px-4 py-3 text-white/45">{formatAdminNumber(Number(row.display_plays))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
