import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { VideoPlayer } from 'expo-video';
import { usePlayerShell } from './player-context';

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
  const { hasActiveSong, isPlaying } = usePlayerShell();

  return active && isForeground && !(hasActiveSong && isPlaying);
}
