/**
 * Cross-Tab Communication for YORIAX
 * 
 * Uses BroadcastChannel API to synchronize auth state and player state
 * across browser tabs. This solves two critical problems:
 * 1. Logout in one tab must log out ALL tabs
 * 2. Only ONE tab may play music at any given time
 */

const AUTH_CHANNEL_NAME = 'yoriax:auth';
const PLAYER_CHANNEL_NAME = 'yoriax:player';

type AuthMessage = {
  type: 'SIGNED_OUT';
};

type PlayerMessage = {
  type: 'PLAYBACK_STARTED';
  tabId: string;
};

// Generate a unique ID for this tab instance
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let authChannel: BroadcastChannel | null = null;
let playerChannel: BroadcastChannel | null = null;
let onForceLogout: (() => void) | null = null;
let onForceStopPlayback: (() => void) | null = null;

export function getTabId(): string {
  return TAB_ID;
}

/**
 * Initialize the auth channel. When a SIGNED_OUT message is received
 * from another tab, the callback fires and this tab is force-logged-out.
 */
export function initAuthChannel(onLogout: () => void): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }

  onForceLogout = onLogout;

  try {
    authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    authChannel.onmessage = (event: MessageEvent<AuthMessage>) => {
      if (event.data?.type === 'SIGNED_OUT') {
        onForceLogout?.();
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel not supported, falling back to localStorage', e);
    // Fallback: listen for localStorage changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'yoriax:force-logout') {
        onForceLogout?.();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }

  return () => {
    authChannel?.close();
    authChannel = null;
  };
}

/**
 * Broadcast a logout event to all other tabs.
 */
export function broadcastSignOut(): void {
  if (typeof window === 'undefined') return;

  try {
    if (authChannel) {
      authChannel.postMessage({ type: 'SIGNED_OUT' } as AuthMessage);
    } else {
      // Fallback for browsers without BroadcastChannel
      const chan = new BroadcastChannel(AUTH_CHANNEL_NAME);
      chan.postMessage({ type: 'SIGNED_OUT' } as AuthMessage);
      setTimeout(() => chan.close(), 100);
    }
  } catch {
    // Final fallback: localStorage event
    localStorage.setItem('yoriax:force-logout', Date.now().toString());
    localStorage.removeItem('yoriax:force-logout');
  }
}

/**
 * Initialize the player channel. When another tab starts playing,
 * this tab's playback is paused.
 */
export function initPlayerChannel(onStop: () => void): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }

  onForceStopPlayback = onStop;

  try {
    playerChannel = new BroadcastChannel(PLAYER_CHANNEL_NAME);
    playerChannel.onmessage = (event: MessageEvent<PlayerMessage>) => {
      if (event.data?.type === 'PLAYBACK_STARTED' && event.data.tabId !== TAB_ID) {
        onForceStopPlayback?.();
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel not supported for player sync', e);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'yoriax:active-player' && e.newValue !== TAB_ID) {
        onForceStopPlayback?.();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }

  return () => {
    playerChannel?.close();
    playerChannel = null;
  };
}

/**
 * Announce to all other tabs that THIS tab is now the active player.
 * Other tabs will pause their playback.
 */
export function broadcastPlaybackStarted(): void {
  if (typeof window === 'undefined') return;

  try {
    if (playerChannel) {
      playerChannel.postMessage({ type: 'PLAYBACK_STARTED', tabId: TAB_ID } as PlayerMessage);
    } else {
      const chan = new BroadcastChannel(PLAYER_CHANNEL_NAME);
      chan.postMessage({ type: 'PLAYBACK_STARTED', tabId: TAB_ID } as PlayerMessage);
      setTimeout(() => chan.close(), 100);
    }
  } catch {
    // Fallback
    localStorage.setItem('yoriax:active-player', TAB_ID);
  }
}
