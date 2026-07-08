import type { Metadata } from 'next';

import SeoLandingPage, { type SeoLandingPageContent } from '@/components/seo/SeoLandingPage';
import { breadcrumbStructuredData, buildPageMetadata, jsonLdScript, musicRecordingItemListStructuredData, SITE_URL } from '@/lib/seo';
import { loadSeoSongPreviews } from '@/lib/seo-landing-pages';

const content: SeoLandingPageContent = {
  eyebrow: 'AI Songs',
  title: 'Find AI songs, new artists, and viral tracks in one catalog.',
  description:
    'Browse AI songs on YORIAX with track pages, artist links, cover art, genres, and playlists designed for discovering music made with artificial intelligence.',
  primaryLink: {
    href: '/playlists',
    label: 'Browse AI playlists',
    description: 'Curated playlists that group AI songs by mood and genre.',
  },
  secondaryLink: {
    href: '/artists',
    label: 'Find AI artists',
    description: 'Explore creators and artist pages on YORIAX.',
  },
  introTitle: 'A better way to browse AI songs',
  intro: [
    'AI songs need more than a file name and a play button. YORIAX gives every public track a page with metadata that helps listeners understand the song: title, artist, artwork, genre, duration, release date, and links back into the catalog.',
    'That structure matters for discovery. Search engines can crawl song pages, playlists can link related tracks, artists can build catalogs, and listeners can move naturally from one AI song to the next.',
  ],
  proofPoints: [
    'Public song pages include canonical URLs, Open Graph images, and MusicRecording structured data.',
    'Genre and artist links help listeners discover more AI songs with a similar sound.',
    'Genres and playlists create fresh entry points for new listeners and returning fans.',
  ],
  sections: [
    {
      title: 'AI song pages with context',
      body: 'Each public song page can carry track-specific metadata, cover artwork, artist attribution, genre, duration, and release information.',
    },
    {
      title: 'Genres for every sound',
      body: 'Genre pages group AI songs by style so listeners can dive into lo-fi, R&B, pop, electronic, and more.',
    },
    {
      title: 'Playlists for discovery',
      body: 'Official and public playlists group AI songs into listening flows, making it easier to find music for a mood, scene, or genre.',
    },
  ],
  faq: [
    {
      question: 'Where can I listen to AI songs?',
      answer:
        'You can listen to AI songs on YORIAX through public song pages, genre pages, artist pages, and playlists.',
    },
    {
      question: 'Are AI songs on YORIAX organized by genre?',
      answer:
        'Yes. YORIAX supports genre discovery across Hip-Hop, Pop, RnB, Afrobeat, House, Phonk, Latin, Chillhop, and more.',
    },
    {
      question: 'Can AI songs have artist pages?',
      answer:
        'Yes. Public artist pages connect an AI artist name with songs, covers, play counts, and related discovery paths.',
    },
  ],
  related: [
    {
      href: '/ai-music',
      label: 'AI music',
      description: 'Learn how YORIAX organizes AI-native music for streaming and discovery.',
    },
    {
      href: '/genres',
      label: 'AI song genres',
      description: 'Browse songs by sound, scene, and listening mood.',
    },
    {
      href: '/playlist/daily-new-releases',
      label: 'Daily new releases',
      description: 'Listen to a fresh selection of recent AI songs on YORIAX.',
    },
  ],
};

export const metadata: Metadata = buildPageMetadata({
  title: 'AI Songs to Stream and Discover',
  description:
    'Find AI songs on YORIAX: stream tracks, discover AI artists, browse genres, and explore curated playlists.',
  path: '/ai-songs',
});

export default async function AiSongsPage() {
  const songs = await loadSeoSongPreviews();
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'AI Songs to Stream and Discover',
      url: `${SITE_URL}/ai-songs`,
      description: metadata.description,
      isPartOf: { '@id': `${SITE_URL}/#website` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
    breadcrumbStructuredData([
      { name: 'YORIAX', path: '/' },
      { name: 'AI Songs', path: '/ai-songs' },
    ]),
    songs.length > 0
      ? musicRecordingItemListStructuredData({
          name: 'AI songs to stream on YORIAX',
          path: '/ai-songs',
          songs,
        })
      : null,
  ].filter(Boolean);

  return (
    <>
      <script id="yoriax-ai-songs-jsonld" type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <SeoLandingPage content={content} songs={songs} />
    </>
  );
}
