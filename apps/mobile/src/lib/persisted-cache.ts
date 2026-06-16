import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type CacheEnvelope<T> = {
  savedAt: number;
  value: T;
};

export async function readPersistedCache<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<T | null> {
  try {
    const rawValue = await AsyncStorage.getItem(key);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue) as CacheEnvelope<T>;
    if (!parsedValue?.savedAt || Date.now() - parsedValue.savedAt > maxAgeMs) {
      return null;
    }

    return parsedValue.value;
  } catch {
    return null;
  }
}

export async function writePersistedCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        value,
      } satisfies CacheEnvelope<T>),
    );
  } catch {
    // Cache writes must never block the core music experience.
  }
}
