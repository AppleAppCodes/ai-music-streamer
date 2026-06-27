import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Admin',
  description: 'YORIAX admin area.',
  path: '/admin',
  noIndex: true,
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
