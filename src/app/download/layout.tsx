import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Download YORIAX',
  description: 'Download YORIAX for Mac or Windows and stream AI-native music with a fast desktop experience.',
  path: '/download',
});

export default function DownloadLayout({ children }: { children: ReactNode }) {
  return children;
}
