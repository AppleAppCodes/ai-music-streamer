import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type PlayerOverlayContextValue = {
  closePlayer: () => void;
  isPlayerExpanded: boolean;
  openPlayer: () => void;
};

const PlayerOverlayContext = createContext<PlayerOverlayContextValue | undefined>(undefined);

export function PlayerOverlayProvider({ children }: PropsWithChildren) {
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const openPlayer = useCallback(() => setIsPlayerExpanded(true), []);
  const closePlayer = useCallback(() => setIsPlayerExpanded(false), []);

  const value = useMemo(() => ({
    closePlayer,
    isPlayerExpanded,
    openPlayer,
  }), [closePlayer, isPlayerExpanded, openPlayer]);

  return (
    <PlayerOverlayContext.Provider value={value}>
      {children}
    </PlayerOverlayContext.Provider>
  );
}

export function usePlayerOverlay() {
  const context = useContext(PlayerOverlayContext);
  if (!context) {
    throw new Error('usePlayerOverlay must be used inside PlayerOverlayProvider');
  }
  return context;
}
