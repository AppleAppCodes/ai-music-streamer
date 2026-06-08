import ArtistPageClient from './ArtistPageClient';

interface ArtistPageProps {
  params: Promise<{ name: string }>;
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { name } = await params;
  return <ArtistPageClient artistName={name} />;
}
