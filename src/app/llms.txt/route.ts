import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

const content = `# ${SITE_NAME}

> ${DEFAULT_DESCRIPTION}

YORIAX is an AI-native music streaming and discovery platform. The public catalog focuses on AI music, AI songs, AI artists, viral AI music charts, genres, and playlists.

## Core Pages

- [YORIAX](${SITE_URL}/)
- [AI Music](${SITE_URL}/ai-music)
- [AI Songs](${SITE_URL}/ai-songs)
- [Viral AI Music Charts](${SITE_URL}/charts/viral)
- [AI Music Genres](${SITE_URL}/genres)
- [AI Artists](${SITE_URL}/artists)
- [AI Music Playlists](${SITE_URL}/discover/playlists)

## Structured Catalog

- Public song pages use MusicRecording structured data.
- Public artist pages use MusicGroup structured data.
- Public playlist pages use MusicPlaylist structured data.
- The canonical host is ${SITE_URL}.

## Crawling

- Sitemap: ${SITE_URL}/sitemap.xml
- Robots: ${SITE_URL}/robots.txt
`;

export function GET() {
  return new Response(content, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
