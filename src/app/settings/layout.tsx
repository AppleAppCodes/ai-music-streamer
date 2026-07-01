import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Settings',
  description: 'Manage your YORIAX account settings.',
  path: '/settings',
  noIndex: true,
});

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
