import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/settings/',
        '/upload/',
        '/following/',
        '/collection/',
        '/playlists/',
        '/artists/mine/',
        '/search?*',
      ],
    },
    sitemap: 'https://www.yoriax.com/sitemap.xml',
  };
}
