'use client';

import { PlayerProvider } from '@/lib/player-context';
import '@/i18n/i18n';

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      {children}
    </PlayerProvider>
  );
}
