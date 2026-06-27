import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'YORIAX Pro',
  description: 'Upgrade to YORIAX Pro for ad-free AI music streaming, downloads, premium playlists, and platform support.',
  path: '/pro',
});

export default function ProLayout({ children }: { children: ReactNode }) {
  return children;
}
