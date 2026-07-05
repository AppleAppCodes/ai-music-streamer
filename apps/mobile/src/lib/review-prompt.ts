/**
 * App-Store rating prompt with engagement gating.
 *
 * Asks for a rating via the official system dialog (StoreReview.requestReview)
 * only at a moment of delight: a song just finished playing for a listener who
 * has genuinely used the app. Apple additionally caps the dialog at 3 shows
 * per year and may silently skip it — we never learn whether it appeared, so
 * the local cooldown keeps us from burning those chances.
 *
 * Gate (all must hold):
 *   - at least MIN_COUNTED_PLAYS honest plays (25s threshold, counted locally)
 *   - first use at least MIN_DAYS_INSTALLED days ago
 *   - no playback error and no ad in the current session (checked by caller)
 *   - last request at least PROMPT_COOLDOWN_DAYS ago
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const FIRST_USE_KEY = 'yoriax:review:first-use-at';
const PLAY_COUNT_KEY = 'yoriax:review:counted-plays';
const LAST_REQUEST_KEY = 'yoriax:review:last-request-at';

const MIN_COUNTED_PLAYS = 10;
const MIN_DAYS_INSTALLED = 3;
const PROMPT_COOLDOWN_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Honestly counted plays on this install (also gates the push offer). */
export async function getCountedPlays(): Promise<number> {
  try {
    return Number(await AsyncStorage.getItem(PLAY_COUNT_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Call once per honestly counted play (same spot that reports the play). */
export async function recordReviewWorthyPlay(): Promise<void> {
  try {
    const [firstUse, playCount] = await AsyncStorage.multiGet([FIRST_USE_KEY, PLAY_COUNT_KEY]);
    const pairs: Array<[string, string]> = [
      [PLAY_COUNT_KEY, String((Number(playCount[1]) || 0) + 1)],
    ];
    if (!firstUse[1]) pairs.push([FIRST_USE_KEY, String(Date.now())]);
    await AsyncStorage.multiSet(pairs);
  } catch {
    // Rating bookkeeping must never affect playback.
  }
}

/**
 * Requests the system rating dialog if the engagement gate passes.
 * Callers ensure the moment is right (song finished, no ad, no session error).
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    const values = await AsyncStorage.multiGet([FIRST_USE_KEY, PLAY_COUNT_KEY, LAST_REQUEST_KEY]);
    const firstUseAt = Number(values[0][1]) || 0;
    const countedPlays = Number(values[1][1]) || 0;
    const lastRequestAt = Number(values[2][1]) || 0;
    const now = Date.now();

    if (countedPlays < MIN_COUNTED_PLAYS) return;
    if (!firstUseAt || now - firstUseAt < MIN_DAYS_INSTALLED * DAY_MS) return;
    if (lastRequestAt && now - lastRequestAt < PROMPT_COOLDOWN_DAYS * DAY_MS) return;

    if (!(await StoreReview.hasAction())) return;

    // Record the attempt first: Apple never tells us whether the dialog was
    // actually shown, so every request spends one of the rare chances.
    await AsyncStorage.setItem(LAST_REQUEST_KEY, String(now));
    await StoreReview.requestReview();
  } catch {
    // Never surface rating errors to the listener.
  }
}
