import ArtistPageClient from './ArtistPageClient';

interface ArtistPageProps {
  params: Promise<{ name: string }>;
}

function decodeArtistNameParam(value: string) {
  let decoded = value;

  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  return decoded;
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { name } = await params;
  return <ArtistPageClient artistName={decodeArtistNameParam(name)} />;
}
