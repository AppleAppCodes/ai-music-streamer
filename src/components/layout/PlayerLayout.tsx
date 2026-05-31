'use client';

import { useEffect } from 'react';
import { PlayerProvider } from '@/lib/player-context';
import i18n from '@/i18n/i18n';

const LANGUAGE_STORAGE_KEY = 'ai-stream-language';

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && savedLanguage !== i18n.language) {
      i18n.changeLanguage(savedLanguage);
    }
  }, []);

  return (
    <PlayerProvider>
      {children}
    </PlayerProvider>
  );
}
