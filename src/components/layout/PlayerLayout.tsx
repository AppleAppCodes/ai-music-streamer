'use client';

import { useEffect } from 'react';
import { PlayerProvider } from '@/lib/player-context';
import i18n from '@/i18n/i18n';
import { hasPreferenceStorageConsent } from '@/lib/cookie-consent';

const LANGUAGE_STORAGE_KEY = 'ai-stream-language';

interface PlayerLayoutProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

export default function PlayerLayout({ children, isAuthenticated }: PlayerLayoutProps) {
  useEffect(() => {
    if (!hasPreferenceStorageConsent()) return;

    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && savedLanguage !== i18n.language) {
      i18n.changeLanguage(savedLanguage);
    }
  }, []);

  return (
    <PlayerProvider isAuthenticated={isAuthenticated}>
      {children}
    </PlayerProvider>
  );
}
