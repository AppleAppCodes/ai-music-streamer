/**
 * First-session funnel (#messen-statt-raten): four one-shot events that show
 * WHERE new users drop off after onboarding — completing it, hearing the first
 * auto-played song, sticking through 25s of it (same threshold as the honest
 * play metric), and reaching a second song.
 *
 * Server side dedupes via primary key (user_id, event), so every call here is
 * fire-and-forget and idempotent; a lost event is never worth blocking UX.
 */

import { supabase } from './supabase';

export type FunnelEvent =
  | 'onboarding_completed'
  | 'first_song_started'
  | 'first_song_25s'
  | 'second_song_started';

export function recordFunnelEvent(event: FunnelEvent, meta?: Record<string, unknown>) {
  if (!supabase) return;
  void supabase
    .rpc('record_funnel_event', { event_name: event, event_meta: meta ?? {} })
    .then(({ error }) => {
      if (error) console.warn(`record_funnel_event(${event}) failed:`, error.message);
    });
}

// The onboarding autoplay arms the funnel with its song id; the player's
// playback listener reports starts/25s without knowing about onboarding.
let firstSessionSongId: string | null = null;
let firstStartSeen = false;

export function armFirstSessionFunnel(songId: string) {
  firstSessionSongId = songId;
  firstStartSeen = false;
}

export function notifyFunnelSongStart(songId: string) {
  if (!firstSessionSongId) return;
  if (songId === firstSessionSongId) {
    if (!firstStartSeen) {
      firstStartSeen = true;
      recordFunnelEvent('first_song_started', { song_id: songId });
    }
    return;
  }
  if (firstStartSeen) {
    recordFunnelEvent('second_song_started', { song_id: songId });
    firstSessionSongId = null; // funnel complete
  }
}

export function notifyFunnelSong25s(songId: string) {
  if (firstSessionSongId && songId === firstSessionSongId) {
    recordFunnelEvent('first_song_25s', { song_id: songId });
  }
}
