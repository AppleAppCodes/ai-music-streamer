/**
 * Push notifications, phase 1: token registration with a contextual opt-in.
 *
 * iOS shows the system permission dialog exactly once per install, so we
 * never ask on app start. The one contextual moment is the first artist
 * follow ("want to know when X drops new music?") — a small pre-alert
 * protects that single shot; only a Yes triggers the real system dialog.
 * If permission is already granted (or granted later via iOS settings),
 * the token is refreshed silently on app start.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { supabase } from './supabase';

const OFFERED_KEY = 'yoriax:push:offered-v1';
const EAS_PROJECT_ID = 'ca24776f-fea9-45f2-9d23-1dc5e26aed06';

// Foreground behavior: show pushes as banner, no sound over running music.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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

type Translate = (key: string, options?: Record<string, string | number>) => string;

/**
 * Contextual opt-in after the first artist follow. Shows the pre-alert at
 * most once per install; the iOS system dialog fires only on an explicit Yes.
 */
export async function offerPushAfterFollow(userId: string, artistName: string, t: Translate): Promise<void> {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.granted) {
      void registerToken(userId);
      return;
    }
    if (!permissions.canAskAgain) return;

    const alreadyOffered = await AsyncStorage.getItem(OFFERED_KEY);
    if (alreadyOffered) return;
    await AsyncStorage.setItem(OFFERED_KEY, String(Date.now()));

    Alert.alert(
      t('push.offerTitle'),
      t('push.offerMessage', { artist: artistName }),
      [
        { text: t('push.offerLater'), style: 'cancel' },
        {
          text: t('push.offerYes'),
          onPress: () => {
            void (async () => {
              const request = await Notifications.requestPermissionsAsync();
              if (request.granted) await registerToken(userId);
            })();
          },
        },
      ],
    );
  } catch {
    // Never block the follow action over push problems.
  }
}
