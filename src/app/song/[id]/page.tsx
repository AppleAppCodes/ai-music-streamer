import SongPageClient from './SongPageClient';

interface SongPageProps {
  params: Promise<{ id: string }>;
}

export default async function SongPage({ params }: SongPageProps) {
  const { id } = await params;
  return <SongPageClient songId={id} />;
}
