import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Login',
  description: 'Log in or create your free YORIAX account.',
  path: '/login',
  noIndex: true,
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
