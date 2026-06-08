import AlbumPageClient from './AlbumPageClient';

interface AlbumPageProps {
  params: Promise<{ id: string }>;
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const { id } = await params;
  return <AlbumPageClient albumId={id} />;
}
