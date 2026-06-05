export const COOKIE_CONSENT_STORAGE_KEY = 'yoriax-cookie-consent-v1';
export const LEGACY_COOKIE_CONSENT_STORAGE_KEY = 'cookie-consent';
export const COOKIE_SETTINGS_EVENT = 'yoriax:open-cookie-settings';
export const COOKIE_CONSENT_CHANGED_EVENT = 'yoriax:cookie-consent-changed';

export interface CookieConsentState {
  version: 1;
  necessary: true;
  preferences: boolean;
  analytics: false;
  marketing: false;
  updatedAt: string;
}

export function readCookieConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawConsent = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!rawConsent) return null;

    const parsed = JSON.parse(rawConsent) as Partial<CookieConsentState>;
    if (parsed.version !== 1 || parsed.necessary !== true) return null;

    return {
      version: 1,
      necessary: true,
      preferences: parsed.preferences === true,
      analytics: false,
      marketing: false,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeCookieConsent(preferences: boolean): CookieConsentState {
  const consent: CookieConsentState = {
    version: 1,
    necessary: true,
    preferences,
    analytics: false,
    marketing: false,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
  window.localStorage.removeItem(LEGACY_COOKIE_CONSENT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: consent }));

  return consent;
}

export function hasPreferenceStorageConsent() {
  return readCookieConsent()?.preferences === true;
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
