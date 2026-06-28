import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

const BUNDLE_ID = 'com.yoriax.app';
const APP_STORE_ID = '6780680190';
const DISMISS_KEY = 'yoriax:update-dismissed-version';
const FALLBACK_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

export type AppUpdateInfo = {
  /** Latest version available on the App Store, e.g. "1.0.7". */
  version: string;
  /** Deep link that opens the App Store listing. */
  url: string;
};

type ITunesLookupResult = {
  resultCount?: number;
  results?: Array<{ version?: string; trackViewUrl?: string }>;
};

/**
 * Compares two dot-separated version strings numerically.
 * Returns true when `store` is strictly newer than `current` (e.g. "1.0.10" > "1.0.9").
 */
function isStoreVersionNewer(store: string, current: string): boolean {
  const storeParts = store.split('.').map((part) => parseInt(part, 10) || 0);
  const currentParts = current.split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(storeParts.length, currentParts.length);

  for (let index = 0; index < length; index += 1) {
    const storeNumber = storeParts[index] ?? 0;
    const currentNumber = currentParts[index] ?? 0;
    if (storeNumber > currentNumber) return true;
    if (storeNumber < currentNumber) return false;
  }

  return false;
}

async function lookupAppStore(): Promise<{ version: string; url: string } | null> {
  // The German store is queried first (primary market); fall back to the default
  // store so detection still works if the country-scoped lookup returns nothing.
  const endpoints = [
    `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}&country=de`,
    `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}&t=${Date.now()}`);
      if (!response.ok) continue;
      const data = (await response.json()) as ITunesLookupResult;
      const result = data.results?.[0];
      if (result?.version) {
        return { version: result.version, url: result.trackViewUrl || FALLBACK_STORE_URL };
      }
    } catch {
      // Try the next endpoint; network/parse failures must never surface to the UI.
    }
  }

  return null;
}

/**
 * Detects whether a newer build of the app is live on the App Store and, if so,
 * surfaces a one-time (per-version) prompt. Auto-detects new releases via Apple's
 * iTunes lookup API — no backend change or new app build is needed when a future
 * version ships. iOS only; resolves to no update on other platforms or on any error.
 */
export function useAppUpdate() {
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let mounted = true;

    void (async () => {
      const current = Application.nativeApplicationVersion;
      if (!current) return;

      const store = await lookupAppStore();
      if (!store || !isStoreVersionNewer(store.version, current)) return;

      const dismissedVersion = await AsyncStorage.getItem(DISMISS_KEY);
      if (dismissedVersion === store.version) return;

      if (mounted) {
        setUpdate({ version: store.version, url: store.url });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const dismiss = useCallback(async () => {
    const dismissedVersion = update?.version;
    setUpdate(null);
    if (dismissedVersion) {
      try {
        await AsyncStorage.setItem(DISMISS_KEY, dismissedVersion);
      } catch {
        // Best-effort: if persistence fails the prompt simply reappears next launch.
      }
    }
  }, [update]);

  return { update, dismiss };
}
