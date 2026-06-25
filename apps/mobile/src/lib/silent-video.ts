import type { VideoPlayer } from 'expo-video';

function disableSilentVideoAudioTrack(player: VideoPlayer) {
  try {
    player.audioTrack = null;
  } catch {
    // Some platforms/sources expose audioTrack as effectively read-only until the source is loaded.
    // Muting + zero volume still keeps the decorative video silent, and we retry after source load.
  }
}

export function configureSilentLoopingVideoPlayer(player: VideoPlayer) {
  player.loop = true;
  player.muted = true;
  player.volume = 0;
  player.audioMixingMode = 'mixWithOthers';
  player.keepScreenOnWhilePlaying = false;
  player.showNowPlayingNotification = false;
  player.allowsExternalPlayback = false;
  player.staysActiveInBackground = false;
  disableSilentVideoAudioTrack(player);
}

export function prepareSilentVideoPlayback(player: VideoPlayer) {
  player.muted = true;
  player.volume = 0;
  player.audioMixingMode = 'mixWithOthers';
  disableSilentVideoAudioTrack(player);
}

export function startSilentVideoLoop(player: VideoPlayer) {
  prepareSilentVideoPlayback(player);
  if (!player.playing) {
    player.play();
  }
}

export function useShouldPlaySilentVideo(active = true) {
  return active;
}
