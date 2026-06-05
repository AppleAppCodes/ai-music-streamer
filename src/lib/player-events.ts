export const PLAYER_FORCE_SIGN_OUT_EVENT = 'yoriax:force-player-sign-out';

const PLAYER_STORAGE_KEYS = [
  'player_currentSong',
  'player_queue',
  'player_queueIndex',
  'player_repeatMode',
  'player_isShuffling',
] as const;

declare global {
  interface Window {
    __YORIAX_STOP_PLAYBACK__?: () => void;
  }
}

function stopDocumentMedia() {
  document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((media) => {
    media.pause();
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
}

function clearStoredPlayerState() {
  PLAYER_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

export function notifyPlayerForceSignOut() {
  if (typeof window === 'undefined') return;

  window.__YORIAX_STOP_PLAYBACK__?.();
  stopDocumentMedia();
  clearStoredPlayerState();
  window.dispatchEvent(new Event(PLAYER_FORCE_SIGN_OUT_EVENT));
}
