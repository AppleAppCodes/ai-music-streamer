import GenrePageClient from './GenrePageClient';

interface GenrePageProps {
  params: Promise<{ name: string }>;
}

export default async function GenrePage({ params }: GenrePageProps) {
  const { name } = await params;
  return <GenrePageClient genreName={name} />;
}
