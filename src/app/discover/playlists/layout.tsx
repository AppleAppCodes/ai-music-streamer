import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Discover AI Music Playlists',
  description: 'Browse official and community playlists on YORIAX, from daily AI music releases to curated genre collections.',
  path: '/discover/playlists',
});

export default function DiscoverPlaylistsLayout({ children }: { children: ReactNode }) {
  return children;
}
