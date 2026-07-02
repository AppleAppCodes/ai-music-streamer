import { useLocales } from 'expo-localization';
import { I18n, type TranslateOptions } from 'i18n-js';
import { createContext, type PropsWithChildren, useContext, useMemo } from 'react';

// Translations live in per-locale JSON files so adding or editing a language
// touches one small file instead of this module (and stays translator-friendly).
import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import it from '../locales/it.json';
import pt from '../locales/pt.json';
import nl from '../locales/nl.json';

const translations = { de, en, es, fr, it, pt, nl } as const;

export type AppLocale = keyof typeof translations;

function getAppLocale(languageCode?: string | null): AppLocale {
  if (languageCode === 'de') return 'de';
  if (languageCode === 'es') return 'es';
  if (languageCode === 'fr') return 'fr';
  if (languageCode === 'it') return 'it';
  if (languageCode === 'pt') return 'pt';
  if (languageCode === 'nl') return 'nl';
  return 'en';
}

type I18nContextValue = {
  locale: AppLocale;
  t: (key: string, options?: TranslateOptions) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: PropsWithChildren) {
  const locales = useLocales();
  const locale = getAppLocale(locales[0]?.languageCode?.toLowerCase());
  const value = useMemo<I18nContextValue>(() => {
    const i18n = new I18n(translations);
    i18n.defaultLocale = 'en';
    i18n.enableFallback = true;
    i18n.locale = locale;

    return {
      locale,
      t: (key, options) => i18n.t(key, options),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
