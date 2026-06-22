'use client';

import { useState } from 'react';
import { Flag, X, AlertTriangle, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface ReportDialogProps {
  entityType: 'playlist' | 'profile' | 'artist' | 'song';
  entityId: string;
  entityName: string;
  trigger?: React.ReactNode;
}

const REPORT_REASONS = [
  'Sexueller Inhalt oder Nacktheit',
  'Gewaltverherrlichend',
  'Hassrede oder Beleidigung',
  'Urheberrechtsverletzung',
  'Spam oder irreführend',
  'Sonstiges',
];

export default function ReportDialog({ entityType, entityId, entityName, trigger }: ReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReport = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        alert('Bitte logge dich ein, um Inhalte zu melden.');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from('reports').insert({
        reporter_id: session.user.id,
        entity_type: entityType,
        entity_id: entityId,
        reason: selectedReason,
        status: 'pending'
      });

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        setSelectedReason('');
      }, 3000);
    } catch (err: unknown) {
      console.error('Error reporting:', err);
      alert('Fehler beim Senden der Meldung. Bitte später erneut versuchen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {trigger || (
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 rounded-md transition-colors w-full text-left">
            <Flag className="w-4 h-4" />
            Melden
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Inhalt melden
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <Flag className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">Vielen Dank!</h4>
                <p className="text-white/60 text-sm">
                  Deine Meldung für &quot;{entityName}&quot; wurde eingereicht. Unser Team wird das schnellstmöglich prüfen.
                </p>
              </div>
            ) : (
              <>
                <p className="text-white/70 text-sm mb-6">
                  Warum möchtest du <strong>{entityName}</strong> melden? Deine Meldung bleibt anonym.
                </p>

                <div className="flex flex-col gap-2 mb-6">
                  {REPORT_REASONS.map(reason => (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        selectedReason === reason 
                          ? 'bg-red-500/20 border-red-500 text-red-200' 
                          : 'bg-white/5 border-white/5 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 justify-end">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 rounded-lg font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm"
                  >
                    Abbrechen
                  </button>
                  <button 
                    onClick={handleReport}
                    disabled={!selectedReason || isSubmitting}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-white/50 text-white px-5 py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                    Meldung absenden
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
