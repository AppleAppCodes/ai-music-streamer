import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

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
