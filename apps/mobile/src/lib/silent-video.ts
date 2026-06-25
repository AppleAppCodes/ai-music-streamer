import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { createVideoPlayer } from 'expo-video';
import type { VideoPlayer } from 'expo-video';

// Simple registry for pre-warmed video players
const prewarmedPlayersMap = new Map<string, VideoPlayer>();
const prewarmedPlayersKeys: string[] = [];
const MAX_PREWARMED_PLAYERS = 5;

export function configureSilentLoopingVideoPlayer(player: VideoPlayer) {
  player.loop = true;
  player.muted = true;
  player.volume = 0;
  player.audioMixingMode = 'mixWithOthers';
  player.showNowPlayingNotification = false;
  player.allowsExternalPlayback = false;
  player.staysActiveInBackground = false;
}

export function prepareSilentVideoPlayback(player: VideoPlayer) {
  player.muted = true;
  player.volume = 0;
  player.audioMixingMode = 'mixWithOthers';
}

export function getOrCreatePrewarmedPlayer(videoUrl: string): VideoPlayer {
  let player = prewarmedPlayersMap.get(videoUrl);
  if (!player) {
    // If cache is full, remove the oldest one
    if (prewarmedPlayersKeys.length >= MAX_PREWARMED_PLAYERS) {
      const oldestKey = prewarmedPlayersKeys.shift();
      if (oldestKey) {
        const oldestPlayer = prewarmedPlayersMap.get(oldestKey);
        if (oldestPlayer && typeof (oldestPlayer as any).release === 'function') {
          try {
            (oldestPlayer as any).release();
          } catch (e) {
            console.warn('[Prewarm] Failed to release video player:', e);
          }
        }
        prewarmedPlayersMap.delete(oldestKey);
        console.log(`[Prewarm] Evicted player for ${oldestKey} from cache.`);
      }
    }

    player = createVideoPlayer(videoUrl);
    configureSilentLoopingVideoPlayer(player);
    prewarmedPlayersMap.set(videoUrl, player);
    prewarmedPlayersKeys.push(videoUrl);
    console.log(`[Prewarm] Created and cached player for ${videoUrl}.`);
  }
  return player;
}

export function warmUpVideoPlayer(videoUrl: string) {
  try {
    getOrCreatePrewarmedPlayer(videoUrl);
  } catch (e) {
    console.error('[Prewarm] Failed to warm up video player for url:', videoUrl, e);
  }
}

export function useAppForeground() {
  const [isForeground, setIsForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsForeground(nextState === 'active');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return isForeground;
}

export function useShouldPlaySilentVideo(active = true) {
  const isForeground = useAppForeground();
  // Silent videos are not deactivated just because a song is playing.
  return active && isForeground;
}
