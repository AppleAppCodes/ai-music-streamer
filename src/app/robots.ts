import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/settings/'],
    },
    sitemap: 'https://www.yoriax.com/sitemap.xml',
  };
}
