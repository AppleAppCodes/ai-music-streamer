export const PLAYER_FORCE_SIGN_OUT_EVENT = 'yoriax:force-player-sign-out';

export function notifyPlayerForceSignOut() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PLAYER_FORCE_SIGN_OUT_EVENT));
}
