'use client';

import { useEffect } from 'react';

export default function ArtistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Artist page error:', error);
  }, [error]);

  return (
    <div className="yoriax-page flex min-h-screen flex-1 flex-col items-center justify-center p-8 text-white">
      <h2 className="text-2xl font-bold mb-4">Fehler beim Laden der Künstlerseite</h2>
      <pre className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 text-sm text-red-200 max-w-2xl overflow-x-auto mb-6 whitespace-pre-wrap">
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        className="bg-primary hover:bg-primary/80 text-white px-6 py-2 rounded-full font-bold transition-colors"
      >
        Erneut versuchen
      </button>
    </div>
  );
}
