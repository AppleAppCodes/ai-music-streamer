import type { Metadata } from 'next';
import GenrePageClient from './GenrePageClient';
import { GENRES } from '@/lib/constants';
import { buildPageMetadata } from '@/lib/seo';

interface GenrePageProps {
  params: Promise<{ name: string }>;
}

function decodeGenreParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getDisplayGenre(value: string) {
  const decoded = decodeGenreParam(value);
  return GENRES.find((genre) => genre.name.toLowerCase() === decoded.toLowerCase())?.name ?? decoded;
}

export async function generateMetadata({ params }: GenrePageProps): Promise<Metadata> {
  const { name } = await params;
  const genre = getDisplayGenre(name);

  return buildPageMetadata({
    title: `${genre} AI Songs`,
    description: `Stream ${genre} AI music on YORIAX. Discover new AI-generated tracks, artists, and playlists in ${genre}.`,
    path: `/genre/${encodeURIComponent(genre)}`,
  });
}

export default async function GenrePage({ params }: GenrePageProps) {
  const { name } = await params;
  return <GenrePageClient genreName={name} />;
}
