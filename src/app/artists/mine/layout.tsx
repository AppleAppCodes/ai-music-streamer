import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'My Artists',
  description: 'Manage your YORIAX artist profiles.',
  path: '/artists/mine',
  noIndex: true,
});

export default function MyArtistsLayout({ children }: { children: ReactNode }) {
  return children;
}
