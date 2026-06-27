import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Your Playlists',
  description: 'Manage your YORIAX playlists.',
  path: '/playlists',
  noIndex: true,
});

export default function PlaylistsLayout({ children }: { children: ReactNode }) {
  return children;
}
