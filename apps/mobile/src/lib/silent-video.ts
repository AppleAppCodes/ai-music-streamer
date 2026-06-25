import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { VideoPlayer } from 'expo-video';

export function configureSilentLoopingVideoPlayer(player: VideoPlayer) {
  player.loop = true;
  player.muted = true;
  player.volume = 0;
  player.audioMixingMode = 'mixWithOthers';
  player.keepScreenOnWhilePlaying = false;
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

  return active && isForeground;
}
