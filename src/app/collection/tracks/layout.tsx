import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Saved Tracks',
  description: 'Your saved tracks on YORIAX.',
  path: '/collection/tracks',
  noIndex: true,
});

export default function SavedTracksLayout({ children }: { children: ReactNode }) {
  return children;
}
