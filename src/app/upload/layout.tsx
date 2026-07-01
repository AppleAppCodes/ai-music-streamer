import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Upload',
  description: 'Upload music to YORIAX.',
  path: '/upload',
  noIndex: true,
});

export default function UploadLayout({ children }: { children: ReactNode }) {
  return children;
}
