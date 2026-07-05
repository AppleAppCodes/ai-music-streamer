import { useState } from 'react';
import { BellRing, Send } from 'lucide-react';

const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 240;

type SendResult = { recipients: number; sent: number; failed: number; removed: number };

/** Broadcast a push notification to every device that opted in. */
export function PushTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    if (!window.confirm(`Push an ALLE Opt-in-Geräte senden?\n\n${title.trim()}\n${body.trim()}`)) return;

    setSending(true);
    setResult(null);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const json = await response.json();
      if (!response.ok) {
        setErrorMessage(json?.error ?? `Senden fehlgeschlagen (${response.status})`);
        return;
      }
      setResult(json as SendResult);
      setTitle('');
      setBody('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h2 className="mb-1 flex items-center gap-2 text-2xl font-bold text-white">
            <BellRing className="h-6 w-6 text-amber-400" /> Push-Benachrichtigung senden
          </h2>
          <p className="text-sm text-white/60">
            Geht an alle Geräte, deren Nutzer Push erlaubt haben. Sparsam einsetzen — zu viele
            Pushes führen direkt zur App-Löschung.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/45">
              Titel ({title.length}/{MAX_TITLE_LENGTH})
            </label>
            <input
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Neue Spotlight-Woche 🔥"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/25 focus:border-amber-400/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/45">
              Nachricht ({body.length}/{MAX_BODY_LENGTH})
            </label>
            <textarea
              value={body}
              maxLength={MAX_BODY_LENGTH}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="z. B. Hör dir die neuen Tracks der Woche an — jetzt auf YORIAX."
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/25 focus:border-amber-400/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-5 py-2.5 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" /> {sending ? 'Wird gesendet …' : 'An alle senden'}
          </button>

          {result && (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              ✅ Zugestellt an Expo: {result.sent} von {result.recipients} Geräten
              {result.failed > 0 ? ` · fehlgeschlagen: ${result.failed}` : ''}
              {result.removed > 0 ? ` · ${result.removed} tote Tokens entfernt` : ''}
              {result.recipients === 0 ? ' — noch hat kein Gerät Push aktiviert (kommt mit App-Version 1.1.1).' : ''}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              ❌ {errorMessage}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-white/35">
          Nutzer aktivieren Push in der App beim ersten Folgen eines Künstlers (ab Version 1.1.1).
          Abbestellen jederzeit über die iOS-Einstellungen; tote Tokens werden beim Senden
          automatisch aufgeräumt.
        </p>
      </div>
    </div>
  );
}
