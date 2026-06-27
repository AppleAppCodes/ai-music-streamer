import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'AI Music Artists',
  description: 'Discover AI music artists on YORIAX, browse creator profiles, listen to new songs, and follow the next wave of AI-native music.',
  path: '/artists',
});

export default function ArtistsLayout({ children }: { children: ReactNode }) {
  return children;
}
