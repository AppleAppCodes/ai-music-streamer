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
    // Reduce Vercel Image Optimization "transformations" usage (free-tier limit):
    // keep optimized variants cached far longer and generate fewer width variants.
    minimumCacheTTL: 2678400, // 31 days (default is only 4h -> constant re-transforms)
    deviceSizes: [640, 828, 1080, 1920, 2048], // trimmed from 8 defaults (dropped 750/1200/3840)
    imageSizes: [48, 96, 256, 384], // trimmed from 7 defaults
    // Only optimize images from our own Supabase storage (+ unsplash placeholders).
    // The previous `hostname: '**'` let anyone push arbitrary external images
    // through our optimizer, draining the transformation quota.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'eiqelhjugiwckvxyixyh.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // Google OAuth profile photos (avatar_url for users who sign in with
        // Google) are served from lh3..lh6.googleusercontent.com.
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
