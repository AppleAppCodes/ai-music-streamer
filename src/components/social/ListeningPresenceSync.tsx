'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/lib/player-context';
import { createClient } from '@/utils/supabase/client';

const HEARTBEAT_INTERVAL_MS = 20_000;

export default function ListeningPresenceSync() {
  const { currentSong, isPlaying, currentTime } = usePlayer();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const activityRef = useRef({ currentSong, isPlaying, currentTime });

  useEffect(() => {
    activityRef.current = { currentSong, isPlaying, currentTime };
  }, [currentSong, isPlaying, currentTime]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const syncActivity = useCallback(async () => {
    if (!userId) return;

    const activity = activityRef.current;
    const { error } = await supabase
      .from('listening_activity')
      .upsert({
        user_id: userId,
        song_id: activity.currentSong?.id ?? null,
        is_playing: Boolean(activity.currentSong && activity.isPlaying),
        progress_seconds: Math.max(0, Math.floor(activity.currentTime)),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Failed to sync listening activity', error);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) return;

    void syncActivity();
    if (!isPlaying) return;

    const interval = window.setInterval(() => {
      void syncActivity();
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [currentSong?.id, isPlaying, syncActivity, userId]);

  return null;
}
