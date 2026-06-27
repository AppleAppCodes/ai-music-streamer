import type { Metadata } from 'next';

import SeoLandingPage, { type SeoLandingPageContent } from '@/components/seo/SeoLandingPage';
import { buildPageMetadata, jsonLdScript, SITE_URL } from '@/lib/seo';
import { loadSeoSongPreviews } from '@/lib/seo-landing-pages';

const content: SeoLandingPageContent = {
  eyebrow: 'KI Musik Streaming',
  title: 'KI Musik entdecken, streamen und neue AI Artists finden.',
  description:
    'YORIAX ist eine Streaming-Plattform für KI Musik: AI Songs, virale Charts, Genre-Seiten, Künstlerprofile und Playlists für alle, die neue Musik aus der AI-Ära suchen.',
  primaryLink: {
    href: '/charts/viral',
    label: 'KI Musik Charts öffnen',
    description: 'Entdecke AI Songs, die auf YORIAX gerade Aufmerksamkeit bekommen.',
  },
  secondaryLink: {
    href: '/genres',
    label: 'Genres ansehen',
    description: 'Finde KI Musik nach Sound, Stimmung und Genre.',
  },
  introTitle: 'Was ist KI Musik auf YORIAX?',
  intro: [
    'KI Musik bezeichnet Songs, die mit künstlicher Intelligenz erstellt, produziert oder stark geprägt wurden. YORIAX macht daraus kein loses Archiv, sondern eine echte Streaming-Erfahrung mit Songs, Artists, Genres, Playlists und Charts.',
    'Für Hörerinnen und Hörer bedeutet das: schneller neue AI Songs finden, Künstlerprofile entdecken, nach Genres stöbern und virale Tracks verfolgen. Für Google bedeutet es: klare Seitenstruktur, Canonicals, strukturierte Daten und interne Links.',
  ],
  proofPoints: [
    'KI Songs sind über öffentliche Songseiten, Künstlerprofile, Genres und Playlists miteinander verknüpft.',
    'Die Viral Charts zeigen, welche AI Songs auf YORIAX aktuell besonders stark performen.',
    'Deutsche und englische Landingpages helfen unterschiedlichen Suchanfragen rund um KI Musik und AI Songs.',
  ],
  sections: [
    {
      title: 'KI Musik statt Zufallstreffer',
      body: 'YORIAX bündelt AI Songs in einem Katalog, der sich wie Streaming anfühlt: mit Cover-Art, Künstlernamen, Trackseiten und Playlists.',
    },
    {
      title: 'AI Artists sichtbar machen',
      body: 'Künstlerseiten helfen dabei, einzelne Songs mit einem Artist-Profil zu verbinden und neue Tracks eines Sounds schneller zu finden.',
    },
    {
      title: 'Genres für KI Songs',
      body: 'Von Hip-Hop und Pop bis EDM, RnB, House, Phonk und Chillhop: Genre-Seiten machen KI Musik besser auffindbar.',
    },
  ],
  faq: [
    {
      question: 'Wo kann ich KI Musik hören?',
      answer:
        'Auf YORIAX kannst du KI Musik über Songseiten, Viral Charts, Genre-Seiten, Artist-Seiten und Playlists entdecken und streamen.',
    },
    {
      question: 'Ist YORIAX ein KI Musik Generator?',
      answer:
        'YORIAX ist auf Streaming und Discovery fokussiert. Die Plattform hilft dir, AI Songs und KI Artists zu finden, statt nur einzelne Prompts zu generieren.',
    },
    {
      question: 'Welche Genres gibt es für KI Musik?',
      answer:
        'YORIAX deckt unter anderem Hip-Hop, Pop, EDM, RnB, Afrobeat, House, Phonk, Latin, Chillhop, Country, Metal und weitere Genres ab.',
    },
  ],
  related: [
    {
      href: '/ai-music',
      label: 'AI music',
      description: 'Englische Seite für AI Music Streaming, Discovery und Charts.',
    },
    {
      href: '/ai-songs',
      label: 'AI songs',
      description: 'Track-fokussierte Seite für AI Songs, Künstler und Playlists.',
    },
    {
      href: '/artists',
      label: 'KI Artists',
      description: 'Entdecke öffentliche Artist-Seiten und die beliebtesten AI Artists auf YORIAX.',
    },
  ],
};

export const metadata: Metadata = buildPageMetadata({
  title: 'KI Musik streamen und AI Songs entdecken',
  description:
    'Entdecke KI Musik auf YORIAX: AI Songs streamen, virale Charts verfolgen, Genres durchsuchen und neue KI Artists finden.',
  path: '/ki-musik',
});

export default async function KiMusikPage() {
  const songs = await loadSeoSongPreviews();
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'KI Musik streamen und AI Songs entdecken',
      url: `${SITE_URL}/ki-musik`,
      description: metadata.description,
      inLanguage: 'de',
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
        { '@type': 'ListItem', position: 2, name: 'KI Musik', item: `${SITE_URL}/ki-musik` },
      ],
    },
  ];

  return (
    <>
      <script id="yoriax-ki-musik-jsonld" type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <SeoLandingPage content={content} songs={songs} />
    </>
  );
}
