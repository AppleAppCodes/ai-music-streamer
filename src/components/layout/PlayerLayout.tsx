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
    let languageToSet: string | null = null;

    if (hasPreferenceStorageConsent()) {
      languageToSet = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    }

    if (!languageToSet) {
      const browserLang = window.navigator.language || '';
      languageToSet = browserLang.toLowerCase().startsWith('de') ? 'de' : 'en';
    }

    if (languageToSet && languageToSet !== i18n.language) {
      i18n.changeLanguage(languageToSet);
    }

    // Apply saved zoom level globally
    if (hasPreferenceStorageConsent()) {
      const savedZoom = window.localStorage.getItem('ai-stream-zoom');
      if (savedZoom) {
        document.documentElement.style.zoom = `${savedZoom}%`;
      }
    }
  }, []);

  return (
    <PlayerProvider isAuthenticated={isAuthenticated}>
      {children}
    </PlayerProvider>
  );
}
