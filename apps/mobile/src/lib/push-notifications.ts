/**
 * Push notifications: token registration with contextual opt-ins.
 *
 * iOS shows the system permission dialog exactly once per install, so we
 * never ask on app start. Our own pre-alert costs nothing and protects that
 * single shot — the system dialog only fires on an explicit Yes. Offers:
 *
 *   1. First artist follow ("want to know when X drops new music?")
 *   2. Engaged listeners without follows (>= 15 honestly counted plays)
 *   3. A manual row in the profile screen (always available, never nags)
 *
 * "Later" means later: offers repeat after OFFER_COOLDOWN_DAYS at the next
 * trigger moment, at most MAX_OFFERS times per install. If permission is
 * already granted (or granted later via iOS settings), the token is
 * refreshed silently on app start.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';
import { supabase } from './supabase';
import { getCountedPlays } from './review-prompt';

const OFFER_COUNT_KEY = 'yoriax:push:offer-count';
const LAST_OFFER_KEY = 'yoriax:push:last-offer-at';
// Build 179 stored a single "offered once, never again" flag; migrate it so
// early testers are treated as "one offer spent", not "never asked".
const LEGACY_OFFERED_KEY = 'yoriax:push:offered-v1';
const EAS_PROJECT_ID = 'ca24776f-fea9-45f2-9d23-1dc5e26aed06';

const MAX_OFFERS = 3;
const OFFER_COOLDOWN_DAYS = 30;
const LISTENING_OFFER_MIN_PLAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

// Foreground behavior: show pushes as banner, no sound over running music.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type Translate = (key: string, options?: Record<string, string | number>) => string;

async function registerToken(userId: string): Promise<boolean> {
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    if (!token || !supabase) return false;
    const { error } = await supabase.from('push_tokens').upsert(
      { token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
    if (error) {
      console.warn('push token upsert failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('push token registration failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/** App start: refresh the token silently when permission already exists. */
export async function syncPushTokenIfPermitted(userId: string): Promise<void> {
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (granted) await registerToken(userId);
  } catch {
    // Push must never affect startup.
  }
}

async function readOfferState(): Promise<{ count: number; lastOfferAt: number }> {
  const values = await AsyncStorage.multiGet([OFFER_COUNT_KEY, LAST_OFFER_KEY, LEGACY_OFFERED_KEY]);
  let count = Number(values[0][1]) || 0;
  let lastOfferAt = Number(values[1][1]) || 0;
  const legacy = Number(values[2][1]) || 0;
  if (legacy && count === 0) {
    count = 1;
    lastOfferAt = legacy;
    await AsyncStorage.multiSet([
      [OFFER_COUNT_KEY, String(count)],
      [LAST_OFFER_KEY, String(lastOfferAt)],
    ]);
    await AsyncStorage.removeItem(LEGACY_OFFERED_KEY);
  }
  return { count, lastOfferAt };
}

/**
 * Shared pre-alert flow for the contextual offers. Returns silently when the
 * moment is not right; only an explicit Yes triggers the iOS system dialog.
 */
async function offerPush(userId: string, title: string, message: string, yesLabel: string, laterLabel: string): Promise<void> {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.granted) {
      void registerToken(userId);
      return;
    }
    if (!permissions.canAskAgain) return;

    const { count, lastOfferAt } = await readOfferState();
    if (count >= MAX_OFFERS) return;
    if (lastOfferAt && Date.now() - lastOfferAt < OFFER_COOLDOWN_DAYS * DAY_MS) return;

    await AsyncStorage.multiSet([
      [OFFER_COUNT_KEY, String(count + 1)],
      [LAST_OFFER_KEY, String(Date.now())],
    ]);

    Alert.alert(title, message, [
      { text: laterLabel, style: 'cancel' },
      {
        text: yesLabel,
        onPress: () => {
          void (async () => {
            const request = await Notifications.requestPermissionsAsync();
            if (request.granted) await registerToken(userId);
          })();
        },
      },
    ]);
  } catch {
    // Never block the calling flow over push problems.
  }
}

/** Contextual opt-in after an artist follow — the strongest moment. */
export async function offerPushAfterFollow(userId: string, artistName: string, t: Translate): Promise<void> {
  await offerPush(
    userId,
    t('push.offerTitle'),
    t('push.offerMessage', { artist: artistName }),
    t('push.offerYes'),
    t('push.offerLater'),
  );
}

// One listening offer attempt per app session is plenty.
let listeningOfferAttempted = false;

/**
 * Fallback for engaged listeners who never follow anyone: offer once they
 * have >= LISTENING_OFFER_MIN_PLAYS honestly counted plays.
 */
export async function maybeOfferPushAfterListening(userId: string, t: Translate): Promise<void> {
  try {
    if (listeningOfferAttempted) return;
    if ((await getCountedPlays()) < LISTENING_OFFER_MIN_PLAYS) return;
    listeningOfferAttempted = true;
    await offerPush(
      userId,
      t('push.listenOfferTitle'),
      t('push.listenOfferMessage'),
      t('push.offerYes'),
      t('push.offerLater'),
    );
  } catch {
    // Never interfere with playback.
  }
}

/** Current permission state for the profile settings row. */
export async function getPushPermissionState(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  try {
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    return { granted, canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

/**
 * Manual enable from the profile row. The user explicitly tapped, so the
 * system dialog fires directly (no pre-alert, does not count as an offer).
 * When iOS-denied, the only path left is the system settings.
 */
export async function enablePushFromSettings(userId: string, t: Translate): Promise<boolean> {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.granted) {
      await registerToken(userId);
      return true;
    }
    if (permissions.canAskAgain) {
      const request = await Notifications.requestPermissionsAsync();
      if (request.granted) {
        await registerToken(userId);
        return true;
      }
      return false;
    }
    Alert.alert(t('push.settingsDeniedTitle'), t('push.settingsDeniedMessage'), [
      { text: t('push.offerLater'), style: 'cancel' },
      { text: t('push.openSettings'), onPress: () => void Linking.openSettings() },
    ]);
    return false;
  } catch {
    return false;
  }
}
