import type { Metadata } from 'next';

import SeoLandingPage, { type SeoLandingPageContent } from '@/components/seo/SeoLandingPage';
import { buildPageMetadata, jsonLdScript, SITE_URL } from '@/lib/seo';
import { loadSeoSongPreviews } from '@/lib/seo-landing-pages';

const content: SeoLandingPageContent = {
  eyebrow: 'AI Music Streaming',
  title: 'AI music discovery built for the new sound of the internet.',
  description:
    'YORIAX is a streaming platform for AI-native music: new songs, emerging virtual artists, viral charts, curated genres, and playlists made for listeners who want fresh tracks before everyone else.',
  primaryLink: {
    href: '/charts/viral',
    label: 'Explore viral AI music',
    description: 'See the AI songs gaining momentum on YORIAX.',
  },
  secondaryLink: {
    href: '/genres',
    label: 'Browse genres',
    description: 'Find AI music by genre, mood, and listening context.',
  },
  introTitle: 'What is AI music on YORIAX?',
  intro: [
    'AI music is music created, shaped, or performed with artificial intelligence tools. On YORIAX, that does not mean random audio dumps. The platform is built around listening: songs, artists, charts, playlists, and discovery paths that make AI-native music feel like a real streaming experience.',
    'Listeners can discover AI songs across Hip-Hop, Pop, EDM, RnB, Afrobeat, House, Phonk, Latin, Chillhop, and more. Every public song page is structured so people and search engines can understand the track, artist, genre, cover artwork, and release context.',
  ],
  proofPoints: [
    'Viral charts surface AI music based on listening signals, not only upload date.',
    'Artist and song pages connect tracks, creators, genres, and playlists into one crawlable music graph.',
    'YORIAX is built for streaming, sharing, and discovery rather than one-off AI generation prompts.',
  ],
  sections: [
    {
      title: 'Discover AI-native artists',
      body: 'YORIAX gives emerging AI artists public pages, track catalogs, cover art, play counts, and direct links between songs and artist profiles.',
    },
    {
      title: 'Follow viral AI songs',
      body: 'The viral charts help listeners find tracks that are gaining attention across the platform, from experimental electronic music to AI pop and hip-hop.',
    },
    {
      title: 'Stream by genre and mood',
      body: 'Genre pages make AI music easier to explore when listeners want a specific sound, from high-energy EDM to late-night RnB and chillhop.',
    },
  ],
  faq: [
    {
      question: 'Is YORIAX an AI music generator?',
      answer:
        'YORIAX is focused on streaming and discovery. Instead of generating one track and leaving, listeners can explore AI songs, artists, playlists, genres, and charts in one place.',
    },
    {
      question: 'Can AI music be discovered like normal music?',
      answer:
        'Yes. YORIAX treats AI music as a catalog with songs, artists, genres, playlists, and charts, so listeners can browse it like a modern streaming platform.',
    },
    {
      question: 'What kind of AI music is on YORIAX?',
      answer:
        'The catalog includes AI Hip-Hop, Pop, EDM, RnB, Afrobeat, House, Phonk, Latin, Chillhop, Country, Metal, and more genres as the platform grows.',
    },
  ],
  related: [
    {
      href: '/ai-songs',
      label: 'AI songs',
      description: 'Browse tracks, artists, and song pages made for AI-native music discovery.',
    },
    {
      href: '/ki-musik',
      label: 'KI Musik',
      description: 'Deutsche Einstiegsseite für KI-Musik, AI Songs und Streaming auf YORIAX.',
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
    'Discover AI music on YORIAX: stream AI songs, explore viral charts, follow AI artists, and browse curated genres and playlists.',
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
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'YORIAX', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'AI Music', item: `${SITE_URL}/ai-music` },
      ],
    },
  ];

  return (
    <>
      <script id="yoriax-ai-music-jsonld" type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <SeoLandingPage content={content} songs={songs} />
    </>
  );
}
