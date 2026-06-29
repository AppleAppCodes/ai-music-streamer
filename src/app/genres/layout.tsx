import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'AI Music Genres',
  description: 'Explore AI-generated songs by genre on YORIAX, including Hip-Hop, Pop, RnB, Afrobeat, Phonk, House, and more.',
  path: '/genres',
});

export default function GenresLayout({ children }: { children: ReactNode }) {
  return children;
}
