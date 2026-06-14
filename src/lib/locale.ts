export type SupportedLocale = 'de' | 'en';

export function getLocaleFromAcceptLanguage(acceptLanguage: string | null | undefined): SupportedLocale {
  if (!acceptLanguage) return 'en';

  const preferred = acceptLanguage
    .split(',')
    .map((entry) => {
      const [language = '', qValue = 'q=1'] = entry.trim().split(';');
      const q = Number.parseFloat(qValue.replace('q=', ''));
      return { language: language.toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .sort((a, b) => b.q - a.q)
    .find(({ language }) => language);

  return preferred?.language.startsWith('de') ? 'de' : 'en';
}
