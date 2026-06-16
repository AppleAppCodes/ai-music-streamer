import { requireOptionalNativeModule, type EventSubscription, type NativeModule } from 'expo-modules-core';

type RemoteCommandEvents = {
  onNextTrack(): void;
  onPreviousTrack(): void;
};

declare class YoriaxRemoteCommandsNativeModule extends NativeModule<RemoteCommandEvents> {
  activatePlaybackSession(): void;
  setEnabled(enabled: boolean): void;
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
