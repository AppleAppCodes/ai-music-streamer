import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/ki-musik',
        destination: '/ai-music',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'eiqelhjugiwckvxyixyh.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      // allow fallback to any external image if needed temporarily
      {
        protocol: 'https',
        hostname: '**',
      }
    ],
  },
};

export default nextConfig;
