import type { Metadata } from 'next';

export const SITE_URL = 'https://www.yoriax.com';
export const SITE_NAME = 'YORIAX';
export const DEFAULT_OG_IMAGE = '/brand/yoriax-share.png';
export const DEFAULT_OG_ALT = 'YORIAX logo on a dark purple music background';
export const DEFAULT_TITLE = 'YORIAX | AI Music Streaming';
export const DEFAULT_DESCRIPTION =
  'Discover AI-native music, stream new songs from emerging creators, explore viral charts, and build playlists on YORIAX.';

const DEFAULT_KEYWORDS = [
  'YORIAX',
  'AI music',
  'AI songs',
  'music streaming',
  'AI music streaming',
  'AI artists',
  'viral AI songs',
  'AI music app',
  'AI streaming platform',
];

type BuildPageMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  image?: string | null;
  imageAlt?: string;
  noIndex?: boolean;
};

export function absoluteUrl(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return `${SITE_URL}${DEFAULT_OG_IMAGE}`;

  try {
    return new URL(pathOrUrl, SITE_URL).toString();
  } catch {
    return `${SITE_URL}${DEFAULT_OG_IMAGE}`;
  }
}

export function canonicalUrl(path = '/') {
  return new URL(path, SITE_URL).toString();
}

export function buildPageMetadata({
  title,
  description,
  path = '/',
  image = DEFAULT_OG_IMAGE,
  imageAlt = DEFAULT_OG_ALT,
  noIndex = false,
}: BuildPageMetadataOptions): Metadata {
  const url = canonicalUrl(path);
  const imageUrl = absoluteUrl(image);

  return {
    title,
    description,
    keywords: DEFAULT_KEYWORDS,
    alternates: {
      canonical: url,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
      locale: 'en_US',
      alternateLocale: ['de_DE'],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [
        {
          url: imageUrl,
          alt: imageAlt,
        },
      ],
    },
  };
}

export function jsonLdScript(data: unknown) {
  return {
    __html: JSON.stringify(data).replace(/</g, '\\u003c'),
  };
}

export function secondsToIsoDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return undefined;
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `PT${minutes ? `${minutes}M` : ''}${remainingSeconds ? `${remainingSeconds}S` : ''}` || 'PT0S';
}

export const rootStructuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/brand/yoriax-logo-symbol.png'),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web, macOS, Windows',
    description: DEFAULT_DESCRIPTION,
    image: absoluteUrl(DEFAULT_OG_IMAGE),
  },
];
