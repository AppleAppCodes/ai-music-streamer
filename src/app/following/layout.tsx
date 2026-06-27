import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Following',
  description: 'Your followed artists on YORIAX.',
  path: '/following',
  noIndex: true,
});

export default function FollowingLayout({ children }: { children: ReactNode }) {
  return children;
}
