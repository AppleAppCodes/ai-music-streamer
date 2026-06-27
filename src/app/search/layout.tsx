import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Search YORIAX',
  description: 'Search songs, artists, and playlists on YORIAX.',
  path: '/search',
  noIndex: true,
});

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children;
}
