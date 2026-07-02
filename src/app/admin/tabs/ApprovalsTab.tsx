import { Play } from 'lucide-react';
import { openTrustedExternalUrl, type SongData } from '../types';

export function ApprovalsTab({
  pendingSongs,
  onApprove,
  onReject,
}: {
  pendingSongs: SongData[];
  onApprove: (id: string, title: string) => void;
  onReject: (id: string, title: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-white/70">
        <thead className="text-xs uppercase bg-black/40 text-white/50">
          <tr>
            <th className="px-6 py-4 font-semibold">Titel</th>
            <th className="px-6 py-4 font-semibold">Künstler</th>
            <th className="px-6 py-4 font-semibold">Datum</th>
            <th className="px-6 py-4 font-semibold text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {pendingSongs.length > 0 ? pendingSongs.map((song) => (
            <tr key={song.id} className="hover:bg-white/5 transition-colors">
              <td className="px-6 py-4 font-medium text-white max-w-[200px] truncate" title={song.title}>
                {song.title}
              </td>
              <td className="px-6 py-4 max-w-[150px] truncate" title={song.artist_name}>{song.artist_name || 'Unbekannt'}</td>
              <td className="px-6 py-4">{new Date(song.created_at).toLocaleDateString('de-DE')}</td>
              <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                {song.audio_url && (
                  <button
                    onClick={() => openTrustedExternalUrl(song.audio_url)}
                    className="p-2 text-blue-400 hover:text-white hover:bg-blue-500 rounded-lg transition-all"
                    title="Song anhören"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onApprove(song.id, song.title)}
                  className="px-3 py-1.5 text-xs font-bold text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-md transition-all"
                >
                  Freigeben
                </button>
                <button
                  onClick={() => onReject(song.id, song.title)}
                  className="px-3 py-1.5 text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-all"
                >
                  Ablehnen
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={4} className="px-6 py-12 text-center text-white/40">Keine ausstehenden Freigaben.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
