import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Viral AI Music Charts',
  description: 'Discover the most played and fastest-rising AI songs on YORIAX, updated with viral tracks and daily listening signals.',
  path: '/charts/viral',
});

export default function ViralChartsLayout({ children }: { children: ReactNode }) {
  return children;
}
