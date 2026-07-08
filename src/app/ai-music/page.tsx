import type { Metadata } from 'next';

import SeoLandingPage, { type SeoLandingPageContent } from '@/components/seo/SeoLandingPage';
import { breadcrumbStructuredData, buildPageMetadata, jsonLdScript, musicRecordingItemListStructuredData, SITE_URL } from '@/lib/seo';
import { loadSeoSongPreviews } from '@/lib/seo-landing-pages';

const content: SeoLandingPageContent = {
  eyebrow: 'AI Music Streaming',
  title: 'AI music discovery built for the new sound of the internet.',
  description:
    'YORIAX is a streaming platform for AI-native music: new songs, emerging virtual artists, curated playlists, and genres made for listeners who want fresh tracks before everyone else.',
  primaryLink: {
    href: '/playlists',
    label: 'Explore AI playlists',
    description: 'Curated playlists of AI music by mood and genre.',
  },
  secondaryLink: {
    href: '/genres',
    label: 'Browse genres',
    description: 'Find AI music by genre, mood, and listening context.',
  },
  introTitle: 'What is AI music on YORIAX?',
  intro: [
    'AI music is music created, shaped, or performed with artificial intelligence tools. On YORIAX, that does not mean random audio dumps. The platform is built around listening: songs, artists, genres, playlists, and discovery paths that make AI-native music feel like a real streaming experience.',
    'Listeners can discover AI songs across Hip-Hop, Pop, RnB, Afrobeat, House, Phonk, Latin, Chillhop, and more. Every public song page is structured so people and search engines can understand the track, artist, genre, cover artwork, and release context.',
  ],
  proofPoints: [
    'Curated playlists surface AI music by mood and genre, not just upload date.',
    'Artist and song pages connect tracks, creators, genres, and playlists into one crawlable music graph.',
    'YORIAX is built for streaming, sharing, and discovery rather than one-off AI generation prompts.',
  ],
  sections: [
    {
      title: 'Discover AI-native artists',
      body: 'YORIAX gives emerging AI artists public pages, track catalogs, cover art, play counts, and direct links between songs and artist profiles.',
    },
    {
      title: 'Discover AI songs in playlists',
      body: 'Curated and public playlists help listeners find tracks across the platform, from experimental electronic music to AI pop and hip-hop.',
    },
    {
      title: 'Stream by genre and mood',
      body: 'Genre pages make AI music easier to explore when listeners want a specific sound, from high-energy House to late-night RnB and chillhop.',
    },
  ],
  faq: [
    {
      question: 'Is YORIAX an AI music generator?',
      answer:
        'YORIAX is focused on streaming and discovery. Instead of generating one track and leaving, listeners can explore AI songs, artists, playlists, and genres in one place.',
    },
    {
      question: 'Can AI music be discovered like normal music?',
      answer:
        'Yes. YORIAX treats AI music as a catalog with songs, artists, genres, and playlists, so listeners can browse it like a modern streaming platform.',
    },
    {
      question: 'What kind of AI music is on YORIAX?',
      answer:
        'The catalog includes AI Hip-Hop, Pop, RnB, Afrobeat, House, Phonk, Latin, Chillhop, Country, and more genres as the platform grows.',
    },
  ],
  related: [
    {
      href: '/ai-songs',
      label: 'AI songs',
      description: 'Browse tracks, artists, and song pages made for AI-native music discovery.',
    },
    {
      href: '/artists',
      label: 'AI artists',
      description: 'Explore public artist pages and discover the creators shaping AI-native music.',
    },
    {
      href: '/discover/playlists',
      label: 'AI music playlists',
      description: 'Explore public and official playlists for new AI-generated songs.',
    },
  ],
};

export const metadata: Metadata = buildPageMetadata({
  title: 'AI Music Streaming and Discovery',
  description:
    'Discover AI music on YORIAX: stream AI songs, follow AI artists, and browse curated genres and playlists.',
  path: '/ai-music',
});

export default async function AiMusicPage() {
  const songs = await loadSeoSongPreviews();
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'AI Music Streaming and Discovery',
      url: `${SITE_URL}/ai-music`,
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
      { name: 'AI Music', path: '/ai-music' },
    ]),
    songs.length > 0
      ? musicRecordingItemListStructuredData({
          name: 'Popular AI music on YORIAX',
          path: '/ai-music',
          songs,
        })
      : null,
  ].filter(Boolean);

  return (
    <>
      <script id="yoriax-ai-music-jsonld" type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <SeoLandingPage content={content} songs={songs} />
    </>
  );
}
