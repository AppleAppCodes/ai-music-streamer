import { requireOptionalNativeModule, type EventSubscription, type NativeModule } from 'expo-modules-core';

export type AudioInterruptionEvent = {
  type: 'began' | 'ended';
  shouldResume: boolean;
};

type RemoteCommandEvents = {
  onNextTrack(): void;
  onPreviousTrack(): void;
  onAudioInterruption(event: AudioInterruptionEvent): void;
};

declare class YoriaxRemoteCommandsNativeModule extends NativeModule<RemoteCommandEvents> {
  activatePlaybackSession(): void;
  setEnabled(enabled: boolean): void;
  getAdAttributionToken(): Promise<string | null>;
}

const YoriaxRemoteCommands = requireOptionalNativeModule<YoriaxRemoteCommandsNativeModule>('YoriaxRemoteCommands');

export function activateExclusivePlaybackSession() {
  YoriaxRemoteCommands?.activatePlaybackSession();
}

export function setTrackRemoteCommandsEnabled(enabled: boolean) {
  YoriaxRemoteCommands?.setEnabled(enabled);
}

export function addTrackRemoteCommandListeners({
  onNextTrack,
  onPreviousTrack,
}: {
  onNextTrack: () => void;
  onPreviousTrack: () => void;
}) {
  const subscriptions: EventSubscription[] = [];

  if (YoriaxRemoteCommands) {
    subscriptions.push(YoriaxRemoteCommands.addListener('onNextTrack', onNextTrack));
    subscriptions.push(YoriaxRemoteCommands.addListener('onPreviousTrack', onPreviousTrack));
  }

  return () => {
    subscriptions.forEach((subscription) => subscription.remove());
  };
}

/**
 * Listen for AVAudioSession interruptions (phone calls, Siri, alarms).
 * `ended` events carry iOS's own `shouldResume` hint, which is the reliable
 * way to distinguish "interruption is over, keep playing" from a user pause.
 * No-op (returns a no-op cleanup) when the native module is unavailable.
 */
export function addAudioInterruptionListener(listener: (event: AudioInterruptionEvent) => void) {
  if (!YoriaxRemoteCommands) return () => {};
  const subscription = YoriaxRemoteCommands.addListener('onAudioInterruption', listener);
  return () => subscription.remove();
}

/**
 * Apple Search Ads attribution token (iOS 14.3+). Returns null on other
 * platforms, older iOS versions, or when the token cannot be generated.
 */
export async function getAdAttributionToken(): Promise<string | null> {
  if (!YoriaxRemoteCommands) return null;
  try {
    return await YoriaxRemoteCommands.getAdAttributionToken();
  } catch {
    return null;
  }
}
