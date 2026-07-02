import { Terminal } from 'lucide-react';
import type { McpLog } from '../types';

export function BotTab({
  mcpLogs,
  liveConnected,
}: {
  mcpLogs: McpLog[];
  liveConnected: boolean;
}) {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Bot- &amp; Admin-Aktivität</h2>
            <p className="text-white/60 text-sm max-w-2xl">
              Live-Protokoll aller Änderungen an der Datenbank durch Bots, KI-Assistenten
              oder Admins – z.&nbsp;B. Songs hochladen, umbenennen oder löschen und Playlists
              bearbeiten. Aktionen normaler Nutzer (z.&nbsp;B. Abspielen) erscheinen hier nicht.
            </p>
          </div>
          <div className={`${liveConnected ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-white/5 text-white/40 border-white/10'} border px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shrink-0`}>
            <span className="relative flex h-2 w-2">
              {liveConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${liveConnected ? 'bg-green-500' : 'bg-white/30'}`}></span>
            </span>
            {liveConnected ? 'Live' : 'Verbinde …'}
          </div>
        </div>

        {/* How to connect a bot / agent */}
        <div className="mb-6 rounded-2xl border border-indigo-400/15 bg-indigo-500/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-indigo-300" />
            <h3 className="text-sm font-bold text-white">So verbindest du deinen Bot</h3>
          </div>
          <p className="text-sm text-white/60 mb-4">
            Du musst nichts Spezielles einrichten: Jede Änderung an der Datenbank durch einen
            Bot, KI-Assistenten oder Admin landet automatisch in diesem Protokoll.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] font-black uppercase tracking-wider text-teal-300/80 mb-1">Methode 1 · am einfachsten</div>
              <div className="text-sm font-semibold text-white mb-1">Supabase-MCP</div>
              <p className="text-xs text-white/55 leading-relaxed">
                Verbinde in deinem KI-Tool (Claude Desktop, Cursor, Antigravity) den
                Supabase-MCP-Server. Deine Aktionen erscheinen dann automatisch hier – das
                nutzt du bereits.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] font-black uppercase tracking-wider text-indigo-300/80 mb-1">Methode 2 · eigene Tools</div>
              <div className="text-sm font-semibold text-white mb-1">YORIAX-MCP-Server</div>
              <p className="text-xs text-white/55 leading-relaxed">
                Für Komfort-Befehle (Song hochladen, umbenennen, Playlist verwalten) trägst
                du den YORIAX-Server in die MCP-Config deines Agenten ein.
              </p>
            </div>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer select-none text-xs text-white/50 hover:text-white/70">Config-Beispiel (Methode 2) anzeigen</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-black/50 p-3 text-[11px] leading-relaxed text-white/70">{`"yoriax": {
  "command": "node",
  "args": ["/Pfad/zu/mcp-server/dist/index.js"],
  "env": {
    "SUPABASE_URL": "https://eiqelhjugiwckvxyixyh.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "<dein Service-Role-Key>"
  }
}`}</pre>
          </details>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-green-300">✓ Geloggt: Uploads, Umbenennungen, Löschungen, Playlists, Rollen</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/45">✗ Ignoriert: normales Abspielen &amp; Stöbern</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-black/20 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-white/40" />
            <span className="text-sm font-semibold text-white/70">Aktivitäts-Protokoll</span>
          </div>
          {mcpLogs.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Noch keine Aktivitäten. Sobald ein Bot, KI-Assistent oder Admin etwas ändert
              (Song hochladen, umbenennen, Playlist bearbeiten …), erscheint es hier sofort.
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {mcpLogs.map((log) => {
                const actor = typeof log.arguments?._akteur === 'string' ? (log.arguments._akteur as string) : null;
                const actorLabel = actor === 'system' ? 'Bot / MCP' : actor === 'service_role' ? 'Service' : actor;
                const detailKeys = log.arguments ? Object.keys(log.arguments).filter((k) => k !== '_akteur') : [];
                return (
                  <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <span className="text-sm font-semibold text-white/90">
                        {log.response_summary || log.tool_name}
                      </span>
                      <span className="shrink-0 text-xs text-white/40">
                        {new Date(log.created_at).toLocaleString('de-DE')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-[11px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">
                        {log.tool_name}
                      </span>
                      {actorLabel && (
                        <span className="text-[11px] text-white/40 bg-white/5 px-2 py-0.5 rounded">
                          {actorLabel}
                        </span>
                      )}
                    </div>
                    {detailKeys.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer select-none text-white/40 hover:text-white/60">Details</summary>
                        <div className="mt-1 font-mono text-white/60 bg-black/40 p-2 rounded border border-white/5 break-all">
                          {JSON.stringify(log.arguments)}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
