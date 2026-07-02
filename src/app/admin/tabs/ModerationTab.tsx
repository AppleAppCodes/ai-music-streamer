import Link from 'next/link';
import { ShieldAlert, Trash2 } from 'lucide-react';
import type { Report } from '../types';

export function ModerationTab({
  reports,
  onResolve,
}: {
  reports: Report[];
  onResolve: (reportId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      {reports.length === 0 ? (
        <div className="p-12 text-center text-white/50 flex flex-col items-center">
          <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
          <p>Keine Meldungen vorhanden. Alles sieht gut aus!</p>
        </div>
      ) : (
        <table className="w-full text-left text-sm text-white/70">
          <thead className="text-xs uppercase bg-black/40 text-white/50">
            <tr>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Typ</th>
              <th className="px-6 py-4 font-semibold">Grund</th>
              <th className="px-6 py-4 font-semibold">Datum</th>
              <th className="px-6 py-4 font-semibold text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  {report.status === 'pending' ? (
                    <span className="text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md text-xs font-bold border border-amber-400/20">Ausstehend</span>
                  ) : (
                    <span className="text-green-400 bg-green-400/10 px-2 py-1 rounded-md text-xs font-bold border border-green-400/20">Erledigt</span>
                  )}
                </td>
                <td className="px-6 py-4 capitalize text-white font-medium">
                  {report.entity_type}
                </td>
                <td className="px-6 py-4 font-medium">
                  {report.reason}
                </td>
                <td className="px-6 py-4 text-white/40">
                  {new Date(report.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                  <button
                    onClick={() => onResolve(report.id)}
                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    title="Als erledigt markieren"
                    disabled={report.status === 'resolved'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    href={report.entity_type === 'playlist' ? `/playlist/${report.entity_id}` : `/artist/${report.entity_id}`}
                    target="_blank"
                    className="px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors"
                  >
                    Prüfen
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
